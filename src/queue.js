const { deepGet, isObject, getTimeStamp, tryJSONParse } = require('redibox');
const Promise = require('bluebird');
const EventEmitter = require('eventemitter3');

const Job = require('./job');
const defaults = require('./defaults');

/**
 * TODO move to helpers
 * @param errorStack
 * @returns {Array}
 */
function trimStack(errorStack) {
  const oldStack = errorStack.split('\n');
  const stack = [];
  for (let i = 0, iLen = oldStack.length || stack.length > 19; i < iLen; i++) {
    const row = oldStack[i];

    // include private modules
    if (row.includes('@')) {
      stack.push(row);
      continue;
    }

    // exclude job module
    if (row.includes('redibox-hook-job') || row.includes('redibox/job/lib')) continue;

    // exclude bluebird
    if (row.includes('bluebird')) continue;

    // exclude waterline
    if (row.includes('waterline/lib')) continue;

    // exclude waterline
    if (row.includes('async/lib')) continue;

    // exclude timers.js
    if (row.includes('timers.js:')) continue;

    stack.push(row);
  }

  return stack;
}

module.exports = class Queue extends EventEmitter {

  /**
   *
   * @param options
   * @param core
   * @returns {Queue}
   */
  constructor(options, core) {
    super();
    this.core = core;
    this.paused = false;
    this.started = false;
    this.throttled = false;
    this.log = this.core.log;
    this.name = options.name;
    this.client = core.client;
    this.handler = options.handler || null;
    this.options = Object.assign({}, defaults.queue, options || {});
    this.core.createClient('block', this);
  }

  start() {
    if (!this.started) {
      this.paused = false;
      this.beginWorking.bind(this)();
    }
  }

  stop() {
    if (this.started) {
      this.paused = true;
    }
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
  getStatus() {
    return new Promise((resolve, reject) => {
      return this
        .client.multi()
        .llen(this.toKey('waiting'))
        .llen(this.toKey('active'))
        .scard(this.toKey('succeeded'))
        .scard(this.toKey('failed'))
        .exec((error, results) => {
          if (error) return reject(error);
          return resolve({
            waiting: results[0][1],
            active: results[1][1],
            succeeded: results[2][1],
            failed: results[3][1],
          });
        });
    });
  }

  /**
   *
   * @returns {Promise}
   */
  _getNextJob(cb) {
    this.log.verbose(`Getting next job for queue '${this.name}'.`);
    this.clients.block.brpoplpush(
      this.toKey('waiting'),
      this.toKey('active'), 0,
      (pushError, jobId) => pushError ? cb(pushError) : Job.fromId(this, jobId).then(job => cb(null, job)).catch(err => cb(err)));
  }

  /**
   *
   * @param job
   * @param jobError
   * @private
   */
  _logJobFailure(job, jobError) {
    if (this.options.mute) {
      return;
    }

    const error = typeof jobError === 'string' ? new Error(jobError) : jobError;
    const stack = trimStack(error.stack);

    // TODO allow hooking into this event rather than us doing this poop here
    if (process.env.KUBERNETES_PORT || process.env.KUBERNETES_SERVICE_HOST) {
      /* eslint no-console: 0 */
      const jobData = JSON.stringify(job.data.data || {});
      console.log(JSON.stringify({
        level: 'error',
        type: 'redibox_job_failure',
        job: {
          id: job.id.toString ? job.id.toString() : job.id,
          runs: job.data.runs,
          queue: this.name,
          data: jobData.length > 4000 ? '<! job data too large to display !>' : job.data.data,
          stack,
        },
      }));
    } else {
      this.log.error('');
      this.log.error('--------------- RDB JOB ERROR/FAILURE ---------------');
      this.log.error(`Job: ${job.data.runs}` || this.name);
      error.stack = stack.join('\n');
      this.log.error(error);
      this.log.error('------------------------------------------------------');
      this.log.error('');
    }
  }

  /**
   *
   * @param job
   * @returns {Promise}
   */
  _runJob(job) {
    if (!job || !job.data) return Promise.resolve();
    // TODO Clean this up
    const runs = job.data && job.data.runs && Array.isArray(job.data.runs) ? job.data.runs[0] : job.data.runs;
    let handler = null;

    if (runs) {
      handler = deepGet(global, runs);
    } else if (typeof this.handler === 'string') {
      handler = deepGet(global, this.handler);
    } else {
      handler = this.handler;
    }

    let preventStallingTimeout;
    let handled = false;
    let promiseOrRes;

    // Handle an "OK" response from the promise
    const handleOK = (data) => {
      // silently ignore any multiple calls
      if (handled) return undefined;

      clearTimeout(preventStallingTimeout);
      handled = true;

      // set the data back to internal data
      if (job._internalData) {
        job.data = job._internalData;
      }

      // only relay to next job if user did not resolve 'false' on current job
      if (job.type === 'relay' && data !== false) return this._finishRelayJob(null, data, job);
      return this._finishSingleJob(null, data, job);
    };

    // Handle any errors returned
    const handleError = (jobError) => {
      clearTimeout(preventStallingTimeout);

      const _error = jobError || new Error('Job was rejected with no error.');
      // silently ignore any multiple calls
      if (handled) {
        return undefined;
      }

      handled = true;

      // set the data back to internal job data
      if (job._internalData) {
        job.data = job._internalData;
      }

      this._logJobFailure(job, _error);

      if (job.type === 'relay') return this._finishRelayJob(_error, null, job);
      return this._finishSingleJob(_error, null, job);
    };

    const preventStalling = () => {
      this.client.srem(this.toKey('stalling'), job.id, () => {
        if (!handled) {
          preventStallingTimeout = setTimeout(preventStalling, this.options.stallInterval / 3);
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

    // start stalling monitoring
    preventStalling();

    job._internalData = job.data;

    job.data = job.data.data || job.data;

    if (job.options.timeout) {
      setTimeout(handleError.bind(null, Error(`Job ${job.id} timed out (${job.options.timeout}ms)`)), job.options.timeout);
    }

    try {
      if (job.options.noBind || this.options.noBind) {
        promiseOrRes = handler(job);
      } else {
        promiseOrRes = handler.bind(job, job)(job);
      }
    } catch (e) {
      return handleError(e);
    }

    if (promiseOrRes && promiseOrRes.then && typeof promiseOrRes.then === 'function') {
      return promiseOrRes.then(handleOK, handleError).catch(handleError);
    }

    return handleOK(promiseOrRes);
  }

  /**
   *
   * @param error
   * @param data
   * @param job
   * @returns {{job: {id: *, worker_id: (*|String|string), status: string}, error: *, output: *}}
   * @private
   */
  _createJobEvent(error, data, job) {
    return {
      job: Object.assign({
        id: job.id,
        worker_id: this.core.id,
        status: error ? 'failed' : 'succeeded',
      }, job.data),
      error,
      output: data,
    };
  }

  /**
   *
   * @param error
   * @param data
   * @param job
   * @param multi
   * @private
   */
  _updateJobStatus(error, data, job, multi) {
    const status = error ? 'failed' : 'succeeded';

    multi.lrem(this.toKey('active'), 0, job.id);
    multi.srem(this.toKey('stalling'), job.id);

    if (status === 'failed') {
      if (job.options.retries > 0) {
        job.options.retries -= 1;
        job.status = 'retrying';
        multi.hset(this.toKey('jobs'), job.id, job.toData());
        multi.lpush(this.toKey('waiting'), job.id);
      } else {
        job.status = 'failed';
        multi.hdel(this.toKey('jobs'), job.id);

        // TODO track failures and their data somewhere else for reviewing
        // multi.hset(this.toKey('jobs'), job.id, job.toData());
        // multi.sadd(this.toKey('failed'), job.id);
      }
    } else {
      job.status = 'succeeded';
      multi.hdel(this.toKey('jobs'), job.id);

      // TODO track successes and their data somewhere else for reviewing
      // multi.hset(this.toKey('jobs'), job.id, job.toData());
      // multi.sadd(this.toKey('succeeded'), job.id);

      // TODO allow hooking into this event rather than us doing this poop here
      if (process.env.KUBERNETES_PORT || process.env.KUBERNETES_SERVICE_HOST) {
        /* eslint no-console: 0 */
        const jobData = JSON.stringify(job.data.data || {});
        console.log(JSON.stringify({
          level: 'verbose',
          type: 'redibox_job_completed',
          job: {
            id: job.id.toString ? job.id.toString() : job.id,
            runs: job.data.runs,
            queue: this.name,
            status: job.status,
            data: jobData.length > 4000 ? '<! job data too large to display !>' : job.data.data,
          },
        }));
      }
    }
  }

  /**
   *
   * @param error
   * @param data
   * @param job
   * @returns {Promise}
   */
  _finishSingleJob(error, data, job) {
    const multi = this.client.multi();
    const status = error ? 'failed' : 'succeeded';
    this._updateJobStatus(error, data, job, multi);

    // emit success or failure event if we have listeners
    if (error && job.options.notifyFailure) {
      this.core.pubsub.publish(job.options.notifyFailure, this._createJobEvent(error, data, job));
    } else if (job.options.notifySuccess) {
      this.core.pubsub.publish(job.options.notifySuccess, this._createJobEvent(error, data, job));
    }

    return new Promise((resolve, reject) => {
      multi.exec((errMulti) => {
        if (errMulti) return reject(errMulti);
        return resolve({ status, result: error || data });
      });
    });
  }

  /**
   * Completes a multi job or continues to the next stage.
   * @param error
   * @param data
   * @param job
   * @returns {Promise}
   * @private
   */
  _finishRelayJob(error, data, job) {
    let nextQueue = this.name;
    const nextJob = job.data.runs[0];
    const multi = this.client.multi();
    const currentJob = job.data.runs.shift();
    const status = error ? 'failed' : 'succeeded';

    // keep a record of the first job in this relay instance
    if (!job.data.initialJob) {
      job.data.initialJob = tryJSONParse(job.toData());
    }

    // keep a record of the first queue in this relay instance
    if (!job.data.initialQueue) {
      job.data.initialQueue = this.name;
    }

    this._updateJobStatus(error, data, job, multi);

    // check if we need to relay to another job
    if (!(job.data.runs.length === 0 || !!error)) {
      if (isObject(nextJob)) {
        nextQueue = nextJob.queue;
        job.data.runs[0] = nextJob.runs;
      } else if (job.data.initialQueue) {
        nextQueue = job.data.initialQueue;
      }

      // add some debug data for the next job
      // so it can tell where the relay originated from
      job.data.from_job = currentJob;
      job.data.from_queue = this.name;
      job.data.from_timestamp = getTimeStamp();
      // relay resolved data
      job.data.data = data;

      return new Promise((resolve, reject) => {
        return this.core.hooks.job.create(nextQueue, job.data).then(() => {
          multi.exec((errMulti) => {
            if (errMulti) return reject(errMulti);
            return resolve({ status, result: error || data });
          });
        });
      });
    }

    // we've just finished the last job in the relay
    // emit success or failure event if we have listeners
    if (error && job.data.initialJob.options.notifyFailure) {
      this.core.pubsub.publish(job.data.initialJob.options.notifyFailure, this._createJobEvent(error, data, job));
    } else if (job.data.initialJob.options.notifySuccess) {
      this.core.pubsub.publish(job.data.initialJob.options.notifySuccess, this._createJobEvent(error, data, job));
    }

    return new Promise((resolve, reject) => {
      return multi.exec((errMulti) => {
        if (errMulti) return reject(errMulti);
        return resolve({ status, result: error || data });
      });
    });
  }

  /**
   *
   * @private
   */
  _onLocalTickComplete() {
    this.running -= 1;
    this.queued -= 1;

    if (!this.options.throttle) return setImmediate(this._queueTick.bind(this));

    return this.client.throttle(
      this.toKey('throttle'),
      this.options.throttle.limit,
      this.options.throttle.seconds
    ).then((throttle) => {
      const shouldThrottle = throttle[0] === 1;

      if (!shouldThrottle) {
        this.throttled = false;
        return setImmediate(this._queueTick.bind(this));
      }

      this.throttled = true;
      const timeRemaining = (throttle[2] === 0 ? 1 : throttle[2]);
      this.log.verbose(`'${this.name}' queue  reached it's throttle limit, resuming in ${timeRemaining} seconds.`);
      return setTimeout(this._queueTick.bind(this), timeRemaining * 1000);
    }).catch(this._queueTick.bind(this));
  }

  /**
   *
   * @param error
   * @private
   */
  _onLocalTickError(error) {
    this.queued -= 1;
    this.log.error(error);
    setImmediate(this._queueTick.bind(this));
  }

  /**
   *
   * @returns {*}
   * @private
   */
  _queueTick() {
    if (this.paused || !this.options.enabled) {
      return undefined;
    }

    this.queued += 1;

    return this._getNextJob((err, job) => {
      if (err) return this._onLocalTickError.bind(this)(err);
      this.running += 1;

      // queue more jobs if within limit
      if ((this.running + this.queued) < this.options.concurrency) {
        // concurrency is a little pointless right now if we're throttling jobs
        if (!this.options.throttle) setImmediate(this._queueTick.bind(this));
      }

      return this._runJob(job).then(this._onLocalTickComplete.bind(this)).catch(this._onLocalTickComplete.bind(this));
    });
  }

  /**
   *
   * @private
   */
  _restartProcessing() {
    this.clients.block.once('ready', this._queueTick.bind(this));
  }

  /**
   * Start the queue.
   */
  beginWorking() {
    if (this.started || !this.options.enabled) {
      this.log.info(`Queue ${this.name} is currently disabled.`);
      return;
    }

    this.queued = 0;
    this.running = 0;
    this.started = true;

    this.log.verbose(`Queue '${this.name}' - started with a concurrency of ${this.options.concurrency}.`);

    this.clients.block.once('error', this._restartProcessing.bind(this));
    this.clients.block.once('close', this._restartProcessing.bind(this));

    this.checkStalledJobs.bind(this)();
    this._queueTick.bind(this)();
  }

  /**
   *
   * @returns {*}
   */
  checkStalledJobs() {
    this.log.verbose(`${this.name}: checkStalledJobs`);
    this.client.checkstalledjobs(
      this.toKey('stallTime'),
      this.toKey('stalling'),
      this.toKey('waiting'),
      this.toKey('active'),
      getTimeStamp(),
      this.options.stallInterval, () => {
        if (!this.options.enabled || this.paused) return;
        setTimeout(this.checkStalledJobs.bind(this), this.options.stallInterval);
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
  toEventName(eventName) {
    return `queue:${this.name}:${eventName}`;
  }
};
