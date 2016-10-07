const { deepGet, isObject, getTimeStamp, tryJSONParse, isFunction } = require('redibox');
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

    // exclude async
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
    this.handlerTracker = {};
  }

  getJobById(id, cb) {
    return this.client
      .hget(this.toKey('jobs'), id, (error, job) => {
        cb(error, this.getJobInstance(job));
      });
  }

  getJobInstance(job) {
    const _job = tryJSONParse(job);
    if (!_job) return null;

    return new Job(this.core, this.name, _job.options);
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
      this.started = false;
    }
  }

  /**
   * Deletes a queue
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
   * @returns {Promise}
   */
  _getNextJob(cb) {
    this.log.verbose(`Getting next job for queue '${this.name}'.`);

    this.clients.block
      .brpoplpush(
        this.toKey('waiting'),
        this.toKey('active'),
        0,
        (error, id) => {
          if (error) {
            return cb(error);
          }

          return this.getJobById(id, cb);
        });
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

    this.options.onJobFailure(job, error, stack);

    if (isFunction(this.options.onJobFailure)) {
      this.options.onJobFailure(job, error);
    } else {

    }
  }

  /**
   * Handle a successful job completion
   * @param job
   * @param resolvedData The return value or resolved value of the jov
   * @returns {*}
   * @private
   */
  _handleJobSuccess(job, resolvedData) {
    // silently ignore any multiple calls
    if (!this.handlerTracker[job.id] || this.handlerTracker[job.id].handled) {
      return undefined;
    }

    clearTimeout(this.handlerTracker[job.id].preventStallingTimeout);
    clearTimeout(this.handlerTracker[job.id].jobTimeout);

    this.handlerTracker[job.id].handled = true;

    return this._finishJob(null, resolvedData, job);
  }

  /**
   * Handle a job promise rejection or thrown error
   * @param job
   * @param error
   * @returns {*}
   * @private
   */
  _handleJobError(job, error) {
    if (!this.handlerTracker[job.id] || this.handlerTracker[job.id].handled) {
      return undefined;
    }

    clearTimeout(this.handlerTracker[job.id].preventStallingTimeout);
    clearTimeout(this.handlerTracker[job.id].jobTimeout);

    const _error = error || new Error('Job was rejected with no error.');

    this.handlerTracker[job.id].handled = true;
    this._logJobFailure(job, _error);

    return this._finishJob(_error, null, job);
  }

  /**
   *
   * @param job
   * @returns {Promise}
   */
  _runJob(job) {
    if (!job) return Promise.resolve();

    const runs = job.options && job.options.runs && Array.isArray(job.options.runs) ? job.options.runs[0].runs : job.options.runs;
    let handler = null;

    if (runs) {
      handler = deepGet(global, runs);
    } else if (typeof this.handler === 'string') {
      handler = deepGet(global, this.handler);
    } else {
      handler = this.handler;
    }

    // Create a class handler tracker for the job
    this.handlerTracker[job.id] = {
      jobTimeout: null,
      preventStallingTimeout: null,
      handled: false,
    };

    let promiseOrRes;

    const preventStalling = () => {
      this.client.srem(this.toKey('stalling'), job.id, () => {
        if (this.handlerTracker[job.id] && !this.handlerTracker[job.id].handled) {
          this.handlerTracker[job.id].preventStallingTimeout = setTimeout(preventStalling, this.options.stallInterval / 3);
        }
      });
    };

    if (!handler) {
      return this.handleJobError(job, new Error(
        `"${job.data.runs || 'No Job Handler Specified'}" was not found. Skipping job. To fix this
             you must either specify a handler function via queue.process() or provide a valid handler
             node global path in your job options 'handler', e.g. if you had a global function in
            'global.sails.services.myservice' you'd specify the handler as 'sails.services.myservice.myHandler'.`
      ));
    }

    // start stalling monitoring
    preventStalling();

    if (job.options.timeout) {
      this.handlerTracker[job.id].jobTimeout = setTimeout(this._handleJobError.bind(this, job, new Error(`Job ${job.id} timed out (${job.options.timeout}ms)`)), job.options.timeout);
    }

    try {
      if (job.options.noBind || this.options.noBind) {
        promiseOrRes = handler(job);
      } else {
        promiseOrRes = handler.bind(job, job)(job);
      }
    } catch (e) {
      return this._handleJobError.bind(this)(job, e);
    }

    if (promiseOrRes && promiseOrRes.then && typeof promiseOrRes.then === 'function') {
      return promiseOrRes
        .then(this._handleJobSuccess.bind(this, job), this._handleJobError.bind(this, job))
        .catch(this._handleJobError.bind(this, job));
    }

    return this._handleJobSuccess.bind(this)(job, promiseOrRes);
  }

  /**
   * Creates job data to pass back through PUBSUB
   * @param error
   * @param data
   * @param job
   * @returns {{job: {id: *, worker_id: (*|String|string), status: string}, error: *, output: *}}
   * @private
   */
  _createJobEvent(error, data, job) {
    let errorMessage = null;

    if (error && error.message) {
      errorMessage = error.message;
    } else if (error) {
      errorMessage = error;
    }

    return {
      job: {
        id: job.id,
        worker: this.core.id,
        status: job.status,
        data,
      },
      error: errorMessage ? {
        message: errorMessage,
        timeout: !errorMessage ? false : errorMessage.includes('timed out'),
      } : null,
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

        this.options.onJobRetry(error, job, data);

        // TODO Move to subscribe (not to subscribeOnce)
        if (job.options._notifyRetry) {
          this.core.pubsub.publish(job.options._notifyRetry, this._createJobEvent(error, data, job));
        }

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

      this.options.onJobSuccess(job, data);
    }
  }

  _finishJob(error, resolvedData, job) {
    delete this.handlerTracker[job.id];

    // only relay to next job if user did not resolve 'false' on current job
    if (job.type === 'relay') {
      return this._finishRelayJob(error, resolvedData, job);
    }

    return this._finishSingleJob(error, resolvedData, job);
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

    // Attach job _notifyRetry to job
    if (job.options.notifyRetry) {
      job.options._notifyRetry = job.options.notifyRetry;
      delete job.options.notifyRetry;
    }

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
   * @param resolvedData
   * @param job
   * @returns {Promise}
   * @private
   */
  _finishRelayJob(error, resolvedData, job) {
    const notifications = ['notifyFailure', 'notifySuccess', 'notifyRelayJobSuccess', 'notifyRelayCancelled', 'notifyRetry'];

    // Remove notification flags for jobs so it only alerts once
    for (var i = 0; i < notifications.length; i++) {
      const notification = notifications[i];

      if (job.options[notification]) {
        job.options[`_${notification}`] = job.options[notification];
        delete job.options[notification];
      }
    }

    job.options.runs.shift();
    const nextJob = job.options.runs[0];
    const multi = this.client.multi();
    const status = error ? 'failed' : 'succeeded';

    // Emit rely Job Step successful
    // TODO Needs use of subscribe (not subscribeOnce)
    // if (status === 'succeeded' && job.options._notifyRelayJobSuccess) {
    //   this.core.pubsub.publish(job.options._notifyRelayJobSuccess, this._createJobEvent(error, resolvedData, job));
    // }

    this._updateJobStatus(error, resolvedData, job, multi);

    // If no relay error or there are more jobs
    if (!(job.options.runs.length === 0 || !!error) && resolvedData !== false) {
      job.options.data = resolvedData;

      return new Promise((resolve, reject) => {
        this.core.hooks.job.create(nextJob.queue, job.options);

        return multi.exec((errMulti) => {
          if (errMulti) return reject(errMulti);
          return resolve({ status, result: error || resolvedData });
        });
      });
    }

    if (resolvedData === false) {
      this.options.onRelayJobCancelled(error, job);
    }

    if (resolvedData === false && job.options._notifyRelayCancelled && job.type === 'relay') {
      this.core.pubsub.publish(job.options._notifyRelayCancelled, this._createJobEvent(error, resolvedData, job));
    }

    // we've just finished the last job in the relay
    // emit success or failure event if we have listeners
    if (error && job.options._notifyFailure) {
      this.core.pubsub.publish(job.options._notifyFailure, this._createJobEvent(error, resolvedData, job));
    } else if (job.options._notifySuccess) {
      this.core.pubsub.publish(job.options._notifySuccess, this._createJobEvent(error, resolvedData, job));
    }

    return new Promise((resolve, reject) => {
      return multi.exec((errMulti) => {
        if (errMulti) return reject(errMulti);
        return resolve({ status, result: error || resolvedData });
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

      return this
        ._runJob(job)
        .then(this._onLocalTickComplete.bind(this))
        .catch(this._onLocalTickComplete.bind(this));
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
