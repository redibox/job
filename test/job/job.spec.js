/* eslint no-underscore-dangle: 0 */
import { assert } from 'chai';

describe('job hook', () => {
  it('Should create queues on init', (done) => {
    assert.isDefined(Hook.queues);
    assert.isDefined(Hook.queues.test);
    assert.isDefined(Hook.queues.test2);
    done();
  });

  it('Should create a blocker client per queue', (done) => {
    assert.isDefined(Hook.queues.test.clients.block);
    assert.isDefined(Hook.queues.test2.clients.block);
    done();
  });

  // it('Should run single jobs', (done) => {
  //   global.fooBar = () => {
  //     done();
  //     return Promise.resolve();
  //   };
  //   Hook.create('test', {
  //     runs: 'fooBar',
  //     data: {
  //       foo: 'bar',
  //     },
  //   }).then(() => {
  //   }).catch(console.error);
  // });

  it('Should run relay jobs', (done) => {
    global.fooBar = null;
    global.fooBar = function () {
      return Promise.resolve({ hello: 123 });
    };

    global.fooBarEnd = function () {
      assert.equal(this.data.hello, 123);
      return Promise.resolve().then(done);
    };

    Hook.create('test2', {
      runs: ['fooBar', 'fooBar', 'fooBar', 'fooBarEnd'],
      data: {
        foo: 'bar',
      },
    }).then(() => {
    }).catch(console.error);
  });
});
