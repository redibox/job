import Job from './job';
import Promise from 'bluebird';
import defaults from './defaults';
import EventEmitter from 'eventemitter3';
import { deepGet, isObject, getTimeStamp, tryJSONParse } from 'redibox';

export default class Queue extends EventEmitter {

  /**
   *
   * @param options
   * @param core
   * @returns {Queue}
   */
  constructor(options, core) {
    super();
    this.jobs = {};
    this.core = core;
    this.client = core.client;
    this.paused = false;
    this.started = false;
    this.log = this.core.log;
    this.name = options.name;
    this.handler = options.handler || null;
    this.options = Object.assign({}, defaults.queue, options || {});
    this.core.createClient('block', this).then(() => {
      this.log.verbose(`Blocking client for queue '${this.name}' is ready. Starting queue processor.`);
      this.process(this.options.concurrency);
    });
  }

  /**
   *
   * @returns {*}
   */
  destroy() {
    const keys = [
      'id', 'jobs', 'stallTime', 'stalling', 'waiting', 'active', 'succeeded', 'failed',
    ].map(key => this.toKey(key));
    return this.client.del(...keys);
  }

  /**
   *
   * @returns {Promise}
   */
  checkHealth() {
    return this
      .client.multi()
      .llen(this.toKey('waiting'))
      .llen(this.toKey('active'))
      .scard(this.toKey('succeeded'))
      .scard(this.toKey('failed'))
      .then(results => { /* eslint arrow-body-style: 0 */
        return {
          waiting: results[0][1],
          active: results[1][1],
          succeeded: results[2][1],
          failed: results[3][1],
        };
      });
  }

  // /**
  //  *
  //  * @param data
  //  * @returns {Job}
  //  */
  // createJob(data) {
  //   return new Job(this, null, data);
  // }

  /**
   *
   * @param jobId
   * @returns {Promise}
   */
  // getJob(jobId) {
  //   return new Promise((resolve, reject) => {
  //     if (jobId in this.jobs) {
  //       // we have the job locally
  //       return resolve(this.jobs[jobId]);
  //     }
  //     // not local so gather from redis
  //     Job.fromId(this, jobId)
  //        .then(job => {
  //          this.jobs[jobId] = job;
  //          return resolve(job);
  //        }).catch(reject);
  //   });
  // }

  /**
   *
   * @returns {Promise}
   */
  _getNextJob() {
    this.log.verbose(`Getting next job for queue '${this.name}'.`);
    return this.clients.block.brpoplpush(
      this.toKey('waiting'),
      this.toKey('active'), 0
    ).then(jobId =>
      Job.fromId(this, jobId).then(job => {
        return job;
      })
    );
  }

  /**
   *
   * @param job
   * @returns {Promise}
   */
  _runJob(job) {
    if (!job || !job.data) return Promise.resolve();
    const runs = job.data && job.data.runs && Array.isArray(job.data.runs) ? job.data.runs[0] : job.data.runs;
    const handler = (typeof this.handler === 'string' ?
        deepGet(global, this.handler) : this.handler) || deepGet(global, runs);

    let preventStallingTimeout;
    let handled = false;

    // Handle an "OK" response from the promise
    const handleOK = data => {
      // silently ignore any multiple calls
      if (handled) {
        return void 0;
      }

      clearTimeout(preventStallingTimeout);
      handled = true;

      // set the data back to internal data
      if (job._internalData) {
        job.data = job._internalData;
      }

      if (job.data.runs && Array.isArray(job.data.runs) && data !== false) {
        return this._finishMultiJob(null, data, job);
      }

      return this._finishSingleJob(null, data, job);
    };

    // Handle any errors returned
    const handleError = err => {
      clearTimeout(preventStallingTimeout);

      // silently ignore any multiple calls
      if (handled) {
        return void 0;
      }

      handled = true;

      // set the data back to internal job data
      if (job._internalData) {
        job.data = job._internalData;
      }

      // only log the error if no notifyFailure pubsub set
      if ((!job.data.initialJob || !job.data.initialJob.options.notifyFailure) && !Array.isArray(job.data.runs)) {
        this.log.error('');
        this.log.error('--------------- RDB JOB ERROR/FAILURE ---------------');
        this.log.error(`Job: ${job.data.runs}` || this.name);
        if (err.stack) {
          err.stack.split('\n').forEach(error => {
            this.log.error(error);
          });
        }
        this.log.error(err);
        this.log.error('------------------------------------------------------');
        this.log.error('');
      }

      if (job.data.runs && Array.isArray(job.data.runs)) {
        return this._finishMultiJob(err, null, job);
      }
      return this._finishSingleJob(err, null, job);
    };

    const preventStalling = () => {
      this.client.srem(this.toKey('stalling'), job.id, () => {
        if (!handled) {
          preventStallingTimeout = setTimeout(preventStalling, this.options.stallInterval / 2);
        }
      });
    };

    if (!handler) {
      return handleError(
        new Error(
          `"${job.data.runs || 'No Job Handler Specified'}" was not found. Skipping job. To fix this
             you must either specify a handler function via queue.process() or provide a valid handler
             node global path in your job options 'handler', e.g. if you had a global function in
            'global.sails.services.myservice' you'd specify the handler as 'sails.services.myservice.myHandler'.`
        )
      );
    }

    preventStalling(); // start stalling monitor

    job._internalData = job.data;
    job.data = job.data.data || job.data;

    if (job.options.timeout) {
      const msg = `Job ${job.id} timed out (${job.options.timeout}ms)`;
      setTimeout(handleError.bind(null, Error(msg)), job.options.timeout);
    }

    if (job.options.noBind || this.options.noBind) {
      return handler(job).then(handleOK, handleError).catch(handleError);
    }

    return handler.bind(job, job)(job).then(handleOK, handleError).catch(handleError);
  }

