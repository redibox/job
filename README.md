## RediBox Job

[![Coverage Status](https://coveralls.io/repos/github/redibox/job/badge.svg?branch=master)](https://coveralls.io/github/redibox/job?branch=master)
![Downloads](https://img.shields.io/npm/dt/redibox-hook-job.svg)
[![npm version](https://img.shields.io/npm/v/redibox-hook-job.svg)](https://www.npmjs.com/package/redibox-hook-job)
[![dependencies](https://img.shields.io/david/redibox/job.svg)](https://david-dm.org/redibox/job)
[![build](https://travis-ci.org/redibox/job.svg)](https://travis-ci.org/redibox/job)
[![License](https://img.shields.io/npm/l/redibox-hook-job.svg)](/LICENSE)

The RediBox Job hook allows code to be run & distributed across many servers, whilst being highly configurable. Works well with the [Schedule](https://github.com/redibox/schedule) hook.

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
