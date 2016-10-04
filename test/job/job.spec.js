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

  it('Should run a single job and pass data to it', () => {
    global.singleJob = function singleJob(job) {
      assert.equal(job.data.foo, 'bar');
      return Promise.resolve();
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

  // TODO https://github.com/redibox/job/issues/6
  it('Should emit error event on job failure', (done) => {
    let count = 0;
    global.fooBar2 = function () {
      count++;
      throw 'foo';
    };

    global.fooBarEnd2 = function () {
      assert.equal(this.data.hello, 123);
      assert.equal(count, 3);
      return Promise.resolve('DONE');
    };

    Hook.create('test2', {
      runs: ['fooBar2', 'fooBar2', 'fooBar2', 'fooBarEnd2'],
      data: {
        foo: 'bar',
      },
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
});
