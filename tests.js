global.HOOK_NAME = 'job';
var Redibox = require('redibox').default;
var UserHook = require('./lib/hook').default;

console.dir(UserHook)

const config = {
  hooks: {},
  log: {
    level: 'debug',
  },
  job: {
    queues: [
      { name: 'test', concurrency: 5 },
      { name: 'test2', concurrency: 10 },
    ],
  },
};
config.hooks[global.HOOK_NAME] = UserHook;

const clusterConfig = {
  log: { level: 'error' },
  redis: {
    connectionTimeout: 2000,
    hosts: [
      {
        host: '127.0.0.1',
        port: 30001,
      },
      {
        host: '127.0.0.1',
        port: 30002,
      },
      {
        host: '127.0.0.1',
        port: 30003,
      },
      {
        host: '127.0.0.1',
        port: 30004,
      },
      {
        host: '127.0.0.1',
        port: 30005,
      },
      {
        host: '127.0.0.1',
        port: 30006,
      },
    ],
  },
  hooks: {},
  job: {},
};

global.fooBar = function () {
  console.log('FOO BAR');
  return Promise.resolve({ hello: 123 });
};

global.fooBarEnd = function () {
  console.log('FOO BAR END');
  // assert.equal(this.data.hello, 123);
  return Promise.resolve();
};

global.RediBox = new Redibox(config, () => {
  global.Hook = RediBox.hooks[global.HOOK_NAME];
  global.RediBoxCluster = new Redibox(clusterConfig, () => {
    global.HookCluster = global.RediBoxCluster.hooks[global.HOOK_NAME];
    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);
  });
});

clusterConfig.hooks[global.HOOK_NAME] = UserHook;
