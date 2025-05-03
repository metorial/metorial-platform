import { describe, expect, test } from 'vitest';
import { merge } from './merge';

describe('merge', () => {
  test('merges objects recursively', () => {
    let target = { a: 1, b: 2 };
    let source = { b: 3, c: 4 };

    expect(merge(target, source)).toEqual({
      a: 1,
      b: 3,
      c: 4
    });
  });

  test('overrides values in target with source values', () => {
    let target = { a: 1, b: 2 };
    let source = { a: 3 };

    expect(merge(target, source)).toEqual({
      a: 3,
      b: 2
    });
  });

  test('handles multiple sources', () => {
    let target = { a: 1 };
    let source1 = { b: 2 };
    let source2 = { c: 3 };

    expect(merge(target, source1, source2)).toEqual({
      a: 1,
      b: 2,
      c: 3
    });
  });

  test('works with nested objects', () => {
    let target = { a: { b: 1 } };
    let source = { a: { c: 2 } };

    expect(merge(target, source)).toEqual({
      a: {
        b: 1,
        c: 2
      }
    });
  });

  test('does not mutate target', () => {
    let target = { a: 1 };
    merge(target, { b: 2 });
    expect(target).toEqual({ a: 1, b: 2 });
  });
});