  /**
   * Completes a multi job or continues to the next stage.
   * @param error
   * @param data
   * @param job
   * @returns {Promise}
   * @private
   */
  _finishMultiJob(error, data, job) {
    delete this.jobs[job.id];

    return new Promise((resolve, reject) => {
      const status = error ? 'failed' : 'succeeded';

      const multi = this.client.multi();
      multi.lrem(this.toKey('active'), 0, job.id);
      multi.srem(this.toKey('stalling'), job.id);

      const event = {
        job: {
          id: job.id,
          worker_id: this.core.id,
          status,
          ...job.data,
        },
        error,
        output: data,
      };

      const currentJob = job.data.runs.shift();
      const nextJob = job.data.runs[0];
      let nextQueue = this.name;

      // keep a record of the first job in this relay instance
      // ssssh JSON ;p
      if (!job.data.initialJob) {
        job.data.initialJob = tryJSONParse(job.toData());
      }

      // keep a record of the first queue in this relay instance
      if (!job.data.initialQueue) {
        job.data.initialQueue = this.name;
      }

      if (status === 'failed') {
        if (job.options.retries > 0) {
          job.options.retries = job.options.retries - 1;
          job.status = 'retrying';
          event.event = 'retrying';
          multi.hset(this.toKey('jobs'), job.id, job.toData());
          multi.lpush(this.toKey('waiting'), job.id);
        } else {
          job.status = 'failed';
          multi.hset(this.toKey('jobs'), job.id, job.toData());
          multi.sadd(this.toKey('failed'), job.id);
        }
      } else {
        job.status = 'succeeded';
        multi.hset(this.toKey('jobs'), job.id, job.toData());
        multi.hdel(this.toKey('jobs'), job.id);
        // multi.sadd(this.toKey('succeeded'), job.id); // TODO LOG JOBS
      }

      // check if we need to relay to another job
      if (!(job.data.runs.length === 0 || !!error)) {
        if (isObject(nextJob)) {
          nextQueue = nextJob.queue;
          job.data.runs[0] = nextJob.runs;
        } else if (job.data.initialQueue) {
          nextQueue = job.data.initialQueue;
        }

        // add some debug data for the next job
        // so it can tell where its call originated from
        job.data.from_job = currentJob;
        job.data.from_queue = this.name;
        job.data.from_timestamp = getTimeStamp();
        job.data.data = data;

        return this.core.hooks.job.create(nextQueue, job.data).then(() => {
          multi.exec(errMulti => {
            if (errMulti) return reject(errMulti);
            return resolve({ status, result: error || data });
          });
        });
      }

      // we've just finished the last job in the relay
      if (event.error) {
        if (job.data.initialJob.options.notifyFailure) {
          this.core.pubsub.publish(job.data.initialJob.options.notifyFailure, event);
        }
      } else if (job.data.initialJob.options.notifySuccess) {
        this.core.pubsub.publish(job.data.initialJob.options.notifySuccess, event);
      }

      return multi.exec(errMulti => {
        if (errMulti) return reject(errMulti);
        return resolve({ status, result: error || data });
      });
    });
  }

