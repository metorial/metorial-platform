import { describe, expect, test } from 'vitest';
import { createProgrammableAsyncIterator } from './asyncIterator';

describe('createProgrammableAsyncIterator', () => {
  test('should yield values', async () => {
    let iterator = createProgrammableAsyncIterator<number, void>();
    let values: number[] = [];

    setTimeout(() => {
      iterator.yield(1);
      iterator.yield(2);
      iterator.finish();
    }, 100);

    for await (let value of iterator.iterator) {
      values.push(value);
    }

    expect(values).toEqual([1, 2]);
  });

  test('should handle thrown errors', async () => {
    let iterator = createProgrammableAsyncIterator<void, void>();
    let error = new Error('Test Error');

    setTimeout(() => {
      iterator.throw(error);
    }, 100);

    try {
      for await (let _ of iterator.iterator) {
        // Do nothing
      }
    } catch (err) {
      expect(err).toBe(error);
    }
  });

  test('should handle early termination', async () => {
    let iterator = createProgrammableAsyncIterator<number, void>();
    let values: number[] = [];

    setTimeout(() => {
      iterator.yield(1);
      iterator.yield(2);
      iterator.finish();
    }, 100);

    for await (let value of iterator.iterator) {
      values.push(value);
      if (value === 1) {
        break;
      }
    }

    expect(values).toEqual([1]);
  });
});
