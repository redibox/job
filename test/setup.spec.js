global.HOOK_NAME = 'job';
import Redibox from 'redibox';
import UserHook from './../src/hook';

const config = {
  hooks: {},
  log: {
    level: 'debug',
  },
  pubsub: {
    subscriber: true,
  },
  job: {
    queues: [
      { name: 'test', concurrency: 5 },
      { name: 'test2', concurrency: 10 },
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
    done();
  });
});

beforeEach(() => {
  Promise.all([
    RediBox.client.flushall(),
  ]);
});

after((done) => {
  // RediBox.client.disconnect();
  setTimeout(done, 2000);
});
