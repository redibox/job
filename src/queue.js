const Promise = require('bluebird');
const EventEmitter = require('events');
const { deepGet, getTimeStamp, tryJSONStringify, tryJSONParse, isFunction } = require('redibox');

const defaults = require('./defaults');

const notifications = ['notifyFailure', 'notifySuccess', 'notifyRelayStepSuccess', 'notifyRelayStepCancelled', 'notifyRetry'];


/**
 *
 * @param job
 */
function removeNotificationFlags(job) {
  var i = 0;
  // Remove notification flags for jobs so it only alerts once
  for (i; i < notifications.length; i++) {
    const notification = notifications[i];
    if (job.options[notification]) {
      job.options[`_${notification}`] = job.options[notification];
      delete job.options[notification];
    }
  }
}

/**
 *
 * @param fn
 * @returns {{}}
 */
function tryCatcher(fn) {
  const result = {};
  try {
    result.value = fn();
  } catch (e) {
    result.error = e;
  }
  return result;
}

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

class Queue extends EventEmitter {

  /**
   *
   * @param options
   * @param core
   * @returns {Queue}
   */
  constructor(options, core) {
    super();
    this.core = core;
    this.hook = core.hooks.job;
    this.paused = false;
    this.started = false;
    this.throttled = false;
    this.log = this.core.log;
    this.name = options.name;
    this.client = core.client;
    this.handler = options.handler || null;
    if (typeof this.handler === 'string') {
      this.handler = deepGet(global, this.handler) || options.handler;
    }
    this.options = Object.assign({}, defaults.queue, options || {});
    this.core.createClient('block', this);
    this.handlerTracker = {};
  }

  _createStatsHash() {
    this.client.hsetnx(`${this.toKey(this.name)}:stats`)
  }

  /**
   * Returns a job by ID from Redis
   * @param id
   * @param cb
   * @returns {*}
   */
  getJobById(id, cb) {
    return this.client
      .hget(this.toKey('jobs'), id, (error, job) => {
        const _job = tryJSONParse(job);

        if (!_job) {
          return cb(error, null);
        }

        _job.core = this.core;
        _job.data = _job.options.data;

        // attach virtual methods
        _job.setProgress = this._setJobProgress.bind(this, _job);
        _job.retry = this._retryJob.bind(this, _job);
        return cb(error, _job);
      });
  }

  /**
   * Start the queue
   */
  start() {
    if (!this.started) {
      this.paused = false;
      this.beginWorking.bind(this)();
    }
  }

