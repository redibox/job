/*
 Default Configuration
 */
module.exports = {
  queues: [],
  enabled: true,
  keyPrefix: 'job',
  startupDelay: 750,
  stallInterval: 15000,
  mute: false,
  queueSeparator: '|||',
  autoSave: {
    maxJobs: 1000,
  },

  beforeJobCreate() {

  },
  afterJobCreate(job) {

  },
  onJobSuccess() {

  },
  onJobFailure() {

  },
  onRelayJobCancelled() {

  },
  onJobRetry() {

  },
};

