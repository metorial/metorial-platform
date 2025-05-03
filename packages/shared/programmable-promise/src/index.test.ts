import { describe, expect, it } from 'vitest';
import { ProgrammablePromise } from './index';

describe('ProgrammablePromise', () => {
  it('should resolve with the provided value', async () => {
    const promise = new ProgrammablePromise<number>();
    promise.resolve(42);
    const result = await promise.promise;
    expect(result).toBe(42);
    expect(promise.value).toBe(42);
  });

  it('should reject with the provided reason', async () => {
    const promise = new ProgrammablePromise<number>();
    const error = new Error('Test error');
    promise.reject(error);

    await expect(promise.promise).rejects.toThrow('Test error');
  });

  it('should allow accessing the resolved value after resolution', async () => {
    const promise = new ProgrammablePromise<string>();
    promise.resolve('Hello, world!');
    await promise.promise;
    expect(promise.value).toBe('Hello, world!');
  });

  it('should not have a value before resolution', () => {
    const promise = new ProgrammablePromise<number>();
    expect(promise.value).toBeUndefined();
  });
});
