## Advanced Usage

### Inline vs globally accessible functions

For simplicity reasons, previous examples have mostly shown the functions jobs execute as inline, e.g:

```
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

```
// firstJob.js
RediBox.hooks.job.create('queue', {
  runs: 'sails.hooks.api.request',
});
```

```
// request.js
export default function() {
  console.log(this.data);
}
```

It's also worth noting that with inline functions, the job is bound as the first argument to the function, whilst with 
a global function it's bound to it's scope, whereby the job can be accessed with `this`.

### Chaining Jobs

### Job Create - Synchronous vs Promise
