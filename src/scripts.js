const { loadLuaScript } = require('./utils');

module.exports = {

  addJob: {
    keys: 3,
    lua: loadLuaScript('addJob'),
  },

  averageStats: {
    keys: 2,
    lua: loadLuaScript('averageStats'),
  },

  checkStalledJobs: {
    keys: 4,
    lua: loadLuaScript('checkStalledJobs'),
  },

  removeJob: {
    keys: 6,
    lua: loadLuaScript('removeJob'),
  },

  throttle: {
    keys: 1,
    lua: loadLuaScript('throttle'),
  },

  pThrottle: {
    keys: 1,
    lua: loadLuaScript('pThrottle'),
  },

  throttleNoIncr: {
    keys: 1,
    lua: loadLuaScript('throttleNoIncr'),
  },

  throttleDecr: {
    keys: 1,
    lua: loadLuaScript('throttleDecr'),
  },
};
