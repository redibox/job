/* eslint no-underscore-dangle: 0 */
const chai = require('chai');
const { assert } = chai;

describe('Job', () => {
  it('Should run a single job', () => {
    global.singleJob = function singleJob() {
      return Promise.resolve();
    };

    Hook
      .create('test', {
        runs: 'singleJob',
      });
  });

  it('Should bind the Job class to the job', (done) => {
    global.singleJob = function queueHandler() {
      assert.equal(this.constructor.name, 'Job');
      done();
    };

    Hook.create('test', {
      runs: 'singleJob',
    });
  });

  it('Should NOT bind the Job class to the job when noBind option is enabled', (done) => {
    global.singleJob = function queueHandler() {
      assert.equal(this.constructor.name, 'Object');
      done();
    };

    Hook.create('test', {
      runs: 'singleJob',
    }, {
      noBind: true,
    });
  });

  it('Should run a single job and pass data to it', (done) => {
    global.singleJob = function singleJob(job) {
      assert.equal(job.data.foo, 'bar');
      done();
    };

    Hook
      .create('test', {
        runs: 'singleJob',
        data: {
          foo: 'bar',
        },
      });
  });

  it('Should run relay jobs', function (done) {
    let count = 0;
    global.relayJob = function relayJob() {
      count++;
    };

    global.relayJobEnd = function relayJobEnd() {
      assert.equal(count, 3);

      return Promise.resolve().then(done);
    };

    Hook.create('test2', {
      runs: ['relayJob', 'relayJob', 'relayJob', 'relayJobEnd'],
    });
  });

  it('Should run relay jobs whilst passing new data along', function (done) {
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

    Hook.create('test', {
      runs: ['relayJob', 'relayJob', 'relayJob', 'relayJobEnd'],
      data: {
        count: 0,
      },
    });
  });

  it('Should emit a success event on single job completion', (done) => {
    global.singleJob = function singleJob() {
      return Promise.resolve();
    };

    Hook.create('test', {
      runs: 'singleJob',
      data: {
        success: true,
      },
    }).onSuccess(result => {
      assert.equal(result.job.data.success, true);
      done();
    });
  });

  it('Should emit a success event once all relay jobs have completed', (done) => {
    global.relayJob = function relayJob(job) {
      return Promise.resolve({ success: job.data.success });
    };

    Hook.create('test', {
      runs: ['relayJob', 'relayJob', 'relayJob'],
      data: {
        success: true,
      },
    }).onSuccess(result => {
      assert.equal(result.job.data.success, true);
      done();
    });
  });

  it('Should emit error event on job failure', (done) => {
    let count = 0;
    global.relayJob = function relayJob() {
      count++;
      throw 'foo';
    };

    Hook.create('test', {
      runs: 'relayJob',
    }).onFailure(job => {
      assert.equal(job.error, 'foo');
      done();
    });
  });


  it('Should allow a non-promise to be returned from a single job', (done) => {
    global.singleJob = function singleJob() {
      return 'foo';
    };

    Hook.create('test', {
      runs: 'singleJob',
    }).onSuccess(result => {
      assert.equal(result.output, 'foo');
      done();
    });
  });

  it('Should allow a non-promise to be returned from relay jobs', (done) => {
    global.relayJobOne = function relayJobOne() {
      return 'foo ';
    };

    global.relayJobTwo = function relayJobTwo(job) {
      return job.data + 'bar ';
    };

    global.relayJobThree = function relayJobThree(job) {
      return job.data + 'baz';
    };

    Hook.create('test', {
      runs: ['relayJobOne', 'relayJobTwo', 'relayJobThree'],
    }).onSuccess(result => {
      assert.equal(result.output, 'foo bar baz');
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

    Hook
      .create('test', {
        runs: 'singleJob',
        data: {
          foo: 'bar',
        },
      }, {
        unique: true,
      })
      .then(() => doCount())
      .catch(doCount);

    Hook
      .create('test', {
        runs: 'singleJob',
        data: {
          foo: 'bar',
        },
      }, {
        unique: true,
      })
      .then(() => doCount())
      .catch(doCount);
  });

  it('Should run the job using the queue handler', (done) => {
    global.queueHandler = function queueHandler(job) {
      assert.equal(job.data.foo, 'bar');
      done();
    };

    Hook.create('test2', {
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

    Hook.create('test', {
      runs: 'singleJob',
    }, {
      retries: 2,
    });
  });

  // TODO https://github.com/redibox/job/issues/7
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
  //   }).onCancelled(() => {
  //     console.log('hello')
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
  // it('Should emit a failure if job timeout is set and hit', function (done) {
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

  it('Should only allow 2 jobs to run every 2 seconds', function(done) {
    this.timeout(5000);
    let interval = null;
    let iteration = 0;
    let count = 0;

    const check = function () {
      iteration++;
      console.log('Doing interval')
      console.log(count)
      console.log(iteration * 2)
      if (count > iteration * 2) {
        clearInterval(interval);
        return done(`${count} jobs have run, only ${iteration * 2} are allowed to run!`);
      }
      if (count === 4) {
        clearInterval(interval);
        console.log('Completing')
        return done();
      }
    };


    global.singleJob = function singleJob() {
      count++;
      console.log('Doing job...')
      return '';
    };

    interval = setInterval(check, 2000);
    check();

    for (let i = 0; i < 4; i++) {
      Hook.create('test3', {
        runs: 'singleJob',
        data: i,
      });
    }
  });
});
