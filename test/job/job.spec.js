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

  it('Should run jobs', (done) => {
    global.fooBar = () => {
      console.log('I RAN')
      done();
      return Promise.resolve();
    };
    const prom = Hook.create('test', {
      runs: 'fooBar',
      data: {
        foo: 'bar',
      },
    });
    console.dir(prom)
  });
});
