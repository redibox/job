import cuid from 'cuid';
import Job from './job';
import Queue from './queue';
import Promise from 'bluebird';
import defaults from './defaults';
import scripts from './scripts';
import { BaseHook } from 'redibox';

export default class JobHook extends BaseHook {
  constructor() {
    super('job');
    this.queues = {};
    this.autoCreateQueue = null;
    this.autoSaveImmediate = null;
  }

  // noinspection JSUnusedGlobalSymbols,JSMethodCanBeStatic
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
   */
  initialize() {
    if (!this.options.enabled) {
      return Promise.resolve();
    }

    for (let i = 0, len = this.options.queues.length; i < len; i++) {
      const queue = this.options.queues[i];
      this.queueCreate(queue);
    }

    return Promise.resolve();
  }

  /**
   * Creates a new job for the specified queue
   * @param queue
   * @param data
   * @param options
   * @returns {*|Job}
   */
  create(...args) {
    const ref = cuid();
    if (!this.autoCreateQueue) this.autoCreateQueue = {};
    this.autoCreateQueue[ref] = new Job(this.core, null, args[1], args[2], args[0], true);
    this.log.verbose(`Creating job for queue ${args[0]} with ref ${ref}`);

    if (!this.autoSaveImmediate) {
      this.autoSaveImmediate = setImmediate(this.autoSave.bind(this));
    } else if (!Object.keys(this.autoCreateQueue).length > 200) {
      this.autoSave();
    }

    return this.autoCreateQueue[ref];
  }

  /**
   * Auto save any jobs in the queue
   */
  autoSave() {
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

    if (!jobsToSave.length) return void 0;

    this.log.verbose(`Auto-saving ${jobsToSave.length} jobs.`);

    if (jobsToSave.length === 1) {
      return this.autoCreateQueue[jobsToSave[0]]
        .withoutProxy()
        .save(true)
        .then(() => this.cleanupAutoSave.call(this, jobsToSave))
        .catch(err => this.cleanupAutoSave.call(this, jobsToSave, err));
    }

    /* eslint no-confusing-arrow: 0 */
    return Promise
      .map(
        jobsToSave,
        ref => this.autoCreateQueue[ref] ?
          this.autoCreateQueue[ref].withoutProxy().save(true) :
          Promise.resolve(),
        { concurrency: 25 }
      )
      .then(() => this.cleanupAutoSave.call(this, jobsToSave))
      .catch(err => this.cleanupAutoSave.call(this, jobsToSave, err));
  }

  /**
   *
   * @param jobsToRemove
   * @param possibleError
   */
  cleanupAutoSave(jobsToRemove, possibleError) {
    if (possibleError) this.log.error(possibleError);
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

    return void 0;
  }

  /**
   *
   * @param queue
   */
  queueCreate(queue) {
    this.log.verbose(`Queue '${queue.name}' created!`);
    this.queues[queue.name] = new Queue({ ...this.options, ...queue }, this.core);
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
}
