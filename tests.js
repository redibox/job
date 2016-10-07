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

global.firstJob = function () {
  console.log('Running firstJob')

  return Promise.resolve();

};

global.secondJob = function () {
  console.log('Running secondJob')
  return Promise.resolve(false);
};


global.thirdJob = function () {
  console.log('Running thirdJob')
  return Promise.resolve();
};

global.RediBox = new Redibox(config, () => {
  global.Hook = RediBox.hooks[global.HOOK_NAME];
  RediBox.client.flushall().then(() => {

    console.log('HOOK READY');

    for (var i = 0; i < 1000; i++) {
      Hook.create('test', {
        runs: 'firstJob',
        data: i,
      });
    }

    // Hook
    //   .create('test', {
    //     // runs: ['firstJob', { runs: 'secondJob', queue: 'test2' }, 'thirdJob'],
    //     // runs: ['firstJob', 'secondJob', 'thirdJob'],
    //     runs: 'firstJob',
    //     retries: 1,
    //     data: {
    //       foo: 'bar',
    //     },
    //   })
    //   .onRetry(e => {
    //     retry = true;
    //     console.log('retry')
    //     console.log(e)
    //     console.log('retry')
    //   })
    //   .onFailure((e) => {
    //     console.log(e)
    //   })
    //   .onSuccess(e => {
    //     console.log(e)
    //   });

  });

});
