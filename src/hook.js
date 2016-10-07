const { BaseHook, isObject, isFunction } = require('redibox');
const Promise = require('bluebird');

const cuid = require('cuid');
const Job = require('./job');
const Queue = require('./queue');
const defaults = require('./defaults');
const scripts = require('./scripts');

module.exports = class JobHook extends BaseHook {
  constructor() {
    super('job');
    this.queues = {};
    this.autoCreateQueue = null;
    this.autoSaveImmediate = null;
  }

  initialize() {
    if (!this.options.enabled) {
      return Promise.resolve();
    }

    if (!Number.isInteger(this.options.startupDelay) || this.options.startupDelay < 0) {
      this.log.error(`startupDelay (${this.options.startupDelay}) must be an integer greater than zero.`);
      return Promise.resolve();
    }

    this._setupLifecycleEvents();

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
   * Overwrite any user lifecycle events with our own & finally call
   * the users if it's a function
   * @private
   */
  _setupLifecycleEvents() {
    const beforeJobCreate = this.options.beforeJobCreate;
    const afterJobCreate = this.options.afterJobCreate;
    const onJobSuccess = this.options.onJobSuccess;
    const onJobFailure = this.options.onJobFailure;
    const onJobRetry = this.options.onJobRetry;
    const onRelayStepSuccess = this.options.onRelayStepSuccess;
    const onRelayStepCancelled = this.options.onRelayStepCancelled;

    this.options.beforeJobCreate = (...args) => {
      if (isFunction(beforeJobCreate)) return beforeJobCreate(...args);
      return null;
    };

    this.options.afterJobCreate = (...args) => {
      if (isFunction(afterJobCreate)) return afterJobCreate(...args);
      return null;
    };

    this.options.onJobSuccess = (...args) => {
      if (isFunction(onJobSuccess)) return onJobSuccess(...args);
      return null;
    };

    this.options.onJobFailure = (...args) => {
      if (isFunction(onJobFailure)) return onJobFailure(...args);

      this.log.error('');
      this.log.error('--------------- RDB JOB ERROR/FAILURE ---------------');
      this.log.error(`Job: ${args[0].options.runs}` || args[0].queue);
      args[1].stack = args[2].join('\n');
      this.log.error(args[1]);
      this.log.error('------------------------------------------------------');
      this.log.error('');
      return null;
    };

    this.options.onJobRetry = (...args) => {
      if (isFunction(onJobRetry)) return onJobRetry(...args);
      return null;
    };

    this.options.onRelayStepSuccess = (...args) => {
      if (isFunction(onRelayStepSuccess)) return onRelayStepSuccess(...args);
      return null;
    };

    this.options.onRelayStepCancelled = (...args) => {
      if (isFunction(onRelayStepCancelled)) return onRelayStepCancelled(...args);
      return null;
    };
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

    this.options.beforeJobCreate(ref, queue, options);

    this.autoCreateQueue[ref] = new Job(this.core, queue, options, 'isNew');

    this.options.afterJobCreate(this.autoCreateQueue[ref]);

    this.log.verbose(`Creating job for queue ${queue} with reference ${ref}`);

    if (!this.autoSaveImmediate) {
      this.autoSaveImmediate = setImmediate(this._autoSave.bind(this));
    } else if (!Object.keys(this.autoCreateQueue).length >= this.options.autoSave.maxJobs) {
      this._autoSave();
    }

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
   * Converts the users key to the full redis key with module prefix.
   * @param key
   * @returns {string}
   */
  toKey(key = '') {
    return `${this.options.keyPrefix}:${key}`;
  }

  /**
   * To enable bypassing of cache for wrap functions
   * Toggles by default or pass in true/false
   * @param bool
   */
  enabled(bool) {
    this.options.enabled = bool || !this.options.enabled;
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