  /**
   * Stop/pause the queue
   */
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
            cb(error);
          } else {
            this.getJobById(id, cb);
          }
        });
  }

  /**
   *
   * @param job
   * @param jobError
   * @private
   */
  _logJobFailure(job, jobError) {
    const error = typeof jobError === 'string' ? new Error(jobError) : jobError;
    const stack = trimStack(error.stack);
    this.hook._onJobFailure(job, error, stack);
    this.emit('onJobFailure', { queue: this.name, job, error, stack });
  }

  /**
   * Handle a successful job completion
   * @param job
   * @param nextTick
   * @param resolvedData The return value or resolved value of the jov
   * @returns {*}
   * @private
   */
  _handleJobSuccess(job, nextTick, resolvedData) {
    if (this.handlerTracker[job.id] && !this.handlerTracker[job.id].handled) {
      clearTimeout(this.handlerTracker[job.id].preventStallingTimeout);
      clearTimeout(this.handlerTracker[job.id].jobTimeout);
      this.handlerTracker[job.id].handled = true;
      this._finishJob(null, resolvedData, job, nextTick);
    }
  }

  /**
   * Handle a job promise rejection or thrown error
   * @param job
   * @param nextTick
   * @param error
   * @returns {*}
   * @private
   */
  _handleJobError(job, nextTick, error) {
    if (this.handlerTracker[job.id] && !this.handlerTracker[job.id].handled) {
      clearTimeout(this.handlerTracker[job.id].preventStallingTimeout);
      clearTimeout(this.handlerTracker[job.id].jobTimeout);
      const _error = error || new Error('Job was rejected with no error.');
      this.handlerTracker[job.id].handled = true;
      this._logJobFailure(job, _error);
      this._finishJob(_error, null, job, nextTick);
    }
  }

  /**
   *
   * @param job
   * @param nextTick
   * @returns {Promise}
   */
  _runJob(job, nextTick) {
    if (!job) {
      return nextTick();
    }

    const handleErrorBound = this._handleJobError.bind(this, job, nextTick);
    const handleSuccessBound = this._handleJobSuccess.bind(this, job, nextTick);
    const runs = job.type === 'relay' ? job.options.runs[0].runs : job.options.runs;

    // Create a class handler tracker for the job
    this.handlerTracker[job.id] = {
      jobTimeout: null,
      preventStallingTimeout: null,
      handled: false,
    };

    // get the handler
    let handler = null;
    if (runs) {
      handler = deepGet(global, runs);
    } else {
      handler = typeof this.handler === 'string' ? deepGet(global, this.handler) : this.handler;
    }

    if (!handler) {
      return handleErrorBound(new Error(
        `"${job.options.runs || 'No Job Handler Specified'}" was not found. Skipping job. To fix this
             you must either specify a handler function via 'queue.handler' or provide a valid handler
             node global path in your job options 'handler', e.g. if you had a global function in
            'global.sails.services.myservice' you'd specify the handler as 'sails.services.myservice.myHandler'.`
      ));
    }

    if (!isFunction(handler)) {
      return handleErrorBound(new Error(`Job handler for job ${job.id} is not a function.`));
    }

    // start stalling monitoring
    this._preventJobStalling(job.id);

    // watch for job timeout if option set
    if (job.options.timeout) {
      this._detectJobTimeout(job, nextTick);
    }

    let promiseOrRes;

    if (job.options.noBind || this.options.noBind) {
      promiseOrRes = tryCatcher(handler.bind(null, job));
    } else {
      promiseOrRes = tryCatcher(handler.bind(job, job));
    }

    if (promiseOrRes.error) {
      return handleErrorBound(promiseOrRes.error);
    }

    // try via promise if promise detected
    promiseOrRes = promiseOrRes.value;
    if (promiseOrRes && promiseOrRes.then && typeof promiseOrRes.then === 'function') {
      return promiseOrRes.then(handleSuccessBound, handleErrorBound).catch(handleErrorBound);
    }
    // return synchronous result
    return handleSuccessBound(promiseOrRes);
  }

  /**
   *
   * @param jobId
   * @private
   */
  _preventJobStalling(jobId) {
    this.client.srem(this.toKey('stalling'), jobId, () => {
      if (this.handlerTracker[jobId] && !this.handlerTracker[jobId].handled) {
        this.handlerTracker[jobId].preventStallingTimeout = setTimeout(this._preventJobStalling.bind(this, jobId), this.options.stallInterval / 3);
      }
    });
  }

  /**
   *
   * @param job
   * @param nextTick
   * @private
   */
  _detectJobTimeout(job, nextTick) {
    this.handlerTracker[job.id].jobTimeout = setTimeout(
      this._handleJobError.bind(this, job, nextTick, new Error(`Job ${job.id} timed out (${job.options.timeout}ms)`)),
      job.options.timeout
    );
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
        progress: job.progress,
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
   * @param job
   * @private
   */
  _jobToData(job) {
    delete job.core;
    delete job.data;
    delete job.setProgress;
    return tryJSONStringify(job);
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
    let status = error ? 'failed' : 'succeeded';

    if (data === 'retry') {
      status = 'failed';
      job.options.retries = job.options.retries ? job.options.retries++ : 1;
    }

    multi.lrem(this.toKey('active'), 0, job.id);
    multi.srem(this.toKey('stalling'), job.id);

    if (status === 'failed') {
      if (job.options.retries > 0) {
        job.options.retries -= 1;

        job.status = 'retrying';

        this.hook._onJobRetry(error, job, data);

        // TODO Move to subscribe (not to subscribeOnce)
        if (job.options._notifyRetry) {
          this.core.pubsub.publish(job.options._notifyRetry, this._createJobEvent(error, data, job));
        }

        multi.hset(this.toKey('jobs'), job.id, this._jobToData(job));
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
    }

    return job.status;
  }

  /**
   *
   * @param error
   * @param resolvedData
   * @param job
   * @param nextTick
   * @returns {Promise}
   * @private
   */
  _finishJob(error, resolvedData, job, nextTick) {
    delete this.handlerTracker[job.id];
    // only relay to next job if user did not resolve 'false' on current job
    if (job.type === 'relay') {
      return this._finishRelayJob(error, resolvedData, job, nextTick);
    }
    return this._finishSingleJob(error, resolvedData, job, nextTick);
  }

  /**
   *
   * @param error
   * @param data
   * @param job
   * @param nextTick
   * @returns {Promise}
   */
  _finishSingleJob(error, data, job, nextTick) {
    const multi = this.client.multi();

    // Attach job _notifyRetry to job
    if (job.options.notifyRetry) {
      job.options._notifyRetry = job.options.notifyRetry;
      delete job.options.notifyRetry;
    }

    const status = this._updateJobStatus(error, data, job, multi);

    if (status === 'succeeded') {
      this.hook._onJobSuccess(job, data);
      this.emit('onJobSuccess', { queue: this.name, job, result: data });
    }

    // emit success or failure event if we have listeners
    if (error && job.options.notifyFailure && job.status !== 'retrying') {
      this.core.pubsub.publish(job.options.notifyFailure, this._createJobEvent(error, data, job));
    } else if (!error && job.options.notifySuccess && job.status !== 'retrying') {
      this.core.pubsub.publish(job.options.notifySuccess, this._createJobEvent(error, data, job));
    }

    multi.exec(nextTick);
  }

  /**
   * Completes a multi job or continues to the next stage.
   * @param error
   * @param resolvedData
   * @param job
   * @param nextTick
   * @returns {Promise}
   * @private
   */
  _finishRelayJob(error, resolvedData, job, nextTick) {
    removeNotificationFlags(job);
    job.options.runs.shift();
    const nextJob = job.options.runs[0];
    const multi = this.client.multi();
    const status = this._updateJobStatus(error, resolvedData, job, multi)

    if (status === 'succeeded') {
      this.hook._onRelayStepSuccess(error, job);
      if (job.options._notifyRelayStepSuccess) {
        this.core.pubsub.publish(job.options._notifyRelayStepSuccess, this._createJobEvent(error, resolvedData, job));
      }
    }

    // if no relay error or there are more jobs
    if (!(job.options.runs.length === 0 || !!error) && resolvedData !== false) {
      job.options.data = resolvedData;
      this.core.hooks.job.create(nextJob.queue, job.options);
      return multi.exec(nextTick);
    }

    if (resolvedData !== false && status === 'succeeded') {
      this.hook._onJobSuccess(job, resolvedData);
    }

    if (resolvedData === false) {
      this.hook._onRelayStepCancelled(error, job);
    }

    if (resolvedData === false && job.options._notifyRelayStepCancelled && job.type === 'relay') {
      this.core.pubsub.publish(job.options._notifyRelayStepCancelled, this._createJobEvent(error, resolvedData, job));
    }

    // we've just finished the last job in the relay
    // emit success or failure event if we have listeners
    if (error && job.options._notifyFailure) {
      this.core.pubsub.publish(job.options._notifyFailure, this._createJobEvent(error, resolvedData, job));
    } else if (job.options._notifySuccess) {
      this.core.pubsub.publish(job.options._notifySuccess, this._createJobEvent(error, resolvedData, job));
    }

    return multi.exec(nextTick);
  }

  /**
   *
   * @private
   */
  _onLocalTickComplete() {
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
      return null;
    }

    return this._getNextJob((err, job) => {
      if (err) return this._onLocalTickError.bind(this)(err);
      // TODO re-do concurrency
      process.nextTick(this._queueTick.bind(this));
      return this._runJob(job, this._onLocalTickComplete.bind(this));
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
   * Update the job progress & notifiy any event listeners
   * @param job
   * @param value
   * @param data
   * @private
   */
  _setJobProgress(job, value, data) {
    if (isNaN(value)) {
      if (!this.options.mute) this.log.error(`Failed up update job (${job.id}) progress, ${value} is not a valid number.`);
      return;
    }

    job.progress = value;
    if (job.options.notifyProgress) {
      this.core.pubsub.publish(job.options.notifyProgress, this._createJobEvent(null, data, job));
    }
  }

  /**
   * Move the job from the failed list into the waiting list
   * @param job
   * @param cb
   * @returns {*}
   * @private
   */
  _retryJob(job, cb) {
    // this.client
    //   .retryjob(
    //     this.toKey('failed'),
    //     this.toKey('waiting'),
    //     job.id,
    //     cb
    //   );
    return 'retry';
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
}

module.exports = Queue;
