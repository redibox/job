/* eslint no-underscore-dangle: 0 */
const chai = require('chai');
const { assert } = chai;

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
    }).onSuccess(() => {
      done('On success was called unexpectedly');
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


  it('Should emit a onRelayStepCancelled event when a job returns false', (done) => {
    let count = 0;
    global.relayJob = function relayJob() {
      count++;
      if (count === 2) {
        return Promise.resolve(false);
      }
      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: ['relayJob', 'relayJob', 'relayJob'],
    }).onRelayStepCancelled(() => {
      assert.equal(count, 2);
      done();
    });
  });

  it('Should emit an onRelayStepSuccess event for each successful job', (done) => {
    let count = 0;
    global.relayJob = function relayJob() {
      count++;
      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: ['relayJob', 'relayJob', 'relayJob'],
    }).onRelayStepSuccess(() => {
      if (count === 3) {
        done();
      }
    });
  });

  it('Should emit an onRetry event for a single job', (done) => {
    global.singleJob = function singleJob() {
      return Promise.reject('foo');
    };

    Hook.create('queue1', {
      runs: 'singleJob',
      retries: 1,
    }).onRetry(() => {
      done();
    });
  });

  it('Should emit an onRetry event for each job which retries in a relay', (done) => {
    global.relayJob = function relayJob() {
      return Promise.resolve();
    };

    global.relayJobFail = function relayJobFail() {
      return Promise.reject();
    };

    Hook.create('queue1', {
      runs: ['relayJob', 'relayJobFail', 'relayJob'],
      retries: 1,
    }).onRetry(() => {
      done();
    });
  });

  it('Should emit an onRetry AND NOT onFailure for a job retry', (done) => {
    let retry = false;
    let fail = false;

    global.singleJob = function singleJob() {
      if (!retry) {
        return Promise.reject('foo');
      }

      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
      retries: 1,
    }).onRetry(() => {
      retry = true;
    }).onFailure(() => {
      fail = true;
    }).onSuccess(() => {
      assert.equal(retry, true);
      assert.equal(fail, false);
      done();
    });
  });

  it('Should emit an onProgress event on job setProgress', (done) => {
    let progress = false;
    global.singleJob = function singleJob(job) {
      job.setProgress(1337);
      return Promise.resolve();
    };

    Hook.create('queue1', {
      runs: 'singleJob',
      retries: 1,
    }).onProgress((result) => {
      assert.equal(result.job.progress, 1337);
      progress = true;
    }).onSuccess((result) => {
      assert.equal(result.job.progress, 1337);
      assert.equal(progress, true);
      done();
    });
  });

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
  //     timeout: 1000,
  //   }).onFailure(job => {
  //     assert.equal(job.timeout, true);
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
