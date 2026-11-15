import { describe, expect, it } from 'vitest';
import { deepenObject } from './deepen';

describe('deepenObject', () => {
  it('unflattens a flattened object', () => {
    let flattened = { 'a.b': 1 };
    expect(deepenObject(flattened)).toEqual({ a: { b: 1 } });
  });

  it('unflattens objects flattened multiple levels', () => {
    let flattened = { 'a.b.c': 1 };
    expect(deepenObject(flattened)).toEqual({ a: { b: { c: 1 } } });
  });

  it('handles non-object values', () => {
    let flattened = { 'a.b': 1, c: 2 };
    expect(deepenObject(flattened)).toEqual({ a: { b: 1 }, c: 2 });
  });

  it('unflattens arrays', () => {
    let flattened = {
      'arr[0]': 1,
      'arr[1]': 2
    };

    expect(deepenObject(flattened)).toEqual({
      arr: [1, 2]
    });
  });

  it('unflattens arrays in objects', () => {
    let flattened = {
      'obj.arr[0]': 1,
      'obj.arr[1]': 2
    };

    expect(deepenObject(flattened)).toEqual({
      obj: { arr: [1, 2] }
    });
  });

  it('unflattens nested arrays', () => {
    let flattened = {
      'arr[0][0]': 1,
      'arr[0][1]': 2,
      'arr[1][0]': 3
    };

    expect(deepenObject(flattened)).toEqual({
      arr: [[1, 2], [3]]
    });
  });
});
