## Getting Started

Once the hook has been installed, the next step is to configure the server/environment to ensure it handles jobs correctly. 

### Configure

Within your RediBox config, create a `job` key which returns an object. This object then contains configuration options:

- **enabled** [Boolean]
  - default: `true`
  - `true`: The server will act as a consumer and provider of jobs.
  - `false`: The server can only provide/create jobs, not run them.
  
- **stallInterval** [Number]
  - default: `5000`
How often (in miliseconds) stalled jobs will be checked for.
E.g. A job being stalled can occur when a server running job(s) crashes. When the interval hits, the job will be ran by another working server.

- **keyPrefix** [String]
  - default: `job`
The namespace to store jobs under on Redis. This does not likely need to be changed.

- **queues** [Array]
   - default: `[]`
An array of queue objects. See the [queue documentation](https://github.com/redibox/job/docs/queues.md) for examples & usage.

```javascript
{
  job: {
    enabled: true,
  },
}
```

### Working with multiple environments

A common use case for working with Jobs is when your application has multiple environments. For example your product
might be have an API, which is deployed across many small micro servers. A request may come in which requires intensive code
to be run, e.g. parsing data and updating many database records. In this usecase, this would put load under the small servers.
Instead it would be wise to have a internal application with no public facing endpoint which is deployed to higher spec
servers. 

Each of the environments could now utilise RediBox to connect to the same Redis server. However, the API servers would only 
be a provider of jobs (`enabled` option set to `false`), whilst the worker servers have this option set to `true`.

Created jobs on the API would now only run on the worker servers - offloading the intensive processing to servers which are able to handle it.

This also allows for the separation code, making your applications more testable.
