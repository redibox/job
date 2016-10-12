/* eslint no-underscore-dangle: 0 */
const chai = require('chai');
const { assert } = chai;

/**
 * Spec the basic job functions
 */
describe('Base Job Spec', () => {
  it('Should trigger hook beforeJobCreate function', (done) => {
    let beforeCreate = false;
    global.beforeJobCreate = () => {
      beforeCreate = true;
    };

    global.singleJob = () => {
      assert.equal(beforeCreate, true);
      return Promise.resolve().then(() => done());
    };
    Hook
      .create('queue1', {
        runs: 'singleJob',
        data: {
          bar: 'foo',
        },
      });
  });

  it('Should trigger hook afterJobCreate function', (done) => {
    let afterCreate = false;
    global.afterJobCreate = () => {
      afterCreate = true;
      done();
    };

    Hook
      .create('queue1', {
        runs: 'singleJob',
        data: {
          bar: 'foo',
        },
      });
  });

  it('Should only allow a string as the first argument (queue)', (done) => {
    assert.equal(Hook.create(), null);
    assert.equal(Hook.create(1337), null);
    done();
  });

  it('Should only allow an object as the second argument (options)', (done) => {
    assert.equal(Hook.create('queue1', 1337), null);
    done();
  });

  it('Should allow job create to return a promise', (done) => {
    global.singleJob = function singleJob() {
      return Promise.resolve();
    };

    Hook
      .create('queue1', {
        runs: 'singleJob',
      })
      .then((job) => {
        assert.equal(job.options.runs, 'singleJob');
        done();
      });
  });

  it('Should run a single job', (done) => {
    global.singleJob = function singleJob() {
      done();
    };

    Hook
      .create('queue1', {
        runs: 'singleJob',
      });
  });

  it('Should reject a job where its handler was not found', (done) => {
    Hook.queues.queue1.once('onJobFailure', (failure) => {
      assert(failure.error.message.includes('"singleJobyMcJobFace" was not found'));
      done();
    });

    Hook
      .create('queue1', {
        runs: 'singleJobyMcJobFace',
      });
  });

  it('Should log job failures if not muted and there is no onJobFailure function', (done) => {
    const originalLogger = Hook.log;
    const originalJobFailure = Hook.options.onJobFailure;
    Hook.options.mute = false;
    Hook.options.onJobFailure = null;
    let logCount = 0;
    let gotJobError = false;

    Hook.log = {
      verbose: originalLogger.verbose,
      info: originalLogger.info,
      debug: originalLogger.debug,
      warn: originalLogger.warn,
      error(log) {
        logCount += 1;
        if (log && typeof log === 'string' && log.includes('RDB JOB ERROR/FAILURE')) {
          gotJobError = true;
        }

        if (logCount === 5 && gotJobError) {
          Hook.options.mute = true;
          Hook.options.onJobFailure = originalJobFailure;
          Hook.log = originalLogger;
          done();
        }
      },
    };

    global.singleJobyMcJob = () => {
      return Promise.reject('NOPE');
    };

    Hook
      .create('queue1', {
        runs: 'singleJobyMcJob',
      });
  });

  it('Should reject a job where its handler is not a function', (done) => {
    global.singleJobyMcJobFaceV2 = 'I am not a function, woops';
    Hook.queues.queue1.once('onJobFailure', (failure) => {
      assert(failure.error.message.includes('is not a function'));
      delete global.singleJobyMcJobFaceV2;
      done();
    });

    Hook
      .create('queue1', {
        runs: 'singleJobyMcJobFaceV2',
      });
  });

  it('Should NOT bind the Job class to the job when noBind option is enabled', (done) => {
    global.singleJob = function singleJob() {
      assert.equal(this.constructor.name, 'Object');
      done();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
      noBind: true,
    });
  });

  it('Should run a single job and pass data to it', (done) => {
    global.singleJob = function singleJob(job) {
      assert.equal(job.data.foo, 'bar');
      done();
    };

    Hook
      .create('queue1', {
        runs: 'singleJob',
        data: {
          foo: 'bar',
        },
      });
  });

  it('Should run relay jobs', (done) => {
    let count = 0;
    global.relayJob = function relayJob() {
      count++;
    };

    global.relayJobEnd = function relayJobEnd() {
      assert.equal(count, 3);

      return Promise.resolve().then(() => done());
    };

    Hook.create('queue2', {
      runs: [{ runs: 'relayJob' }, 'relayJob', { runs: 'relayJob' }, 'relayJobEnd'],
    });
  });

  it('Should run a shit load of single jobs', (done) => {
    let count = 0;
    global.singleJob = function singleJob() {
      count++;

      if (count === 1000) {
        done();
        return count;
      }
      return count;
    };

    for (var i = 0; i < 1000; i++) {
      Hook.create('queue1', {
        runs: 'singleJob',
        data: i,
      });
    }
  });

  it('Should run a shit load of relay jobs', (done) => {
    let endCount = 0;
    global.relayJob = function relayJob() {
      return Promise.resolve();
    };

    global.relayJobEnd = function relayJobEnd() {
      endCount++;
      if (endCount === 100) {
        return Promise.resolve(endCount).then(() => done());
      }

      return Promise.resolve(endCount);
    };

    for (var i = 0; i < 500; i++) {
      Hook.create('queue1', {
        runs: ['relayJob', 'relayJob', 'relayJob', 'relayJobEnd'],
        data: i,
      });
    }
  });


  it('Should run relay jobs whilst passing new data along', (done) => {
    let count = 0;

    global.relayJob = function relayJob(job) {
      assert.equal(job.data.count, count);
      count++;
      return Promise.resolve({ count });
    };

    global.relayJobEnd = function relayJobEnd(job) {
      assert.equal(job.data.count, count);

      return Promise.resolve().then(done);
    };

    Hook.create('queue1', {
      runs: ['relayJob', 'relayJob', 'relayJob', 'relayJobEnd'],
      data: {
        count: 0,
      },
    });
  });

  it('Should allow a non-promise to be returned from a single job', (done) => {
    global.singleJob = function singleJob() {
      return 'foo';
    };

    Hook.create('queue1', {
      runs: 'singleJob',
    }).onSuccess(payload => {
      assert.equal(payload.job.data, 'foo');
      done();
    });
  });

  it('Should allow a non-promise to be returned from relay jobs', (done) => {
    global.relayJobOne = function relayJobOne() {
      return 'foo ';
    };

    global.relayJobTwo = function relayJobTwo(job) {
      return `${job.data}bar `;
    };

    global.relayJobThree = function relayJobThree(job) {
      return `${job.data}baz`;
    };

    Hook.create('queue1', {
      runs: ['relayJobOne', 'relayJobTwo', 'relayJobThree'],
    }).onSuccess(payload => {
      assert.equal(payload.job.data, 'foo bar baz');
      done();
    });
  });

  it('Should only create one of the same job when unique is true', (done) => {
    let success = 0;
    let failure = 0;

    global.singleJob = function singleJob() {
      return Promise.resolve();
    };

    function doCount(error) {
      if (error) {
        failure++;
      } else {
        success++;
      }

      if (success === 1 && failure === 1) {
        done();
      }
    }

    for (var i = 0; i < 2; i++) {
      Hook
        .create('queue1', {
          runs: 'singleJob',
          data: {
            foo: 'bar',
          },
          unique: true,
        })
        .then(() => doCount())
        .catch(doCount);
    }
  });

  it('Should run the job using the queue string path handler', (done) => {
    global.queueHandlerTest = function queueHandlerTest(job) {
      assert.equal(job.data.foo, 'bar');
      done();
    };

    Hook.create('queue2', {
      data: {
        foo: 'bar',
      },
    });
  });

  it('Should run the job using the queue function handler', (done) => {
    global.queue4Handler = function queue4Handler(job) {
      assert.equal(job.data.foo, 'bar');
      done();
    };

    Hook.create('queue4', {
      data: {
        foo: 'bar',
      },
    });
  });

  it('Should retry if job fails and retry option is set', (done) => {
    let count = 0;
    global.singleJobRetry = function singleJobRetry() {
      count++;
      if (count === 2) {
        return done();
      }
      return Promise.reject();
    };

    Hook.create('queue1', {
      runs: 'singleJobRetry',
      retries: 2,
    });
  });

  it('Should throttle the jobs to only allow 2 jobs to run every 1 seconds', function (done) { // eslint-disable-line
    this.timeout(4000);
    const seconds = 1;
    const limit = 2;
    let interval = null;
    let iteration = 0;
    let count = 0;

    const check = function check() {
      iteration++;
      if (count > iteration * limit) {
        clearInterval(interval);
        return done(`${count} jobs have run, only ${iteration * 2} are allowed to run!`);
      }
      if (count === 4) {
        clearInterval(interval);
        return done();
      }
      return null;
    };

    global.singleJob = function singleJob() {
      count++;
      return '';
    };

    interval = setInterval(check, seconds * 1000);
    check();

    // Create 4 jobs
    for (let i = 0; i < 4; i++) {
      Hook.create('queue3', {
        runs: 'singleJob',
        data: i,
      });
    }
  });

  it('Should allow progress to be set', (done) => {
    global.singleJob = function singleJob(job) {
      job.setProgress(1337);
      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
    }).onSuccess((result) => {
      assert.equal(result.job.progress, 1337);
      done();
    });
  });

  it('Should only allow a number to be set as progress (👵)', (done) => {
    global.singleJob = function singleJob(job) {
      job.setProgress('isNotUrNan');
      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
    }).onSuccess((result) => {
      assert.equal(result.job.progress, 0);
      done();
    });
  });

  it('Should allow the job to be retried', (done) => {
    let count = 0;
    global.singleJob = function singleJob(job) {
      count++;
      if (count === 1) {
        return job.retry();
      }
      if (count === 2) {
        return 'retry';
      }
      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
    }).onSuccess(() => {
      assert.equal(count, 3);
      done();
    });
  });

  it('Should retry the job if timeout is reached and retries is set', function(done) {
    let count = 0;
    global.singleJob = function singleJob() {
      count++;
      if (count < 4) {
        return new Promise(() => {

        });
      }
      return Promise.resolve();
  };

    Hook.create('queue1', {
      runs: 'singleJob',
      retries: 5,
      timeout: 500,
    }).onRetry(() => {
      if (count === 3) {
        done();
      }
    });
  });

  it('Should allow the queue to be switched mid relay', (done) => {
    let count = 0;
    global.singleJob = function singleJob() {
      count++;
      return Promise.resolve();
    };

    global.queueHandlerTest = function queueHandlerTest() {
      count++;
      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: ['singleJob', { queue: 'queue2' }, { queue: 'queue1', runs: 'singleJob' }],
    }).onSuccess(() => {
      assert.equal(count, 3);
      done();
    });
  });

  it('Should be able to pause a queue and jobs stop running', (done) => {
    let timeout = null;
    global.firstJob = function singleJob() {
      timeout = setTimeout(done, 500);
    };
    global.secondJob = function singleJob() {
      clearTimeout(timeout);
      return done('Job ran when the queue was supposed to be paused.');
    };


    Hook.queues.pauseQueue.stop();
    Hook.create('pauseQueue', {
      runs: 'firstJob',
    });
    Hook.create('pauseQueue', {
      runs: 'secondJob',
    });
  });

  it('Should be able to resume a queue and jobs run', (done) => {
    Hook.queues.pauseQueue.stop();
    const now = Date.now();

    global.firstJob = function singleJob() {
      return Promise.resolve();
    };
    global.secondJob = function singleJob() {
      if (Date.now() - now < 500) {
        return done('Error: Job ran when queue was supposed to be paused.')
      }
      done();
    };


    Hook.create('pauseQueue', {
      runs: 'firstJob',
    });
    Hook.create('pauseQueue', {
      runs: 'secondJob',
    });

    setTimeout(() => {
      Hook.queues.pauseQueue.start();
    }, 500);
  });
});
