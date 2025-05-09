import { describe, expect, it, vitest } from 'vitest';
import { Emitter } from './emitter';

describe('Emitter', () => {
  it('should register a listener and call it when the event is emitted', () => {
    const emitter = new Emitter<{ testEvent: string }>();
    const listener = vitest.fn();

    emitter.on('testEvent', listener);
    emitter.emit('testEvent', 'testData');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('testData');
  });

  it('should unregister a listener using the returned function', () => {
    const emitter = new Emitter<{ testEvent: string }>();
    const listener = vitest.fn();

    const unregister = emitter.on('testEvent', listener);
    unregister();
    emitter.emit('testEvent', 'testData');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should clear all listeners for a specific event', () => {
    const emitter = new Emitter<{ testEvent: string }>();
    const listener1 = vitest.fn();
    const listener2 = vitest.fn();

    emitter.on('testEvent', listener1);
    emitter.on('testEvent', listener2);
    emitter.clear('testEvent');
    emitter.emit('testEvent', 'testData');

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it('should clear all listeners for all events', () => {
    const emitter = new Emitter<{ testEvent1: string; testEvent2: number }>();
    const listener1 = vitest.fn();
    const listener2 = vitest.fn();

    emitter.on('testEvent1', listener1);
    emitter.on('testEvent2', listener2);
    emitter.clear();
    emitter.emit('testEvent1', 'testData');
    emitter.emit('testEvent2', 42);

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it('should call a listener registered with "once" only once', () => {
    const emitter = new Emitter<{ testEvent: string }>();
    const listener = vitest.fn();

    emitter.once('testEvent', listener);
    emitter.emit('testEvent', 'testData1');
    emitter.emit('testEvent', 'testData2');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('testData1');
  });

  it('should not call a listener for a different event', () => {
    const emitter = new Emitter<{ testEvent1: string; testEvent2: number }>();
    const listener = vitest.fn();

    emitter.on('testEvent1', listener);
    emitter.emit('testEvent2', 42);

    expect(listener).not.toHaveBeenCalled();
  });

  it('should handle multiple listeners for the same event', () => {
    const emitter = new Emitter<{ testEvent: string }>();
    const listener1 = vitest.fn();
    const listener2 = vitest.fn();

    emitter.on('testEvent', listener1);
    emitter.on('testEvent', listener2);
    emitter.emit('testEvent', 'testData');

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener1).toHaveBeenCalledWith('testData');
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledWith('testData');
  });
});
