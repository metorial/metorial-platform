import { describe, expect, it } from 'vitest';
import { v } from '../index';
import { toTypeScript } from './typescript';

describe('toTypeScript', () => {
  it('converts primitives', () => {
    expect(toTypeScript(v.string())).toBe('string');
    expect(toTypeScript(v.number())).toBe('number');
    expect(toTypeScript(v.boolean())).toBe('boolean');
  });

  it('converts literals and enums', () => {
    expect(toTypeScript(v.literal('a'))).toBe('"a"');
    expect(toTypeScript(v.enumOf(['a', 'b']))).toBe('"a" | "b"');
  });

  it('converts arrays and records', () => {
    expect(toTypeScript(v.array(v.string()))).toBe('Array<string>');
    expect(toTypeScript(v.record(v.array(v.string())))).toBe('Record<string, Array<string>>');
  });

  it('converts objects with optional and nullable fields', () => {
    expect(
      toTypeScript(
        v.object({
          name: v.string(),
          age: v.optional(v.number()),
          note: v.nullable(v.string()),
          'with-dash': v.boolean()
        })
      )
    ).toBe('{ name: string; age?: number; note: (string | null); "with-dash": boolean }');
  });

  it('converts unions and intersections', () => {
    expect(toTypeScript(v.union([v.string(), v.number()]))).toBe('(string | number)');

    expect(
      toTypeScript(v.intersection([v.object({ a: v.string() }), v.object({ b: v.number() })]))
    ).toBe('({ a: string } & { b: number })');
  });

  it('throws for types that are not JSON shaped', () => {
    expect(() => toTypeScript(v.date())).toThrow('Cannot convert validation type');
  });
});
