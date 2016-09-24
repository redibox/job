/**
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Salakar
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

import cuid from 'cuid';
import Promise from 'bluebird';
import { noop, sha1sum, tryJSONStringify, tryJSONParse } from 'redibox';

/**
 * @class Job
 */
class Job {

  /**
   *
   * @param core
   * @param id
   * @param data
   * @param options
   * @param queueName
   * @param isNew
   * @returns {*}
   */
  constructor(core, id, data = {}, options = {
    unique: false,
    timeout: 60000, // 1 minute default timeout
  }, queueName, isNew) {
    this.id = id;
    this.core = core;
    this.data = data;
    this._saved = false;
    this.options = options;
    this.status = 'created';
    this.subscriptions = [];
    this.ignoreProxy = false;
    this.queueName = queueName;
    this.type = data.runs && Array.isArray(data.runs) ? 'relay' : 'single';

    // parent relay job timeout should cover all child job timeouts
    if (this.type === 'relay') this.options.timeout = this.options.timeout * data.runs.length;

    if (isNew) {
      // this Proxy allows chaining methods while still keeping the
      // save() promise valid
      this.proxy = new Proxy(this, {
        get(target, name) {
          if (name in target) {
            return target[name];
          }

          // haxxors
          if (!target.ignoreProxy && name === 'then') {
            target.promise = target.save();
            return target.promise.then.bind(target.promise);
          }

          return undefined;
        },
      });

      return this.proxy;
    }

    return this;
  }

  /**
   * Returns job instance with no proxy
   * @returns {Job}
   */
  withoutProxy() {
    this.ignoreProxy = true;
    return this;
  }

  /**
   * Query redis for the specified job id and converts it to a new instance of Job.
   * @static
   * @param queue
   * @param id
   */
  static fromId(queue, id) {
    return queue.client.hget(queue.toKey('jobs'), id).then(data =>
      Job.fromData(queue, id, data)
    );
  }

  /**
   * Converts a JSON string of a job's data to a new instance of Job
   * @static
   * @returns {Job | null}
   * @param args
   */
  static fromData(...args) {
    const obj = tryJSONParse(args[2]);
    if (!obj) return null;
    const job = new Job(args[0].core, args[1], obj.data, obj.options, args[0].name);
    job.status = obj.data.status;
    return job;
  }

  /**
   * Convert this Job instance to a json string.
   */
  toData() {
    return tryJSONStringify({
      id: this.id,
      data: this.data,
      status: this.status,
      options: this.options,
    });
  }

  /**
   *
   * @returns {*}
   */
  toObject(excludeData) {
    return {
      id: this.id,
      data: excludeData ? 'hidden' : this.data,
      status: this.status,
      options: this.options,
    };
  }

  /**
   * Internal save that pushes to redis.
   * @private
   */
  _save() {
    this.core.log.verbose(`Saving new job ${this.id} for ${this.queueName}`);
    return this.core.client.addjob(
      this._toQueueKey('jobs'),
      this._toQueueKey('waiting'),
      this._toQueueKey('id'),
      this.toData(),
      !!this.options.unique,
      this.id).then((id) => {
        if (this.options.unique && id === 0) {
          this.status = 'duplicate';
          return Promise.reject(new Error(`ERR_DUPLICATE: Job ${this.id} already exists, save has been aborted.`));
        }

        // TODO allow hooking into this event rather than us doing this poop here
        if (process.env.KUBERNETES_PORT || process.env.KUBERNETES_SERVICE_HOST) {
          /* eslint no-console: 0 */
          const jobData = JSON.stringify(this.data.data || {});
          console.log(JSON.stringify({
            level: 'verbose',
            type: 'redibox_job_created',
            job: {
              id: this.id.toString ? this.id.toString() : this.id,
              runs: this.data.runs,
              queue: this.queueName,
              status: 'pending',
              data: jobData.length > 4000 ? '<! job data too large to display !>' : this.data.data,
            },
          }));
        }

        this.core.log.verbose(`Saved job for ${this.queueName}`);
        this.id = id;
        this.status = 'saved';
        return Promise.resolve(this.toObject(true));
      }
    );
  }

