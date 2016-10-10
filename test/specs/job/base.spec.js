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
          bar: 'foo'
        }
      });
  });

  it('Should trigger hook afterJobCreate function', (done) => {
    let afterCreate = false;
    global.afterJobCreate = () => {
      afterCreate = true;
      done();
    };

    global.doop = null;
    Hook
      .create('queue1', {
        runs: 'doop',
        data: {
          bar: 'foo'
        }
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

  it('Should run a single job', (done) => {
    global.singleJob = function singleJob() {
      done();
    };

    Hook
      .create('queue1', {
        runs: 'singleJob',
      });
  });

  // it('Should bind the Job class to the job', (done) => {
  //   global.singleJob = function singleJob() {
  //     assert.equal(this.constructor.name, 'Job');
  //     done();
  //   };
  //
  //   Hook.create('queue1', {
  //     runs: 'singleJob',
  //   });
  // });

  it('Should NOT bind the Job class to the job when noBind option is enabled', (done) => {
    global.singleJob = function singleJob() {
      console.log(this.constructor.name);
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
    global.queueHandlerTest = function queueHandler(job) {
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
});
