import { describe, expect, it } from 'vitest';
import { MetorialMapper } from '../types';
import { unionMapper, unionOption } from './union';

// Dummy mappers for testing
const stringMapper: MetorialMapper<string> = {
  transformFrom: (input: any) => `from:${input}`,
  transformTo: (input: any) => `to:${input}`
};

const numberMapper: MetorialMapper<number> = {
  transformFrom: (input: any) => input + 1,
  transformTo: (input: any) => input - 1
};

const arrayMapper: MetorialMapper<any[]> = {
  transformFrom: (input: any) => input.map((x: any) => `from:${x}`),
  transformTo: (input: any) => input.map((x: any) => `to:${x}`)
};

const dateMapper: MetorialMapper<Date> = {
  transformFrom: (input: any) => input.getTime(),
  transformTo: (input: any) => new Date(input)
};

describe('unionMapper', () => {
  const mapper = unionMapper([
    unionOption('string', stringMapper),
    unionOption('number', numberMapper),
    unionOption('array', arrayMapper),
    unionOption('date', dateMapper)
  ]);

  it('should use stringMapper for strings', () => {
    expect(mapper.transformFrom('abc')).toBe('from:abc');
    expect(mapper.transformTo('abc')).toBe('to:abc');
  });

  it('should use numberMapper for numbers', () => {
    expect(mapper.transformFrom(41)).toBe(42);
    expect(mapper.transformTo(42)).toBe(41);
  });

  it('should use arrayMapper for arrays', () => {
    expect(mapper.transformFrom(['a', 'b'])).toEqual(['from:a', 'from:b']);
    expect(mapper.transformTo(['a', 'b'])).toEqual(['to:a', 'to:b']);
  });

  it('should return input unchanged if no mapper matches', () => {
    expect(mapper.transformFrom({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(mapper.transformTo({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(mapper.transformFrom(undefined)).toBe(undefined);
    expect(mapper.transformTo(undefined)).toBe(undefined);
    expect(mapper.transformFrom(null)).toBe(null);
    expect(mapper.transformTo(null)).toBe(null);
    expect(mapper.transformFrom(true)).toBe(true);
    expect(mapper.transformTo(false)).toBe(false);
  });
});

describe('unionOption', () => {
  it('should create a union option object', () => {
    const opt = unionOption('string', stringMapper);
    expect(opt).toEqual({ type: 'string', mapper: stringMapper });
  });
});
