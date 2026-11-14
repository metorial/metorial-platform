import { describe, expect, it, vi } from 'vitest';
import { once } from './once';

describe('once', () => {
  it('calls the original function only once', () => {
    const fn = vi.fn(() => 42);
    const wrapped = once(fn);

    expect(fn).toHaveBeenCalledTimes(0);
    expect(wrapped()).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(wrapped()).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(wrapped()).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('forwards arguments to the original function', () => {
    const fn = vi.fn(() => 5);
    const wrapped = once(fn);

    expect(wrapped()).toBe(5);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns the exact same reference on subsequent calls', () => {
    const obj = { value: Math.random() };
    const fn = vi.fn(() => obj);
    const wrapped = once(fn);

    const first = wrapped();
    const second = wrapped();
    expect(first).toBe(obj);
    expect(second).toBe(obj);
    expect(first).toBe(second);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('if the wrapped function throws on first call, it is not called again (subsequent calls return undefined)', () => {
    const fn = vi.fn(() => {
      throw new Error('boom');
    });
    const wrapped = once(fn);

    expect(() => wrapped()).toThrow('boom');
    // implementation marks called = true before invoking fn, so it won't be called again
    expect(fn).toHaveBeenCalledTimes(1);
    // subsequent call returns the cached result (which is undefined because the first call threw)
    expect(wrapped()).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