  /**
   * Save this instance of Job to redis. Any active queues will pick it up
   * immediately for processing.
   * @returns {*}
   */
  save(auto) {
    if (!auto && this._saved) return Promise.resolve();

    // lock it so _autoSave doesn't pick it up but only deletes it from queue
    this._saved = true;

    this.id = `${this.queueName}-${(this.options.unique ? sha1sum(this.data) : cuid())}`;

    if (this.options.notifySuccess) {
      this.options.notifySuccess = `job:${this.id}:success`;
      this.subscriptions.push(`job:${this.id}:success`);
    }

    if (this.options.notifyFailure) {
      this.options.notifyFailure = `job:${this.id}:failure`;
      this.subscriptions.push(`job:${this.id}:failure`);
    }

    if (this.options.notifySuccess || this.options.notifyFailure) {
      if (!this.core.pubsub.options.subscriber) {
        return Promise.reject(
          new Error('Cannot subscribe to job events when RediBox.pubsub \'subscriber\' config is set to disabled.')
        );
      }

      return this.core.pubsub.subscribeOnceOf(
        this.subscriptions,
        (message) => { // on message received
          // remove the pubsub data
          if (!message.data) message.data = {};

          // if there's an error then assume failed.
          if (message.data.error) return this.onFailureCallback(message.data);

          // is it from the success channel.
          if (this.subscriptions[0] === message.channel) return this.onSuccessCallback(message.data);

          return this.onFailureCallback(message.data);
        },
        this.options.timeout + 1000
      ).then(() =>
        // now subscribed so save the job
        this._save()
      ).catch(error =>
        this.onFailureCallback({
          type: 'job',
          error: new Error('Error while subscribing to job events, however this job will still be queued - ' +
            'you may be unable to receive onSuccess / onFailure events for this job.'),
          error_actual: error,
        })
      );
    }

    return this._save();
  }

  /**
   * Set the number of times this job will retry on failure
   * @param n
   * @returns {Job}
   */
  retries(n) {
    if (n < 0) throw Error('Retries cannot be negative');
    this.options.retries = n - 1;
    return this.proxy;
  }

  /**
   * Set the onSuccess callback and notify option
   * @param notify
   * @returns {Job}
   */
  onSuccess(notify) {
    this.options.notifySuccess = true;
    this.onSuccessCallback = notify;
    if (!this.onFailureCallback) this.onFailureCallback = noop;
    return this.proxy;
  }

  /**
   * Set the onFailure callback and notify option
   * @param notify
   * @returns {Job}
   */
  onFailure(notify) {
    this.options.notifyFailure = true;
    this.onFailureCallback = notify;
    if (!this.onSuccessCallback) this.onSuccessCallback = noop;
    return this.proxy;
  }

  /**
   *
   * @param bool
   * @returns {Job}
   */
  unique(bool) {
    this.options.unique = bool;
    return this.proxy;
  }

  /**
   * Set how long this job can remain running for before it times out.
   * @param ms
   * @returns {Job}
   */
  timeout(ms) {
    this.options.timeout = ms;
    return this.proxy;
  }

  /**
   * Generates a queue prefixed key based on the provided string.
   * @param str
   * @returns {string}
   * @private
   */
  _toQueueKey(str) {
    if (this.core.cluster.isCluster()) {
      return `${this.core.hooks.job.options.keyPrefix}:{${this.queueName}}:${str}`;
    }
    return `${this.core.hooks.job.options.keyPrefix}:${this.queueName}:${str}`;
  }

  remove() {
    return this.core.client.removejob(
      this._toQueueKey('succeeded'), this._toQueueKey('failed'), this._toQueueKey('waiting'),
      this._toQueueKey('active'), this._toQueueKey('stalling'), this._toQueueKey('jobs'),
      this.id);
  }

  /**
   * Re-save this job for the purpose of retrying it.
   * @param cb
   */
  retry() {
    return this.core.client.multi()
      .srem(this._toQueueKey('failed'), this.id)
      .lpush(this._toQueueKey('waiting'), this.id);
  }

  /**
   *
   * @param set
   * @returns {Promise.<boolean>}
   */
  inSet(set) {
    return this.core.client.sismember(this._toQueueKey(set), this.id).then(result => result === 1);
  }

}

export default Job;
