import { describe, expect, it, vitest } from 'vitest';
import { proxy } from './proxy';

describe('proxy', () => {
  it('should throw an error if root controller is called', async () => {
    const cb = vitest.fn();
    const client = proxy(cb);

    expect(() => client()).toThrowError('Cannot call root controller');
    expect(cb).not.toHaveBeenCalled();
  });

  it('should call the provided callback with the correct path and options', async () => {
    const cb = vitest.fn();
    const client = proxy(cb);

    await client.some.path({ foo: 'bar' });

    expect(cb).toHaveBeenCalledWith(['some', 'path'], { foo: 'bar' });
  });

  it('should return a client with the correct path when a property is accessed', async () => {
    const cb = vitest.fn();
    const client = proxy(cb);

    const subClient = client.some.path;

    expect(subClient).toBeInstanceOf(Function);
    expect(subClient.toString()).toBe('Client(some.path)');
  });

  it('should return a client with the correct path when a nested property is accessed', async () => {
    const cb = vitest.fn();
    const client = proxy(cb);

    const subClient = client.some.path.to.nested.property;

    expect(subClient).toBeInstanceOf(Function);
    expect(subClient.toString()).toBe('Client(some.path.to.nested.property)');
  });
});
