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
    this.autoCreateQueue = {};
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
  create(queue, data, options) {
    const ref = cuid();
    const job = new Job(this.core, null, data, options, queue, true);
    job._autoSaveRef = ref;
    this.log.verbose(`Creating job for queue ${queue} with ref ${ref}`);
    this.autoCreateQueue[job._autoSaveRef] = job;
    if (!this.autoSaveImmediate) this.autoSaveImmediate = setImmediate(::this.autoSave);
    return job;
  }

  /**
   * Auto save any jobs in the queue
   */
  autoSave() {
    const jobsToSave = [];
    const refs = Object.keys(this.autoCreateQueue);

    for (let i = 0, iLen = refs.length; i < iLen; i++) {
      const ref = refs[i];
      const job = this.autoCreateQueue[ref];
      if (!job._saved) {
        jobsToSave.push(job.withoutProxy());
        job._saved = true;
      } else {
        delete this.autoCreateQueue[ref];
      }
    }

    if (!jobsToSave.length) return 0;

    this.log.verbose(`Auto-saving ${jobsToSave.length} jobs.`);

    if (jobsToSave.length === 1) {
      return jobsToSave[0]
        .save(true)
        .then(() => ::this.cleanupAutoSave(jobsToSave))
        .catch(err => ::this.cleanupAutoSave(jobsToSave, err));
    }

    return Promise
      .map(jobsToSave, job => job.save(true), { concurrency: 25 })
      .then(() => ::this.cleanupAutoSave(jobsToSave))
      .catch(err => ::this.cleanupAutoSave(jobsToSave, err));
  }

  /**
   *
   * @param jobsToRemove
   * @param possibleError
   */
  cleanupAutoSave(jobsToRemove, possibleError) {
    if (possibleError) this.log.error(possibleError);
    this.log.verbose(`Removing ${jobsToRemove.length} saved jobs from the auto-save queue.`);
    for (let i = 0, iLen = jobsToRemove.length; i < iLen; i++) {
      delete this.autoCreateQueue[jobsToRemove[i]._autoSaveRef];
    }
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
