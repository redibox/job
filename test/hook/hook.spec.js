/* eslint no-underscore-dangle: 0 */
const chai = require('chai');
const { assert } = chai;
const RediBox = require('redibox').default;
const HookClass = require('./../../src/hook');

describe('Core', () => {
  it('Should extend redibox hook class and provide an emitter', (done) => {
    const hook = new HookClass();
    const protoName = Object.getPrototypeOf(HookClass).name;

    assert.equal(protoName, 'BaseHook', `Hook should extend 'Hook' but it extends '${protoName}'`);
    assert.isDefined(hook.on);
    assert.isDefined(hook.emit);
    done();
  });

  it('Should extend redibox BaseHook class and provide a name property', (done) => {
    const hook = new HookClass();

    assert.isDefined(hook.name);
    assert.equal(global.HOOK_NAME, hook.name);
    done();
  });

  it('Should mount to core.job', (done) => {
    const config = { hooks: {} };
    config.hooks[global.HOOK_NAME] = HookClass;
    const redibox = new RediBox(config, () => {
      assert.isTrue(redibox.hooks.hasOwnProperty(global.HOOK_NAME));
      redibox.disconnect();
      done();
    });
    redibox.on('error', (e) => {
      console.error(e);
    });
  });
});

describe('Job Hook', () => {
  it('Should create a blocker client per queue', () => {
    assert.isDefined(Hook.queues.test.clients.block);
    assert.isDefined(Hook.queues.test2.clients.block);
    return Promise.resolve();
  });

});
