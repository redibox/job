global.HOOK_NAME = 'job';
const Redibox = require('redibox').default;
const UserHook = require('./../src/hook');

const config = {
  hooks: {},
  log: {
    level: 'info',
  },
  pubsub: {
    publisher: true,
    subscriber: true,
  },
  job: {
    enabled: true,
    mute: true,
    queues: [
      { name: 'test' },
      { name: 'test2', handler: 'queueHandler' },
      { name: 'test3',
        throttle: {
          limit: 2,
          seconds: 1,
        },
      },
    ],
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
  RediBox.client.flushall(done)
});

after((done) => {
  RediBox.client.disconnect();
  done();
});
