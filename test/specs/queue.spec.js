/* eslint no-underscore-dangle: 0 */
const chai = require('chai');
const { assert } = chai;

describe('Queue', () => {
  it('Should create queues on init', (done) => {
    assert.isDefined(Hook.queues);
    assert.isDefined(Hook.queues.queue1);
    assert.isDefined(Hook.queues.queue2);
    assert.isDefined(Hook.queues.queue3);
    done();
  });

  it('Should return a Redis key value for an event name', (done) => {
    assert.equal(Hook.queues.queue1.toEventName('foo'), 'queue:queue1:foo');
    done();
  });

  it('Should return a Redis key value from a string value', (done) => {
    assert.equal(Hook.queues.queue1.toKey('foo'), 'job:queue1:foo');
    done();
  });

  it('Should return a queues status (waiting, active, succeeded, failed)', (done) => {
    Hook.queues.queue1
      .getStatus()
      .then((results) => {
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
    Hook.queues.queue1.stop();
    assert.equal(Hook.queues.queue1.paused, true);
    Hook.queues.queue1.start();
    assert.equal(Hook.queues.queue1.paused, false);
    done();
  });

  it('Should return stats of a single queue', (done) => {
    let count = 0;
    global.singleJob = function singleJob() {
      count++;

      if (count === 1000) {
        return Hook.queues.queue1
          .stats()
          .then((stats) => {
            assert.equal(stats.created, 1000);
            assert.equal(stats.total, 999);
            assert.property(stats, 'avgTimeInQueue');
            assert.property(stats, 'avgTimeToComplete');
            assert.property(stats, 'avgTimeToProcess');
            done();
          });
      }
      return count;
    };

    for (var i = 0; i < 1000; i++) {
      Hook.create('queue1', {
        runs: 'singleJob',
      });
    }
  });

  it('Should return stats of a all queues', (done) => {
    let count = 0;
    global.singleJob = function singleJob() {
      count++;

      if (count === 500) {
        return Hook.queueStats()
          .then((stats) => {
            Object.keys(Hook.queues).forEach((key) => {
              assert.property(stats, key);
            });
            done();
          });
      }
      return count;
    };

    for (var i = 0; i < 250; i++) {
      Hook.create('queue1', {
        runs: 'singleJob',
      });
      Hook.create('queue2', {
        runs: 'singleJob',
      });
    }
  });
});
