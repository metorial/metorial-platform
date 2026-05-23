import { describe, expect, test, vi } from 'vitest';
import { memo } from './memo';

describe('memo function', () => {
  test('should memoize function calls', () => {
    let testFunction = vi.fn((x: number, y: number) => x + y);

    let memoizedFunction = memo(testFunction);

    let result1 = memoizedFunction(2, 3);
    let result2 = memoizedFunction(2, 3);

    expect(testFunction).toHaveBeenCalledTimes(1);

    expect(result1).toEqual(5);
    expect(result2).toEqual(5);
  });

  test('should memoize function calls with different arguments', () => {
    let testFunction = vi.fn((x: number, y: number) => x + y);

    let memoizedFunction = memo(testFunction);

    let result1 = memoizedFunction(2, 3);
    let result2 = memoizedFunction(4, 5);

    expect(testFunction).toHaveBeenCalledTimes(2);

    expect(result1).toEqual(5);
    expect(result2).toEqual(9);
  });

  test('should support memoization for functions with different argument types', () => {
    let testFunction = vi.fn(
      (x: string | number, y: string | number) => x.toString() + y.toString()
    );

    let memoizedFunction = memo(testFunction);

    let result1 = memoizedFunction(1, '1');
    let result2 = memoizedFunction('1', 1);
    let result3 = memoizedFunction('1', '1');
    let result4 = memoizedFunction(1, 1);

    expect(testFunction).toHaveBeenCalledTimes(4);

    expect(result1).toEqual('11');
    expect(result2).toEqual('11');
    expect(result3).toEqual('11');
    expect(result4).toEqual('11');
  });
});
