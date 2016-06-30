/* eslint no-underscore-dangle: 0 */
import { assert } from 'chai';

describe('job hook', () => {
  it('Should create queues on init', () => {
    assert.isDefined(Hook.queues);
    assert.isDefined(Hook.queues.test);
    assert.isDefined(Hook.queues.test2);
    return Promise.resolve();
  });

  it('Should create a blocker client per queue', () => {
    assert.isDefined(Hook.queues.test.clients.block);
    assert.isDefined(Hook.queues.test2.clients.block);
    return Promise.resolve();
  });

  it('Should run single jobs', () => {
    return new Promise((resolve, reject) => {
      Hook
        .create('test', {
          runs: 'runners.test',
          data: {
            foo: 'bar',
          },
        })
        .onSuccess(() => console.log('SUCCESSSSSSS'))
        .onFailure(() => reject())
        .then((job) => {
          console.dir(job);
        })
        .catch(reject);
    });
  });

  // it('Should run relay jobs', (done) => {
  //   let count = 0;
  //   global.fooBar = null;
  //   global.fooBar = function () {
  //     count++;
  //     return Promise.resolve({ hello: 123 });
  //   };
  //
  //   global.fooBarEnd = function () {
  //     assert.equal(this.data.hello, 123);
  //     assert.equal(count, 3);
  //     return Promise.resolve().then(done);
  //   };
  //
  //   Hook.create('test2', {
  //     runs: ['runners.fooBar', 'runners.fooBar', 'runners.fooBar', 'runners.fooBarEnd'],
  //     data: {
  //       foo: 'bar',
  //     },
  //   }).then(() => {
  //   }).catch(() => {
  //   });
  // });
  //
  // it('Should emit success and error events per jobs', (done) => {
  //   let count = 0;
  //   global.fooBar2 = function () {
  //     count++;
  //     return Promise.resolve({ hello: 123 });
  //   };
  //
  //   global.fooBarEnd2 = function () {
  //     assert.equal(this.data.hello, 123);
  //     assert.equal(count, 3);
  //     return Promise.resolve('DONE');
  //   };
  //
  //   Hook.create('test2', {
  //     runs: ['fooBar2', 'fooBar2', 'fooBar2', 'fooBarEnd2'],
  //     data: {
  //       foo: 'bar',
  //     },
  //   }).onSuccess(result => {
  //     console.log(result);
  //     assert.equal(result.job.data.hello, 123);
  //     done();
  //   }).then(() => {
  //   }).catch(() => {
  //   });
  // });
});
