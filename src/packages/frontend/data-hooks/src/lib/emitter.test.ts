import { describe, expect, it, vitest } from 'vitest';
import { createStateEmitter } from './emitter';

describe('resourceStateEmitter', () => {
  it('should register a listener for a resource and return a function to unregister', () => {
    const emitter = createStateEmitter();
    const listener = vitest.fn();
    const unregister = emitter.register(['resource1'], listener);

    expect(typeof unregister).toBe('function');

    unregister();
  });

  it('should notify the registered listener when a resource is updated', () => {
    const emitter = createStateEmitter();
    const listener = vitest.fn();
    emitter.register(['resource1'], listener);

    emitter.notify(['resource1']);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should notify multiple registered listeners when a resource is updated', () => {
    const emitter = createStateEmitter();
    const listener1 = vitest.fn();
    const listener2 = vitest.fn();
    emitter.register(['resource1'], listener1);
    emitter.register(['resource1'], listener2);

    emitter.notify(['resource1']);

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('should not notify listeners for other resources', () => {
    const emitter = createStateEmitter();
    const listener = vitest.fn();
    emitter.register(['resource1'], listener);

    emitter.notify(['resource2']);

    expect(listener).not.toHaveBeenCalled();
  });

  it('should unregister the listener when the unregister function is called', () => {
    const emitter = createStateEmitter();
    const listener = vitest.fn();
    const unregister = emitter.register(['resource1'], listener);

    unregister();

    emitter.notify(['resource1']);

    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify listeners for multiple resources', () => {
    const emitter = createStateEmitter();
    const listener = vitest.fn();
    emitter.register(['resource1', 'resource2', 'resource4'], listener);

    emitter.notify(['resource1', 'resource2', 'resource3']);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
