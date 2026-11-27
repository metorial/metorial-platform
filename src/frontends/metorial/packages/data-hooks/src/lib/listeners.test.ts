import { describe, expect, it, vitest } from 'vitest';
import { createListeners } from './listeners';

describe('createListeners', () => {
  it('should register a listener and return a function to unregister', () => {
    const { register } = createListeners();
    const listener = vitest.fn();
    const unregister = register(listener);

    expect(typeof unregister).toBe('function');

    unregister();
  });

  it('should notify the registered listener when notify is called', () => {
    const { register, notify } = createListeners();
    const listener = vitest.fn();
    register(listener);

    notify();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should notify multiple registered listeners when notify is called', () => {
    const { register, notify } = createListeners();
    const listener1 = vitest.fn();
    const listener2 = vitest.fn();
    register(listener1);
    register(listener2);

    notify();

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('should unregister the listener when the unregister function is called', () => {
    const { register, notify } = createListeners();
    const listener = vitest.fn();
    const unregister = register(listener);

    unregister();

    notify();

    expect(listener).not.toHaveBeenCalled();
  });
});
