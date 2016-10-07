/* eslint no-underscore-dangle: 0 */
const chai = require('chai');
const { assert } = chai;

/**
 * Spec the basic job functions
 */
describe('Job Basics', () => {
  it('Should run a single job', (done) => {
    global.singleJob = function singleJob() {
      done();
    };

    Hook
      .create('queue1', {
        runs: 'singleJob',
      });
  });

  it('Should bind the Job class to the job', (done) => {
    global.singleJob = function queueHandler() {
      assert.equal(this.constructor.name, 'Job');
      done();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
    });
  });

  it('Should NOT bind the Job class to the job when noBind option is enabled', (done) => {
    global.singleJob = function queueHandler() {
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
      runs: ['relayJob', 'relayJob', 'relayJob', 'relayJobEnd'],
    });
  });

  it('Should run a shit load of single jobs', (done) => {
    let count = 0;
    global.singleJob = function singleJob() {
      count++;

      if (count === 1000) {
        return Promise.resolve(count).then(() => done());
      }
      return Promise.resolve(count);
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

    for (var i = 0; i < 100; i++) {
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

  it('Should run the job using the queue handler', (done) => {
    global.queueHandler = function queueHandler(job) {
      assert.equal(job.data.foo, 'bar');
      done();
    };

    Hook.create('queue2', {
      data: {
        foo: 'bar',
      },
    });
  });

  it('Should retry if job fails and retry option is set', (done) => {
    let count = 0;
    global.singleJob = function queueHandler() {
      count++;
      if (count === 2) {
        return done();
      }
      return Promise.reject();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
      retries: 2,
    });
  });

  it('Should thottle the jobs to only allow 2 jobs to run every 1 seconds', function(done) { // eslint-disable-line
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
});

/**
 * Spec Job PUBSUB events
 */
describe('Job PUBSUB Events', () => {
  it('Should emit a success event on single job completion', (done) => {
    global.singleJob = function singleJob() {
      return Promise.resolve(this.data);
    };

    Hook.create('queue1', {
      runs: 'singleJob',
      data: {
        success: true,
      },
    }).onSuccess(payload => {
      assert.equal(payload.job.data.success, true);
      done();
    });
  });

  it('Should emit a success event once all relay jobs have completed', (done) => {
    global.relayJob = function relayJob(job) {
      return Promise.resolve(job.data);
    };

    Hook.create('queue1', {
      runs: ['relayJob', 'relayJob', 'relayJob'],
      data: {
        success: true,
      },
    }).onSuccess(payload => {
      assert.equal(payload.job.data.success, true);
      done();
    });
  });

  it('Should emit failure event on single job failure', (done) => {
    let count = 0;
    global.relayJob = function relayJob() {
      count++;
      throw new Error('foo');
    };

    Hook.create('queue1', {
      runs: 'relayJob',
    }).onFailure(payload => {
      assert.equal(payload.error.message, 'foo');
      done();
    });
  });

  it('Should emit failure event on relay job failure and not continue', (done) => {
    let count = 0;
    global.relayJob = function relayJob() {
      count++;
      return Promise.resolve();
    };

    global.relayJobError = function relayJob() {
      throw new Error('foo');
    };

    Hook.create('queue1', {
      runs: ['relayJob', 'relayJobError', 'relayJob'],
    }).onFailure(payload => {
      assert.equal(count, 1);
      assert.equal(payload.error.message, 'foo');
      done();
    });
  });

  it('Should emit a retry event on singleJob retry', (done) => {
    let count = 0;
    global.singleJob = function singleJob() {
      count++;
      if (count === 1) {
        throw 'foo';
      }

      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
      retries: 1,
    }).onRetry(payload => {
      console.log('RETRY!!!!')
      assert.equal(count, 1);
      assert.equal(payload.error.message, 'foo');
      done();
    });
  });

  // it('Should stop relay jobs mid chain by returning false', (done) => {
  //   let count = 0;
  //   global.relayJob = function queueHandler() {
  //     count++;
  //     if (count === 2) {
  //       return Promise.resolve(false);
  //     }
  //     return Promise.resolve();
  //   };
  //
  //   Hook.create('test', {
  //     runs: ['relayJob', 'relayJob', 'relayJob'],
  //   }).onRelayCancelled(() => {
  //     assert.equal(count, 2);
  //     done();
  //   });
  // });

  // TODO https://github.com/redibox/job/issues/8
  // it('Should allow the instance of the job to retry itself', (done) => {
  //   let count = 0;
  //   global.singleJob = function queueHandler() {
  //     console.log('doing job')
  //     count++;
  //     if (count === 2) {
  //       return done();
  //     }
  //     return Promise.reject();
  //   };
  //
  //   const job = Hook.create('test', {
  //     runs: 'singleJob',
  //   }).onFailure(() => {
  //     console.log(job.retry)
  //     job.retry();
  //   });
  // });

  // TODO https://github.com/redibox/job/issues/10
  // it('Should emit a failure if job timeout is set and hit', (done) => {
  //   global.singleJob = function singleJob() {
  //     return new Promise((resolve) => {
  //       setTimeout(resolve, 2000);
  //     });
  //   };
  //
  //   Hook.create('test', {
  //     runs: 'singleJob',
  //   }, {
  //     timeout: 1000,
  //   }).onFailure(job => {
  //     assert.equal(job.error.timeout, true);
  //     done();
  //   });
  // });

  // TODO https://github.com/redibox/job/issues/9
  // it('Should retry the job if timeout is reached and retries is set', function(done) {
  //   this.timeout(10000);
  //   let count = 0;
  //   global.singleJob = function queueHandler(job) {
  //     count++;
  //     console.log('Running', count)
  //     if (count === 1) {
  //       return new Promise((resolve) => {
  //         setTimeout(() => { console.log('RESOLVED TIMEOUT')
  //           return resolve()},
  //             2000);
  //       });
  //     } else {
  //       console.log('DONNNEEEEEE')
  //       return done();
  //     }
  //   };
  //
  //   Hook.create('test', {
  //     runs: 'singleJob',
  //   }, {
  //     retries: 5,
  //     timeout: 1000,
  //   });
  // });



});
