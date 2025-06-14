import { describe, expect, it } from 'vitest';
import { passthroughMapper } from './passthrough';

describe('passthroughMapper', () => {
  const mapper = passthroughMapper();

  it('should return the same value for transformFrom (primitive)', () => {
    expect(mapper.transformFrom(42)).toBe(42);
    expect(mapper.transformFrom('test')).toBe('test');
    expect(mapper.transformFrom(true)).toBe(true);
    expect(mapper.transformFrom(null)).toBeNull();
    expect(mapper.transformFrom(undefined)).toBeUndefined();
  });

  it('should return the same object reference for transformFrom (object)', () => {
    const obj = { a: 1 };
    expect(mapper.transformFrom(obj)).toBe(obj);
  });

  it('should return the same array reference for transformFrom (array)', () => {
    const arr = [1, 2, 3];
    expect(mapper.transformFrom(arr)).toBe(arr);
  });

  it('should return the same value for transformTo (primitive)', () => {
    expect(mapper.transformTo(42)).toBe(42);
    expect(mapper.transformTo('test')).toBe('test');
    expect(mapper.transformTo(false)).toBe(false);
    expect(mapper.transformTo(null)).toBeNull();
    expect(mapper.transformTo(undefined)).toBeUndefined();
  });

  it('should return the same object reference for transformTo (object)', () => {
    const obj = { b: 2 };
    expect(mapper.transformTo(obj)).toBe(obj);
  });

  it('should return the same array reference for transformTo (array)', () => {
    const arr = [4, 5, 6];
    expect(mapper.transformTo(arr)).toBe(arr);
  });
});
