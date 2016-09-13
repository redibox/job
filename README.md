## RediBox Job

The RediBox Job hook allows code to be run & distributed across many servers, whilst being highly configurable. Works well with the [Schedule](https://github.com/redibox/schedule) hook.

### Installation

First ensure you have [RediBox](https://github.com/redibox/core) installed.

Install Job via npm: 

`npm install redibox-hook-job --save`

#### Usage

```
RediBox.hooks.job.create('my-queue', {
  runs: function(job) {
    console.log('The value of foo is ' + job.data.foo);
  },
  data: {
    foo: 'bar',
  }
});

// With Sails hook
Job.create('my-queue', {
  runs: function(job) {
    console.log('The value of foo is ' + job.data.foo);
  },
  data: {
    foo: 'bar',
  }
});
```

### Documentation

- [Getting Started](https://github.com/redibox/job/docs/getting-started.md)
- [Configuring the hook](https://github.com/redibox/job/docs/configuration.md)
- [Queues](https://github.com/redibox/job/docs/queues.md)
