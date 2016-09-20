## Best Practices

### Job

With a clustered server environment with high queue concurrency, the speed in which the overall "task" will complete
will be much quicker if task is broken down into many smaller jobs, rather than one large job. Memory/CPU usage will be kept lower
and error trapping will be much more specific to a single job for easier debugging.

**Example**: We've got a very large set of data which needs to be processed. The data needs to be looped over, 
manipulated, internal database calls need to be made using the data and finally data needs to be saved.

A single job could handle this very easily. However we'd need to make use of Node.JS's async compatibility and 
the code would become very messy - lots of nested loops, variables etc.

```javascript
// Massive job which finds and updates users
import each from 'async/each';

export default function() {
  const data = require('../my-massive-dataset.json');
  
  return each(data, function(item, done) {
    return User
      .find({ name: item.name })
      .then(user => {
        user.settings = item.settings;
        user.save(done)
      });
  }, function(error) {
    if (error) {
      return Promise.reject(error);
    }
    
    return Promise.resolve();
  });
}

```

There's two problems here:

1. The job would consume lots of memory/cpu on the server performing async requests, storing variables in memory etc.
2. The server running the job is potentially out of action until the job has completed (which might take quite a while).
3. If our job has to update thousands of database records, it's very hard to internally throttle this due to the async nature of Node.

Breaking this job down into multiple jobs would be a much better solution:

```javascript
// Smaller jobs to update users
export default function() {
  const data = require('../my-massive-dataset.json');
  
  for (let i = 0, len = data.length; i < len; i++) {
    const item = data[i];
    
    Job.create('my-queue', {
      runs: 'updateUser',
      data: {
        name: item.name,
        settings: item.settings,
      }
    });
  }
  
  return Promise.resolve();
}

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
          
          return Promise.resolve();
        });
      });
    });
}
```

1. The first job is fully synchronous and very performant. This will consume little memory and usage.
2. The second job is user specific; we're querying an individual user per job. This can be throttled by using a different
queue. If a user query fails we can also trap the errors for the specific user.
3. If a single job fails, other jobs won't be effected.
4. We can add more servers to the environment to power through the jobs quicker.
5. We've removed the need to use an async library.

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
