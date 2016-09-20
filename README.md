## RediBox Job

The RediBox Job hook allows code to be run & distributed across many servers, whilst being highly configurable. Works well with the [Schedule](https://github.com/redibox/schedule) hook.

### Installation

First ensure you have [RediBox](https://github.com/redibox/core) installed.

Install Job via npm: 

`npm install redibox-hook-job --save`

#### Usage

```javascript
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

- [Getting Started](https://github.com/redibox/job/blob/master/docs/getting-started.md)
- [Queues](https://github.com/redibox/job/blob/master/docs/queues.md)
- [Advanced Usage](https://github.com/redibox/job/blob/master/docs/advanced-usage.md)
- [Best Practices](https://github.com/redibox/job/blob/master/docs/best-practices.md)

### License

MIT
