## Queues

A queue is an individual channel which jobs can be assigned to. Each queue can be configured to specifically control the
amount of jobs to be processed at any one time and/or to throttle the amount of jobs allowed to be processed over a set timeframe.

Check out [Best Practices](https://github.com/redibox/job/blob/master/docs/best-practices.md#queues) for queues.

### Setup

As mentioned in the [Getting Started](https://github.com/redibox/job/blob/master/docs/getting-started.md) guide, the config 
can contain an array of queue objects.

Each queue object at minimum requires a name, with other optional configuration:

- **name** [String]
Although this can be anything, it is best to name a queue to match what the general functionality of what it's jobs will
be doing. For example `external-api-requests`, `weekly-reports` etc.

- **concurrency** [Number]
  - default: `5`
Concurrency is the amount of jobs **a single server** is able to process at any one time. A environment containing 2 servers
with a concurrency of 1 will mean only ever 2 jobs from the queue can be processed at any one time. The below gif shows an 
example of 2 servers, with a concurrency of 1:

![Worker vs Jobs](https://camo.githubusercontent.com/6bbd36f4cf5b35a0f11a96dcd2e97711ffc2fb37/68747470733a2f2f662e636c6f75642e6769746875622e636f6d2f6173736574732f313637363837312f36383130382f62626330636662302d356632392d313165322d393734662d3333393763363464633835382e676966 "Worker vs Jobs")

- **throttle** [Object]
  - default: `{}`
Throttling allows a maximum number of jobs to be processed over a set perioid of time. A handy example of this would be
when querying an external API which has request quota restrictions in place. Even with 10 servers with high concurrency, you
are still able to stop these processing more jobs once a `limit` has been hit during a set amount of `seconds`.

  - **limit** [Number]
    The maximum amount of jobs which can be processed.
  - **seconds** [Number]
    The interval of when the limit of jobs is reset.
    

#### Example

With the above in mind, a full example might look like:

```javascript
{
  job: {
    enabled: true,
    queues: [{
      name: 'internal-data-processing',
      concurrency: 15,
    }, {
      name: 'external-api',
      concurrency: 1,
      throttle: {
        limit: 60,
        seconds: 10,
      },
    }],
  },
}
```

The above example would mean external api jobs would run one at a time, at a limit of 60 every 10 seconds.

#### Restrictions

There are no limits to how many queues can be created, however from a technical point of view, each queue creates its own
internal Redis connection to perform blocking requests. Therefore bare in mind more queues equals more connections which
might need some consideration depending on your Redis environment setup.
