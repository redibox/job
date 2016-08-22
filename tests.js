global.HOOK_NAME = 'job';
var Redibox = require('redibox').default;
var UserHook = require('./lib/hook').default;

console.dir(UserHook)

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

const clusterConfig = {
  log: { level: 'error' },
  pubsub: {
    eventPrefix: 'myEvents',
    subscriber: true,
    publisher: true,
  },
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
  console.log(foborh);
  return Promise.resolve({ hello: 123 });
};

global.fooBarEnd = function () {
  console.log('FOO BAR END');
  // assert.equal(this.data.hello, 123);
  return Promise.resolve();
};

const tester = new Promise((resolve) => {
  return resolve();
});

global.RediBox = new Redibox(config, () => {
  global.Hook = RediBox.hooks[global.HOOK_NAME];
  global.RediBoxCluster = new Redibox(clusterConfig, () => {
    global.HookCluster = global.RediBoxCluster.hooks[global.HOOK_NAME];
    tester.then(() => {
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
          Hook.create('test2', {
            runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
            data: {
              foo: 'barz',
            },
          });
          Hook.create('test2', {
            runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
            data: {
              foo: 'barz',
            },
          });
          Hook.create('test2', {
            runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
            data: {
              foo: 'barz',
            },
          });
          Hook.create('test2', {
            runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
            data: {
              foo: 'barz',
            },
          });
          Hook.create('test2', {
            runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
            data: {
              foo: 'barz',
            },
          });
          Hook.create('test2', {
            runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
            data: {
              foo: 'barz',
            },
          });
          Hook.create('test2', {
            runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
            data: {
              foo: 'barz',
            },
          });
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

      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });
      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });

      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });

      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });

      Hook.create('test2', {
        runs: ['fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
        data: {
          foo: 'barz',
        },
      });

    });
  });
});

clusterConfig.hooks[global.HOOK_NAME] = UserHook;
