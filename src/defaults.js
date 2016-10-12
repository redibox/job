/*
 Default Configuration
 */
module.exports = {
  queues: [],
  enabled: true,
  keyPrefix: 'job',
  startupDelay: 100,
  stallInterval: 15000,
  mute: false,
  queueSeparator: '|||',
  statsRecalculateAfter: 10,
  statsExpireAfter: 604800,
  autoSave: {
    maxJobs: 200,
  },

  beforeJobCreate: null,
  afterJobCreate: null,
  onJobSuccess: null,
  onJobFailure: null,
  onRelayStepSuccess: null,
  onRelayStepCancelled: null,
  onJobRetry: null,
};

