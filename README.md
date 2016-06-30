## RediBox Job Hook

High performance, robust and flexible queue/worker system powered by redis.


**DOCS ARE TODO**🙈

#### Current features

 - **Queues**. Jobs can be divided into queues you specify - no pre-determined queues such as 'PriorityQueue', just configure them the way you like it.
 - **Concurrency**. Queues can be configured to concurrently run jobs, concurrency can either be per worker or across all workers.
 - **Throttling**. Queues can be configured to throttle the number of jobs processed over a time period, e.g. 100 jobs per 10 seconds.
 - **Relay/Chained Jobs**. A relay job allows you to automatically follow a specified chain of jobs and relay the result of each job to the next job in the chain, or abort the relay mid chain with the option of sending the final result back to wherever you created the job.
 - **Jobs Anywhere**. Flexibility to create jobs anywhere, e.g. create a Job on your public api server and have your separate worker farm process it, automatically return the result right back to were you created the Job, send the result back as your api response and... profit?
   - This hook can be configured to run in 'job provider' only mode, no queues, no excess processing, just there to create jobs for somewhere else to consume.
 - **Best Practice Implementation**. We use lua scripts for atomic operations and blocking ops such as `BLPOPRPUSH` to get queued items.
   - *Surprisingly other libraries such as [Automattic/Kue](https://github.com/Automattic/kue/issues/688#issuecomment-142372665) don't do this correctly and therefore heavily impact on performance / opens them up to race conditions*.
 - **Cluster and Sentinel support**. We use `ioredis` and built this implementation with a 'cluster-first' mentality, keys are correctly tagged for slots etc.
 - **Easy Redis access inside job runners**. Job runners when called with a job are provided with the full RediBox utility belt and any hooks you configured. A job that creates a job that creates a relay job and creates another job from the relay response - why not? *(insert YO DAWG meme)*
 - **Job Uniqueness**. Jobs can be set as 'unique', upon which it's id becomes the sha1sum of the data you provided, any duplicate jobs with the same unique flag will get rejected.
 - **Job Timeouts**. Job timeouts can be set on a per job or per queue basis. Parent relay jobs are set to the timeout value provided multiplied by the number of jobs in the chain.
 - **Job Retries**. Jobs by default are not retried but this can be changed on a per job basis.
 - **Resumes on crash**. Should your node process crash then the queues will pick up and retry any jobs that were running on crash.
