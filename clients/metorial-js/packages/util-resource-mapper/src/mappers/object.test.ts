import { beforeEach, describe, expect, it, vi } from 'vitest';
import { objectField, objectMapper } from './object';

const identityMapper = {
  transformFrom: vi.fn(x => x),
  transformTo: vi.fn(x => x)
};

const upperCaseMapper = {
  transformFrom: vi.fn(x => (typeof x === 'string' ? x.toUpperCase() : x)),
  transformTo: vi.fn(x => (typeof x === 'string' ? x.toLowerCase() : x))
};

describe('objectMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map fields using provided mappers (transformFrom)', () => {
    const mapper = objectMapper({
      foo: objectField('bar', upperCaseMapper),
      baz: objectField('qux', identityMapper)
    });

    const input = { bar: 'hello', qux: 42, untouched: true };
    const result = mapper.transformFrom(input);

    expect(result).toEqual({
      foo: 'HELLO',
      baz: 42,
      untouched: true
    });
    expect(upperCaseMapper.transformFrom).toHaveBeenCalledWith('hello');
    expect(identityMapper.transformFrom).toHaveBeenCalledWith(42);
  });

  it('should map fields using provided mappers (transformTo)', () => {
    const mapper = objectMapper({
      foo: objectField('bar', upperCaseMapper),
      baz: objectField('qux', identityMapper)
    });

    const input = { foo: 'WORLD', baz: 99, untouched: false };
    const result = mapper.transformTo(input);

    expect(result).toEqual({
      bar: 'world',
      qux: 99,
      untouched: false
    });
    expect(upperCaseMapper.transformTo).toHaveBeenCalledWith('WORLD');
    expect(identityMapper.transformTo).toHaveBeenCalledWith(99);
  });

  it('should leave unmapped fields untouched', () => {
    const mapper = objectMapper({
      foo: objectField('bar', identityMapper)
    });

    const input = { bar: 1, extra: 'keep' };
    const result = mapper.transformFrom(input);

    expect(result).toEqual({ foo: 1, extra: 'keep' });
  });

  it('should skip mapping if input is not an object (transformFrom)', () => {
    const mapper = objectMapper({});
    expect(mapper.transformFrom(null)).toBe(null);
    expect(mapper.transformFrom(42)).toBe(42);
    expect(mapper.transformFrom('str')).toBe('str');
  });

  it('should skip mapping if input is not an object (transformTo)', () => {
    const mapper = objectMapper({});
    expect(mapper.transformTo(null)).toBe(null);
    expect(mapper.transformTo(42)).toBe(42);
    expect(mapper.transformTo('str')).toBe('str');
  });

  it('should handle empty properties', () => {
    const mapper = objectMapper({});
    const input = { a: 1, b: 2 };
    expect(mapper.transformFrom(input)).toEqual(input);
    expect(mapper.transformTo(input)).toEqual(input);
  });

  it('should not mutate the input object', () => {
    const mapper = objectMapper({
      foo: objectField('bar', identityMapper)
    });
    const input = { bar: 5, untouched: 10 };
    const inputCopy = { ...input };
    mapper.transformFrom(input);
    expect(input).toEqual(inputCopy);
  });
});

describe('objectField', () => {
  it('should create a MetorialObjectMapperField', () => {
    const field = objectField('someKey', identityMapper);
    expect(field).toEqual({
      fromKey: 'someKey',
      mapper: identityMapper
    });
  });
});
