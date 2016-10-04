/* eslint no-underscore-dangle: 0 */
const chai = require('chai');
const { assert } = chai;

describe('Queue', () => {
  it('Should create queues on init', (done) => {
    assert.isDefined(Hook.queues);
    assert.isDefined(Hook.queues.test);
    assert.isDefined(Hook.queues.test2);
    done();
  });

  it('Should return a Redis key value for an event name', (done) => {
    assert.equal(Hook.queues.test.toEventName('foo'), 'queue:test:foo');
    done();
  });

  it('Should return a Redis key value from a string value', (done) => {
    assert.equal(Hook.queues.test.toKey('foo'), 'job:test:foo');
    done();
  });

  it('Should return a queues status (waiting, active, succeeded, failed)', (done) => {
    Hook.queues.test
      .getStatus()
      .then(results => {
        assert.isDefined(results);
        assert.isDefined(results.waiting);
        assert.isDefined(results.active);
        assert.isDefined(results.succeeded);
        assert.isDefined(results.failed);
        done();
      })
      .catch(done);
  });

  it('Should stop the queue if it is already started', (done) => {
    Hook.queues.test.stop();
    assert.equal(Hook.queues.test.paused, true);
    Hook.queues.test.start();
    assert.equal(Hook.queues.test.paused, false);
    done();
  });
});
