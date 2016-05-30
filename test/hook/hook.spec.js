/* eslint no-underscore-dangle: 0 */
import { assert } from 'chai';
import RediBox from 'redibox';
import Hook from './../../src/hook';

describe('core', () => {
  it('Should extend redibox hook class and provide an emitter', (done) => {
    const hook = new Hook();
    const protoName = Object.getPrototypeOf(Hook).name;
    assert.equal(protoName, 'BaseHook', `Hook should extend 'Hook' but it extends '${protoName}'`);
    assert.isDefined(hook.on);
    assert.isDefined(hook.emit);
    done();
  });

  it('Should extend redibox BaseHook class and provide a name property', (done) => {
    const hook = new Hook();
    assert.isDefined(hook.name);
    assert.equal(global.HOOK_NAME, hook.name);
    done();
  });

  it(`Should mount to core.${global.HOOK_NAME}`, (done) => {
    const config = { hooks: {} };
    config.hooks[global.HOOK_NAME] = Hook;
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
