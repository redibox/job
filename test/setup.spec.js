global.HOOK_NAME = 'job';
const Redibox = require('redibox').default;
const { isFunction } = require('redibox');
const UserHook = require('./../src/hook');

const config = {
  hooks: {},
  log: {
    level: 'error',
  },
  pubsub: {
    publisher: true,
    subscriber: true,
  },
  job: {
    enabled: true,
    mute: true,
    queues: [
      'queue1',
      { name: 'queue2', handler: 'queueHandler' },
      {
        name: 'queue3',
        throttle: {
          limit: 2,
          seconds: 1,
        },
      },
      { name: 'queue4',
        handler(...args) {
          return isFunction(global.queue4Handler) && global.queue4Handler(...args)
        },
      },
    ],
    beforeJobCreate: (...args) => isFunction(global.beforeJobCreate) && global.beforeJobCreate(...args),
    afterJobCreate: (...args) => isFunction(global.afterJobCreate) && global.afterJobCreate(...args),
    onJobSuccess: (...args) => isFunction(global.onJobSuccess) && global.onJobSuccess(...args),
    onJobFailure: (...args) => isFunction(global.onJobFailure) && global.onJobFailure(...args),
    onRelayStepSuccess: (...args) => isFunction(global.onRelayStepSuccess) && global.onRelayStepSuccess(...args),
    onRelayStepCancelled: (...args) => isFunction(global.onRelayStepCancelled) && global.onRelayStepCancelled(...args),
    onJobRetry: (...args) => isFunction(global.onJobRetry) && global.onJobRetry(...args),
  },
};

config.hooks[global.HOOK_NAME] = UserHook;

global.runners = {
  test() {
    console.log('Job test ran');
    return Promise.resolve();
  },
  fooBar() {
    console.log('Job fooBar ran');
    return Promise.resolve();
  },
  fooBarEnd() {
    console.log('Job fooBarEnd ran');
    return Promise.resolve();
  },
};

before(done => {
  global.RediBox = new Redibox(config, () => {
    global.Hook = RediBox.hooks[global.HOOK_NAME];
    setTimeout(done, 1000); // ioredis doesn't seem to connect exactly when it says it is
  });
});

beforeEach((done) => {
  global.beforeJobCreate = null;
  global.afterJobCreate = null;
  global.onJobSuccess = null;
  global.onJobFailure = null;
  global.onRelayStepSuccess = null;
  global.onRelayStepCancelled = null;
  global.onJobRetry = null;
  RediBox.client.flushall(done);
  // done();
});

after((done) => {
  RediBox.client.disconnect();
  done();
});
