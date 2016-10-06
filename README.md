## RediBox Job

[![Coverage Status](https://coveralls.io/repos/github/redibox/job/badge.svg?branch=master)](https://coveralls.io/github/redibox/job?branch=master)
![Downloads](https://img.shields.io/npm/dt/redibox-hook-job.svg)
[![npm version](https://img.shields.io/npm/v/redibox-hook-job.svg)](https://www.npmjs.com/package/redibox-hook-job)
[![dependencies](https://img.shields.io/david/redibox/job.svg)](https://david-dm.org/redibox/job)
[![build](https://travis-ci.org/redibox/job.svg)](https://travis-ci.org/redibox/job)
[![License](https://img.shields.io/npm/l/redibox-hook-job.svg)](/LICENSE)

The RediBox Job hook allows code to be run & distributed across many servers, whilst being highly configurable. Works well with the [Schedule](https://github.com/redibox/schedule) hook.

### Features
 - Poll free design.
 - Optional job TTL.
 - Optional job retries.
 - Optional job uniqueness.
 - Queue rate limiting - X per X seconds.
 - Standalone, Sentinel or Clustered Redis confgurations supported.
 - Stalling prevention - gracefully resumes from shutdowns / crashes.
 - Optional job statuses / progress sent via pubsub to the job creator.
 - Flexible job runner functions - your functions can return a promise or just a synchronous result.
 - Chain together jobs accross multiple queues and pass individual results onto the next job.
   - Cancel the relay at any point on any of the jobs.
   - Throttle stages of the relay by jumping to a throttled queue.
 - Single queue job handler function or individual handlers per job using dot notated paths to global functions. 
 
  
### Coming in v2
 - Capped history lists of jobs.
 - Queue stats (process times, average job waiting time etc).
 - Job tagging. Tag a job and track it throughout it's lifetime.
 - JSON API via [redibox/api](https://github.com/redibox/api).
 - Responsive UI via [redibox/ui](https://github.com/redibox/ui).
 - Delayed / scheduled jobs via [redibox/schedule](https://github.com/redibox/schedule) (v2).



### Installation

First ensure you have [RediBox](https://github.com/redibox/core) installed.

Install Job via npm: 

`npm install redibox-hook-job --save`

#### Usage

```javascript
RediBox.hooks.job.create('my-queue', {
  runs: 'sails.hooks.myhook.runJobFoo', // dot notated path to a globally accessible function
  data: {
    foo: 'bar',
  }
});

// With Sails hook
Job.create('my-queue', {
  runs: 'sails.hooks.myhook.runJobBar', // dot notated path to a globally accessible function
  data: {
    foo: 'bar',
  }
});
```

### Documentation

- [Getting Started](https://github.com/redibox/job/blob/master/docs/getting-started.md)
- [Queues](https://github.com/redibox/job/blob/master/docs/queues.md)
- [Creating Jobs](https://github.com/redibox/job/blob/master/docs/creating-jobs.md)
- [Advanced Usage](https://github.com/redibox/job/blob/master/docs/advanced-usage.md)
- [Best Practices](https://github.com/redibox/job/blob/master/docs/best-practices.md)

### License

MIT
