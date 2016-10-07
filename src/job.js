const cuid = require('cuid');
const Promise = require('bluebird');
const { sha1sum, tryJSONStringify } = require('redibox');
const defaults = require('./defaults');

// TODO Move to default.js
const defaultOptions = {
  unique: false,
  timeout: 60000, // 60 seconds
};

/**
 * @class Job
 */
class Job {

  constructor(core, queue, options, isNew) {
    this.id = options.id || null;
    this.core = core;
    this.options = Object.assign({}, defaultOptions, options);
    this.data = this.options.data;
    this.status = this.options.status || 'created';
    this.subscriptions = [];
    this.onceOfSubscriptions = [];
    this.ignoreProxy = false;
    this.queue = queue;
    this.type = Array.isArray(options.runs) ? 'relay' : 'single';
    this.progress = 0;
    this._saved = false;

    // Timeout should apply to individual jobs
    if (this.type === 'relay') this.options.timeout = this.options.timeout * this.options.runs.length;

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
   * Convert this Job instance to a json string.
   */
  toData() {
    return tryJSONStringify({
      id: this.id,
      status: this.status,
      options: Object.assign({}, this.options, {
        data: this.data,
        id: this.id,
        status: this.status,
      }),
    });
  }

  /**
   *
   * @returns {*}
   */
  toObject(excludeData) {
    return {
      id: this.id,
      status: this.status,
      options: Object.assign({}, this.options, {
        data: excludeData ? 'hidden' : this.data,
        id: this.id,
        status: this.status,
      }),
    };
  }

  /**
   * Internal save that pushes to redis.
   * @private
   */
  _addJob() {
    this.core.log.verbose(`Saving new job ${this.id} for ${this.queue}`);

    return this.core.client
      .addjob(
        this._toQueueKey('jobs'),
        this._toQueueKey('waiting'),
        this._toQueueKey('id'),
        this.toData(),
        !!this.options.unique,
        this.id
      )
      .then((id) => {
        if (this.options.unique && id === 0) {
          this.status = 'duplicate';
          return Promise.reject(new Error(`ERR_DUPLICATE: Job ${this.id} already exists, save has been aborted.`));
        }

        this.core.log.verbose(`Saved job for ${this.queue}`);

        this.id = id;
        this.status = 'saved';
        return Promise.resolve(this.toObject(true));
      });
  }

  /**
   * Save this instance of Job to redis. Any active queues will pick it up
   * immediately for processing.
   * @returns {*}
   */
  save(auto) {
    if (!auto && this._saved) return Promise.resolve();

    if (Array.isArray(this.options.runs)) {
      // let compound assign deopt.
      // eslint-disable-next-line
      for (var i = 0; i < this.options.runs.length; i++) {
        const runner = this.options.runs[i];

        if (typeof runner === 'string') {
          this.options.runs[i] = {
            runs: runner,
            queue: i === 0 ? this.queue : this.options.runs[i - 1].queue,
          };
        } else {
          let queue = runner.queue;

          if (!queue) {
            queue = i === 0 ? this.queue : this.options.runs[i - 1].queue;
          }

          this.options.runs[i] = {
            runs: runner.runs,
            queue,
          };
        }
      }
    }

    // lock it so _autoSave doesn't pick it up but only deletes it from queue
    this._saved = true;

    this.id = `${this.queue}${defaults.queueSeparator}${(this.options.unique ? sha1sum(this.data) : cuid())}`;

    // Subscribe to events
    if (this.options.notifySuccess) {
      this.options.notifySuccess = `job:${this.id}:onSuccess`;
      this.onceOfSubscriptions.push(`job:${this.id}:onSuccess`);
    }

    if (this.options.notifyFailure) {
      this.options.notifyFailure = `job:${this.id}:onFailure`;
      this.onceOfSubscriptions.push(`job:${this.id}:onFailure`);
    }

    if (this.options.notifyRetry) {
      this.options.notifyRetry = `job:${this.id}:onRetry`;
      this.subscriptions.push(`job:${this.id}:onRetry`);
    }

    if (this.options.notifyRelayStepSuccess) {
      this.options.notifyRelayStepSuccess = `job:${this.id}:onRelayStepSuccess`;
      this.subscriptions.push(`job:${this.id}:onRelayStepSuccess`);
    }

    if (this.options.notifyRelayStepCancelled) {
      this.options.notifyRelayCancelled = `job:${this.id}:onRelayCancelled`;
      this.onceOfSubscriptions.push(`job:${this.id}:onRelayCancelled`);
    }

    if (this.options.notifyProgress) {
      this.options.notifyProgress = `job:${this.id}:onProgress`;
      this.subscriptions.push(`job:${this.id}:onProgress`);
    }

    if (this.subscriptions.length || this.onceOfSubscriptions.length) {
      if (!this.core.pubsub.options.subscriber) {
        return Promise.reject(
          new Error('Cannot subscribe to job events when RediBox.pubsub \'subscriber\' config is set to disabled.')
        );
      }

      const subscriptions = [];

      const eventListener = (payload) => {
        const channel = payload.channel.split(':').pop();

        const callback = this[`${channel}Callback`];

        if (!callback) {
          this.log.warn(`Missing event callback "${callback}" for job ${this.id}`);
          return;
        }

        callback(payload.data);
      };

      if (this.onceOfSubscriptions.length) {
        subscriptions.push(this.core.pubsub.subscribeOnceOf(
          this.onceOfSubscriptions,
          (payload) => {
            this.core.pubsub.unsubscribe(this.subscriptions, eventListener);
            eventListener(payload);
          },
          this.options.timeout + 1000
        ));
      }

      if (this.subscriptions.length) {
        subscriptions.push(this.core.pubsub.subscribe(
          this.subscriptions,
          eventListener
        ));
      }

      return Promise
        .all(subscriptions)
        .then(() =>
          // now subscribed so save the job
          this._addJob()
        ).catch(error =>
          this.onFailureCallback({
            type: 'job',
            error: new Error('Error while subscribing to job events, however this job will still be queued - ' +
              'you may be unable to receive onSuccess / onFailure events for this job.'),
            error_actual: error,
          })
        );
    }

    return this._addJob();
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
    return this.proxy;
  }

  /**
   * Set the onRetry callback and notify option
   * @param notify
   * @returns {Job}
   */
  onRetry(notify) {
    this.options.notifyRetry = true;
    this.onRetryCallback = notify;
    return this.proxy;
  }

  /**
   * Set the onSuccess callback and notify option
   * @param notify
   * @returns {Job}
   */
  onRelayStepSuccess(notify) {
    this.options.notifyRelayStepSuccess = true;
    this.onRelayStepSuccessCallback = notify;
    return this.proxy;
  }

  /**
   * Set the onRelayCancelled callback and notify option
   * @param notify
   * @returns {Job}
   */
  onRelayStepCancelled(notify) {
    this.options.notifyRelayStepCancelled = true;
    this.onRelayStepCancelledCallback = notify;
    return this.proxy;
  }

  onProgress(notify) {
    this.options.notifyProgress = true;
    this.onProgressCallback = notify;
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
      return `${this.core.hooks.job.options.keyPrefix}:{${this.queue}}:${str}`;
    }
    return `${this.core.hooks.job.options.keyPrefix}:${this.queue}:${str}`;
  }

  remove() {
    return this.core.client.removejob(
      this._toQueueKey('succeeded'), this._toQueueKey('failed'), this._toQueueKey('waiting'),
      this._toQueueKey('active'), this._toQueueKey('stalling'), this._toQueueKey('jobs'),
      this.id);
  }

  /**
   * Re-save this job for the purpose of retrying it.
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

module.exports = Job;
