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
    this.status = 'created';
    this.options = options;
    this.queueName = queueName;
    this.subscriptions = [];
    if (isNew) return this.save();
    return this;
  }

  /**
   * Query redis for the specified job id and converts it to a new instance of Job.
   * @static
   * @param queue
   * @param id
   */
  static fromId(queue, id) {
    return queue.client.hget(queue.toKey('jobs'), id).then((data) =>
      Job.fromData(queue, id, data)
    );
  }

  /**
   * Converts a JSON string of a job's data to a new instance of Job
   * @static
   * @param queue
   * @param id
   * @param data
   * @returns {Job | null}
   */
  static fromData(queue, id, data) {
    const obj = tryJSONParse(data);
    if (!obj) return null;
    const job = new Job(queue.core, id, obj.data, obj.options, queue.name);
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
        this.core.log.verbose(`Saved job for ${this.queueName}`);
        this.id = id;
        this.status = 'saved';
        // this.queue.jobs[id] = this;
        return Promise.resolve(this);
      }
    );
  }

  /**
   * Save this instance of Job to redis. Any active queues will pick it up
   * immediately for processing.
   * @returns {*}
   */
  save() {
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
      return this.core.pubsub.subscribeOnceOf(
        this.subscriptions,
        (message) => { // on message received
          const channel = message.channel;

          // remove the pubsub data
          if (message.data) {
            message = message.data;
          }

          // if there's an error the assume failed.
          if (message.error) {
            return this.onFailureCallback(message);
          }

          // is it from the success channel.
          if (this.subscriptions[0] === channel) {
            return this.onSuccessCallback(message);
          }

          return this.onFailureCallback(message);
        },
        this.options.timeout + 2000
      ).then(() =>  // subscribed callback
        this._save()
      ).catch(error =>
        this.onFailureCallback({
          type: 'job',
          error: new Error('Error while subscribing to job events, however this job will still be queued - ' +
            'you may be unable to receive onComplete / onFailure events for this job.'),
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
    if (n < 0) {
      throw Error('Retries cannot be negative');
    }
    this.options.retries = n - 1;
    return this;
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
    return this;
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
    return this;
  }

  unique(bool) {
    this.options.unique = bool;
    return this;
  }

  /**
   * Set how long this job can run before it times out.
   * @param ms
   * @returns {Job}
   */
  timeout(ms) {
    this.options.timeout = ms;
    return this;
  }

  /**
   *
   * @returns {Job.initialJob|*}
   */
  initialJob() {
    return this._internalData.initialJob;
  }

  /**
   *
   * @returns {Job.initialQueue|*}
   */
  initialQueue() {
    return this._internalData.initialQueue;
  }

  /**
   * Remove this job from all sets.
   * @param cb
   */
  remove(cb = noop) {
    this.core.client.removejob(
      this._toQueueKey('succeeded'), this._toQueueKey('failed'), this._toQueueKey('waiting'),
      this._toQueueKey('active'), this._toQueueKey('stalling'), this._toQueueKey('jobs'),
      this.id, cb);
  }

  /**
   * Re-save this job for the purpose of retrying it.
   * @param cb
   */
  retry(cb = noop) {
    this.core.client.multi()
        .srem(this._toQueueKey('failed'), this.id)
        .lpush(this._toQueueKey('waiting'), this.id)
        .exec(cb);
  }

  /**
   * Callbacks true of false if this job exists in the specified set.
   * @param set
   * @param cb
   */
  isInSet(set, cb = noop) {
    this.core.client.sismember(this._toQueueKey(set), this.id, (err, result) => {
      if (err) return cb(err);
      return cb(null, result === 1);
    });
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

}

export default Job;
