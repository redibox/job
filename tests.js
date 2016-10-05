global.HOOK_NAME = 'job';
const Redibox = require('redibox').default;
const UserHook = require('./src/hook');

const config = {
  hooks: {},
  log: {
    level: 'debug',
  },
  pubsub: {
    eventPrefix: 'myEvents',
    subscriber: true,
    publisher: true,
  },
  job: {
    queues: [
      {
        name: 'test2',
        concurrency: 5,
        throttle: {
          limit: 250,
          seconds: 10,
        },
      },
      { name: 'test', concurrency: 10 },
    ],
  },
};
config.hooks[global.HOOK_NAME] = UserHook;

global.fooBar = function () {
  console.log('FOO BAR');
  return Promise.resolve({ hello: 123 });
};

global.fooBarEnd = function () {
  console.log('FOO BAR END');
  return Promise.resolve();
};

global.RediBox = new Redibox(config, () => {
  global.Hook = RediBox.hooks[global.HOOK_NAME];
  console.log('HOOK READY');
  Hook
    .create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    })
    .onSuccess((result) => {
      console.log('s'.repeat(80));
      console.dir(result);
      console.log('s'.repeat(80));
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
    })
    .onFailure((result) => {
      console.log('e'.repeat(80));
      console.error(result.error);
      console.log('e'.repeat(80));
    });
});
