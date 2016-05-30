import Job from './job';
import Queue from './queue';
import Promise from 'bluebird';
import defaults from './defaults';
import { BaseHook } from 'redibox';

export default class JobHook extends BaseHook {
  constructor() {
    super('job');
    this.queues = {};
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
    this.log.verbose(`Creating task for ${queue}`);
    return new Job(this.core, null, data, options, queue);
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
