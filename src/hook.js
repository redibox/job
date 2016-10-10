const cuid = require('cuid');
const Promise = require('bluebird');
const { BaseHook, isObject, isFunction } = require('redibox');

const Job = require('./job');
const Queue = require('./queue');
const scripts = require('./scripts');
const defaults = require('./defaults');

module.exports = class JobHook extends BaseHook {
  constructor() {
    super('job');
    this.queues = {};
    this.autoCreateQueue = null;
    this.autoSaveImmediate = null;
  }

  /**
   * Bootstrap the hook
   * @returns {Promise}
   */
  initialize() {
    if (!this.options.enabled) {
      return Promise.resolve();
    }

    if (!Number.isInteger(this.options.startupDelay) || this.options.startupDelay < 0) {
      this.log.error(`startupDelay (${this.options.startupDelay}) must be an integer greater than zero.`);
      return Promise.resolve();
    }

    for (let i = 0, len = this.options.queues.length; i < len; i++) {
      let queue = this.options.queues[i];

      if (!isObject(queue) && typeof queue !== 'string') {
        this.log.error(`The queue specified at array position ${i} is an invalid type. Must be of type String or Object.`);
        return Promise.resolve();
      }

      // Convert queue string name to object
      if (typeof queue === 'string') {
        queue = {
          name: queue,
        };
      }

      if (!queue.name || typeof queue.name !== 'string') {
        this.log.error(`The queue specified at array position ${i} requires a valid name property of type String.`);
        return Promise.resolve();
      }

      if (queue.name.includes(this.options.queueSeparator)) {
        // eslint-disable-next-line
        this.log.error(`The queue "${queue.name}" contains restricted characters (${this.options.queueSeparator}). Either remove these or edit the 'queueSeparator' hook configuration.`);
        return Promise.resolve();
      }

      this.options.queues[i] = queue;
      this._createQueue(queue);
    }

    this.on('core:ready', () => {
      setTimeout(() => {
        for (let i = 0, len = this.options.queues.length; i < len; i++) {
          this.queues[this.options.queues[i].name].beginWorking();
        }
      }, this.options.startupDelay);
    });

    return Promise.resolve();
  }

  /**
   * Triggers right before the job class is initilised
   * @param args
   * @private
   */
  _beforeJobCreate(...args) {
    const beforeJobCreate = this.options.beforeJobCreate;
    if (isFunction(beforeJobCreate)) beforeJobCreate(...args);
  }

  /**
   * Triggers once the job class has been created
   * @param args
   * @private
   */
  _afterJobCreate(...args) {
    const afterJobCreate = this.options.afterJobCreate;
    if (isFunction(afterJobCreate)) afterJobCreate(...args);
  }

  /**
   * Triggers once a single job or entire relay has successfully completed
   * @param args
   * @private
   */
  _onJobSuccess(...args) {
    const onJobSuccess = this.options.onJobSuccess;
    if (isFunction(onJobSuccess)) onJobSuccess(...args);
  }

  /**
   * Triggers on job failure, either manually or via rejection.
   * Will not trigger if a job is going to be retried.
   * @param args
   * @private
   */
  _onJobFailure(...args) {
    const onJobFailure = this.options.onJobFailure;
    if (isFunction(onJobFailure)) {
      onJobFailure(...args);
    } else if (!this.options.mute) {
      this.log.error('');
      this.log.error('--------------- RDB JOB ERROR/FAILURE ---------------');
      this.log.error(`Job: ${args[0].options.runs}` || args[0].queue);
      args[1].stack = args[2].join('\n');
      this.log.error(args[1]);
      this.log.error('------------------------------------------------------');
      this.log.error('');
    }
  }

  /**
   * Triggered when a job retires.
   * @param args
   * @private
   */
  _onJobRetry(...args) {
    const onJobRetry = this.options.onJobRetry;
    if (isFunction(onJobRetry)) onJobRetry(...args);
  }

  /**
   * Triggers when an individual job in a relay has been completed.
   * @param args
   * @private
   */
  _onRelayStepSuccess(...args) {
    const onRelayStepSuccess = this.options.onRelayStepSuccess;
    if (isFunction(onRelayStepSuccess)) onRelayStepSuccess(...args);
  }

  /**
   * Triggered when the user manually cancels a relay step.
   * @param args
   * @private
   */
  _onRelayStepCancelled(...args) {
    const onRelayStepCancelled = this.options.onRelayStepCancelled;
    if (isFunction(onRelayStepCancelled)) onRelayStepCancelled(...args);
  }

  /**
   * Creates a new job for the specified queue
   * @param queue
   * @param options
   * @returns {Job}
   */
  create(queue, options) {
    if (!queue || typeof queue !== 'string') {
      this.log.warn('A valid queue name of type String must be supplied during job creation.');
      return null;
    }

    if (options && typeof options !== 'object') {
      this.log.warn('Job create options must be of type Object.');
      return null;
    }

    const ref = cuid();

    if (!this.autoCreateQueue) {
      this.autoCreateQueue = {};
    }

    this._beforeJobCreate(ref, queue, options);

    this.autoCreateQueue[ref] = new Job(this.core, queue, options, 'isNew');

    this._afterJobCreate(this.autoCreateQueue[ref]);

    this.log.verbose(`Creating job for queue ${queue} with reference ${ref}`);

    if (!this.autoSaveImmediate) {
      this.autoSaveImmediate = setImmediate(this._autoSave.bind(this));
    }
    // else if (Object.keys(this.autoCreateQueue).length >= this.options.autoSave.maxJobs) {
    //   this._autoSave();
    // }

    return this.autoCreateQueue[ref];
  }

  /**
   * Default config for scheduler
   * @returns {{someDefaultThing: string}}
   */
  defaults() {
    return defaults;
  }

  /**
   *
   * @returns {{addJob, checkStalledJobs, removeJob}}
   */
  scripts() {
    return scripts;
  }

  /**
   *
   * @param queue
   */
  _createQueue(queue) {
    this.log.verbose(`Queue '${queue.name}' created!`);

    this.queues[queue.name] = new Queue(Object.assign({}, this.options, queue), this.core);
  }

  /**
   * Auto save any jobs in the queue
   */
  _autoSave() {
    clearImmediate(this.autoSaveImmediate);
    this.autoSaveImmediate = null;

    const jobsToSave = [];
    const refs = Object.keys(this.autoCreateQueue);

    for (let i = 0, iLen = refs.length; i < iLen; i++) {
      const ref = refs[i];
      if (!this.autoCreateQueue[ref]._saved) {
        jobsToSave.push(ref);
        this.autoCreateQueue[ref]._saved = true;
      } else {
        this.autoCreateQueue[ref] = null;
        delete this.autoCreateQueue[ref];
      }
    }

    if (!jobsToSave.length) return undefined;

    this.log.verbose(`Auto-saving ${jobsToSave.length} jobs.`);

    if (jobsToSave.length === 1) {
      return this.autoCreateQueue[jobsToSave[0]]
        .withoutProxy()
        .save(true)
        .then(() => this._cleanupAutoSave.call(this, null, jobsToSave))
        .catch(error => this._cleanupAutoSave.call(this, error, jobsToSave));
    }

    /* eslint no-confusing-arrow: 0 */
    return Promise
      .map(jobsToSave, (ref) => {
        if (this.autoCreateQueue && this.autoCreateQueue[ref]) {
          return this.autoCreateQueue[ref].withoutProxy().save(true);
        }
        return Promise.resolve();
      })
      .then(() => this._cleanupAutoSave.call(this, null, jobsToSave))
      .catch(error => this._cleanupAutoSave.call(this, error, jobsToSave));
  }

  /**
   *
   * @param jobsToRemove
   * @param error
   */
  _cleanupAutoSave(error, jobsToRemove) {
    if (error) this.log.error(error);
    this.log.verbose(`Removing ${jobsToRemove.length} saved jobs from the auto-save queue.`);

    if (this.autoCreateQueue) {
      for (let i = 0, iLen = jobsToRemove.length; i < iLen; i++) {
        // trying to force garbage collection here
        this.autoCreateQueue[jobsToRemove[i]] = null;
        delete this.autoCreateQueue[jobsToRemove[i]];
      }

      if (!Object.keys(this.autoCreateQueue).length) {
        // trying to force garbage collection here
        this.autoCreateQueue = null;
        delete this.autoCreateQueue;
      }
    }

    return undefined;
  }
};