  /**
   *
   * @param error
   * @param data
   * @param job
   * @returns {Promise}
   */
  _finishSingleJob(error, data, job) {
    delete this.jobs[job.id];

    return new Promise((resolve, reject) => {
      const status = error ? 'failed' : 'succeeded';
      const multi = this.client.multi();

      multi.lrem(this.toKey('active'), 0, job.id);
      multi.srem(this.toKey('stalling'), job.id);

      if (status === 'failed') {
        if (job.options.retries > 0) {
          job.options.retries = job.options.retries - 1;
          job.status = 'retrying';
          multi.hset(this.toKey('jobs'), job.id, job.toData());
          multi.lpush(this.toKey('waiting'), job.id);
        } else {
          job.status = 'failed';
          multi.hset(this.toKey('jobs'), job.id, job.toData());
          multi.sadd(this.toKey('failed'), job.id);
        }
      } else {
        job.status = 'succeeded';
        multi.hset(this.toKey('jobs'), job.id, job.toData());
        multi.hdel(this.toKey('jobs'), job.id);
        // multi.sadd(this.toKey('succeeded'), job.id); // TODO LOG JOBS
      }

      if (error && (job.options.notifySuccess || job.notifyFailure)) {
        const event = {
          job: {
            id: job.id,
            worker_id: this.core.id,
            status,
            ...job.data,
          },
          error,
          output: data,
        };
        if (job.options.notifyFailure) this.core.pubsub.publish(job.options.notifyFailure, event);
        if (job.options.notifySuccess) this.core.pubsub.publish(job.options.notifySuccess, event);
      }

      multi.exec(errMulti => {
        if (errMulti) return reject(errMulti);
        return resolve({ status, result: error || data });
      });
    });
  }

  /**
   *
   * @returns {*}
   * @private
   */
  _jobTick = () => {
    if (this.paused || !this.options.enabled) {
      return void 0;
    }

    this.queued++;

    return this._getNextJob().then(job => {
      this.running++;

      if ((this.running + this.queued) < this.concurrency) {
        setImmediate(this._jobTick);
      }

      this._runJob(job).then(() => {
        this.running--;
        this.queued--;
        setImmediate(this._jobTick);
      }).catch(() => {
        this.running--;
        this.queued--;
        setImmediate(this._jobTick);
      });
    }).catch(error => {
      this.log.error(error);
      setImmediate(this._jobTick);
    });
  };

  /**
   *
   * @private
   */
  _restartProcessing = () => {
    this.clients.block.once('ready', this._jobTick);
  };

  /**
   * Start the queue.
   * @param concurrency
   */
  process(concurrency = 1) {
    if (this.started || !this.options.enabled) {
      this.log.info(`Queue ${this.name} is currently disabled.`);
      return void 0;
    }

    this.started = true;
    this.running = 0;
    this.queued = 0;
    this.concurrency = concurrency;

    this.log.verbose(`Queue '${this.name}' - started with a concurrency of ${this.concurrency}.`);

    this.clients.block.once('error', this._restartProcessing);
    this.clients.block.once('close', this._restartProcessing);

    this.checkStalledJobs().then(() => {
      this.log.verbose('checkStalledJobs completed');
    }).catch(() => {
    });

    return this._jobTick();
  }

  /**
   *
   * @returns {*}
   */
  checkStalledJobs() {
    this.log.verbose('checkStalledJobs');
    return this.client.checkstalledjobs(
      this.toKey('stallTime'),
      this.toKey('stalling'),
      this.toKey('waiting'),
      this.toKey('active'),
      getTimeStamp(),
      this.options.stallInterval
    ).then(() => {
      if (!this.options.enabled || this.paused) {
        return Promise.resolve();
      }

      return Promise.delay(this.options.stallInterval).then(this.checkStalledJobs);
    });
  }

  /**
   *
   * @param str
   * @returns {*}
   */
  toKey(str) {
    if (this.core.cluster.isCluster()) {
      return `${this.options.keyPrefix}:{${this.name}}:${str}`;
    }
    return `${this.options.keyPrefix}:${this.name}:${str}`;
  }

  /**
   * Add the eventPrefix to an event name
   * @param eventName
   * @returns {string}
   */
  toEventName = eventName => `queue:${this.name}:${eventName}`;
}
