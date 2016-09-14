## Advanced Usage

### Inline vs globally accessible functions

For simplicity reasons, previous examples have mostly shown the functions jobs execute as inline, e.g:

```javascript
RediBox.hooks.job.create('queue', {
  runs: function(job) {
    console.log('Job running');
  }
});
```

Although this will work, typically this will be unmanageable within your code base. Ideally you'll want to expose your functions
to be globally accessible, much like [Sails JS Hooks](http://sailsjs.org/documentation/concepts/extending-sails/hooks). This allows
functions to be broken down into file based logic and callable globally. If the job detects a string as a run function,
it'll attempt to execute it, assuming it's a global function.

This allows for much cleaner code, e.g:

```javascript
// firstJob.js
RediBox.hooks.job.create('queue', {
  runs: 'sails.hooks.api.request',
});
```

```javascript
// request.js
export default function() {
  console.log(this.data);
}
```

It's also worth noting that with inline functions, the job is bound as the first argument to the function, whilst with 
a global function it's bound to it's scope, whereby the job can be accessed with `this`.

### Error handling

Handling errors from jobs is very simple, and can be handled inside promises or by synchronously throwing an error.

#### Via promises

Lets assume we're using an ORM which can perform database queries and each query returns a promise. We can simply return the promise and the job will `catch` any errors thrown from the promise:

```javascript
export default function() {
  return Person.find();
}
```

If for any reason this threw an error, the job would handle this and throw it to the console. You're also able to manually throw an error with promises by using reject:

```
export default function() {
  return Promise.reject('Something went wrong');
}
```

#### Synchronously

If your current job doesn't require or use promises, simply throw an error in-line which will also be handled:

```javascript
export default function() {
  const { person } = this.data;
  
  if (!person) {
    throw new Error('Something went wrong');
  }
  
  ...
}
```

### Chaining Jobs

The `runs` option on a job is also able to take an array of functions to be run, in order.

The jobs which are chained simply need to return a promise resolve, optionally containing data to be passed onto the next job in the chain. If a chained job resolves `false`, the chain will be stopped. This can be very handy when you've got a collection of jobs and one of those is a very generic which can apply to multiple queues/jobs.

An example:

```javascript
Redibox.hooks.job.create('queue', {
  runs: [
    'global.generic.findPerson',
    'global.person.updatePerson',
  ],
  data: {
    query: {
      firstName: 'foo',
      lastName: 'bar',
    },
  },
});
```

First we can pass the data into the `findPerson` global function. If it does not find a person or the query data is missing we can stop the chain of jobs in place:

```javascript
// findPerson.js
export default function() {
  const { query } = this.data;
  
  if (!query || !query.firstName || !query.lastName) {
    // Stop the chain
    return Promise.resolve(false);
  }
  
  return Person
    .find({
      firstName: query.firstName,
      lastName: query.lastName,
    })
    .then(person => {
      if (!person) {
        // Stop the chain
        return Promise.resolve(false);
      }
      
      return Promise.resolve({
        person,
        ...this.data,
      });
    });
}
```

Within the next `updatePerson` job, we can grab our person data via `this.data.person` and continue with our jobs.

### Job Create - Synchronous vs Promise

All other examples have demonstrated a `Job` being created as a syncronous task. There is a reason for this, and they can also be created via promises.

#### Synchronous

Imagine we've got 200 jobs being created in a single, synchronous loop within our code. Creating a job 200 times in 
this way could potenially slow down the overall loop speed. To help solve this issue, at the end of the [Node event tick](https://github.com/nodejs/node/blob/master/doc/topics/the-event-loop-timers-and-nexttick.md) (once all synchronous code in the current job has completed), the created of the jobs is performed. This ensures the actual job logic is not 
effected by the job creation.

The jobs are also created in batches of 100 at a time.

#### Promise

A job can also be created with promises. The job will only be created once the promise is executed. This creates the job
"there and then" with no regard for the event loop. 

Various ways of using and executing the jobs can be carried out this way

```javascript
export default function() {
  Person
    .find({
      firstName: 'foo',
      lastName: 'bar',
    })
    .then(person => { 
      return Redibox.hooks.job.create('queue', {
        runs: 'someJob',
        data: person,
      });
    })
    .then(() => {
      console.log('Job created!');
      
      return Promise.resolve();
    });

  return Promise.all(promises);
}
```

> Since a job can also return a promise, the job can also just return the job creation, and any creation errors will be handled.

```javascript
export default function() {
  const promises = [];

  for (let i = 0, len = someData.length; i < len; i++) {
    const data = someData[i];
    
    promises.push(Redibox.hooks.job.create('queue', {
      runs: 'someJob',
      data,
    }));
  }

  return Promise.all(promises);
}
```
