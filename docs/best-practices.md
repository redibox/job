## Best Practices

### Job

With a clustered server environment with high queue concurrency, the speed in which the overall "task" will complete
will be much quicker if the task is broken down into many smaller jobs, rather than one large job. Memory/CPU usage will be kept lower
and error trapping will be much more specific to a single job for easier debugging.

**Example**: We've got a very large set of data which a user has uploaded which needs to be processed. The data needs to be interated over, 
manipulated, internal database calls need to be made using the data and finally data needs to be saved.

We could handle this very easily in a express request to our api. However this could take a very long time and potentially delay other user requests coming into our api. Consider the below example:

```javascript
// your api
import each from 'async/each';

// some request controller
export default function(req, res) {
  // wherever the users file has been uploaded to
  const arrayData = require('../users-massive-dataset.json');
  
  each(arrayData, function(item, done) {
    return User
      .find({ name: item.name })
      .then(user => {
        user.settings = item.settings;
        user.save(done)
      });
  }, function(error) {
    if (error) {
      return res.serverError(error);
    }
    
    return res.ok({ msg: 'Sorry i took a long time, but all done!' });
  });
}

```

There's several problems here:

1. The request would consume lots of memory/cpu on the server performing the request.
2. The server running the request is potentially out of action until the processing has completed (which might take several seconds).
3. If our user wants to update thousands of database records, it's very hard to internally throttle this due to the async nature of Node.


Instead, let's send this request to our internal node.js worker farm and break it down into multiple jobs as this would be a much better solution:

#### Your API
Your API where the redibox job `enabled` option is set to `false` - which means we're in provider only mode and will not consume jobs on the API. Queues do not need to be specified on your config in this case - only consumers of jobs need the queues specified.

```javascript
// some request controller
export default function(req, res) {
  // ...
  // lets move the upload into redis - assumes 'uploadData' is the upload.
  RediBox.client.set('users:upload:id', uploadData).then(() => {
    Job.create('user-uploads', {
      runs: 'getDataAndProcessIt',
      data: {
        uploadKey: 'users:upload:id',
      }
    });
    return res.ok({ msg: 'Upload complete - we will notify you when your upload has been processed.'});
  });
}

```

#### A server in your worker farm

Your server in your internal worker farm where the redibox job `enabled` option is set to `true`, meaning these servers will be able to consume and also provide new jobs. You'll need to add in the config for your queues on these servers, consumers need to know what queues to consume from.

```javascript
// get the upload data and break it into smaller update jobs for load distribution
export function getDataAndProcessIt() {
  const { dataKey } = this.data;
  
  return RediBox.client.get(dataKey).then((uploadData) => {
    if (!uploadData) return Promise.reject(`Upload not found for key '${dataKey}'`);
    
    // we could just do all the updates in this one job but we have a farm
    // so lets distribute the load and spread the updates across all our servers
    // by creating individual jobs for each update
    for (let i = 0, len = uploadData.length; i < len; i++) {
      const item = uploadData[i];
      Job.create('user-upload-items', {
        runs: 'updateUser',
        data: {
          name: item.name,
          settings: item.settings,
        }
      });
    }
  });
}

// your global updateUser job function
// this handles a single item in the users upload
export function updateUser() {
  return User
    .find({ name: this.data.name })
    .then(user => {
      user.settings = this.data.settings;
      
      return new Promise((resolve, reject) { 
        user.save(error => {
          if (error) {
            return Promise.reject(error);
          }
          
          // TODO
          // notify the user that this part of their upload has been processed
          // for example they're importing users into their org, show the user as imported
          // ...
          
          return Promise.resolve();
        });
      });
    });
}
```

1. The first job is short, sweet and very performant. This will consume little memory and cpu usage while enabling us to distribute the load for effecient processing.
2. The second job is user specific; we're querying an individual user per job. This can be throttled by using a different
queue. If a user query fails we can also trap the errors for the specific user.
3. If a single job fails, other jobs won't be effected.
4. We can add more servers to the environment to power through the jobs quicker.
5. We've removed the need to use an async library.

As you can see this now become distributed and the load is spread across all your workers, each handling jobs of their own concurrently, resulting in faster processing overall.

### Queues

Generally it is better to work with multiple queues than one. A queue should be specific to the general logic of which
jobs will be performing. The best way to think of this would be a service which consumes an external API, manipulates this data,
then saves it within a local database.

In this case, we'd have two queues: `external-api` and `internal-processing`.

- `external-api` simply gatheres data from the external API, performs some basic validation & manipulation then creates 
other Jobs to use `internal-processing`.

- `internal-processing` would then take this data and simply use and abuse it. 

With separate queues, you can then throttle the `external-api` to lower API requests at the provider, but have the `internal-processing`
process the jobs with a much higher concurrency.
