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
  autoSave: {
    maxJobs: 1000,
  },
};

