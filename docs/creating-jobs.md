## Creating Jobs

Generally a job can be created with minimal code, and can be created with [synchronous code or promises](https://github.com/redibox/job/blob/master/docs/advanced-usage.md#job-create---synchronous-vs-promise).
A single job can take 3 arguments.

### API

- **queue** [String]
The name of the [queue](https://github.com/redibox/job/blob/master/docs/queues.md) to assign the job to. If the queue doesn't 
exist, it'll sit in a `waiting` state until the queue appears.

- **config** [Object]

  - **id** [String]
    - required: `false`
A unique ID for this job. Leave `false` for one to be automatically created.

  - **runs** [String/Array]
    - required: `true`
A dot notated path (or array of paths) of globally accessible function(s).

  - **data** [Object/Array/Primitive]
Any data to pass along to the job, accessible via `job.data` or `this.data`.

- **options** [Object]

  - **retries** [Number]
    - default: `0`
How many times to retry the job if it fails or is rejected.

  - **unique** [Boolean]
    - default: `false`
If set to `true` any other jobs with the same [sha1sum](https://en.wikipedia.org/wiki/Sha1sum) of the `config` object
will not be created.

  - **timeout** [Number]
    - default: `6000`
In miliseconds, how long to wait for this job to complete (once started). A job timing out will cause any retries to trigger.

  - **onSuccess** [Func]
If a function is provided, a successful job sends an event via PUBSUB back to the server which created it.
The parameter of `onSuccess` is the result of whatever data was returned from the job.

  - **onFailure** [Func]
If a function is provided, the server executing the job creates an event via PUBSUB back to the server where the job failed.
The only parameter of `onFailure` is a custom object with the parameteres of `error` (a custom error message) and `timeout`
(whether the job failed due to a timeout).

### Example

```javascript
RediBox.hooks.create('my-queue', {
  runs: [
    'sails.hooks.myhook.runJobFoo',
    'sails.hooks.myhook.runJobBar',
  ],
  // Data only passed to runJobFoo
  data: {
    foo: 'bar',
  }
}, {
  retries: 2,
  timeout: 3000,
  onSuccess(result => {
    console.log('Job success!', result);
  })
  onFailure(result => {
    console.log('Did job timeout?', result.timeout);
    console.log('Error:', result.error);
  });
});
```
