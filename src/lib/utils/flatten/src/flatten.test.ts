import { describe, expect, it } from 'vitest';
import { flattenObject } from './flatten';

describe('flattenObject', () => {
  it('flattens a nested object', () => {
    let nested = { a: { b: 1 } };
    expect(flattenObject(nested)).toEqual({ 'a.b': 1 });
  });

  it('flattens objects nested multiple levels', () => {
    let nested = { a: { b: { c: 1 } } };
    expect(flattenObject(nested)).toEqual({ 'a.b.c': 1 });
  });

  it('handles non-object values', () => {
    let obj = { a: { b: 1 }, c: 2 };
    expect(flattenObject(obj)).toEqual({ 'a.b': 1, c: 2 });
  });

  it('flattens arrays', () => {
    let nested = { arr: [1, 2] };

    expect(flattenObject(nested)).toEqual({
      'arr[0]': 1,
      'arr[1]': 2
    });
  });

  it('flattens arrays in objects', () => {
    let nested = { obj: { arr: [1, 2] } };

    expect(flattenObject(nested)).toEqual({
      'obj.arr[0]': 1,
      'obj.arr[1]': 2
    });
  });

  it('flattens nested arrays', () => {
    let nested = { arr: [[1, 2], [3]] };

    expect(flattenObject(nested)).toEqual({
      'arr[0][0]': 1,
      'arr[0][1]': 2,
      'arr[1][0]': 3
    });
  });
});
