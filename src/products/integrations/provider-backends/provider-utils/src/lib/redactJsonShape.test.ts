import { describe, expect, it } from 'vitest';
import { redactJsonShape } from './redactJsonShape';

describe('redactJsonShape', () => {
  it('replaces each scalar type with its own tag', () => {
    expect(redactJsonShape('hello')).toBe('Redacted[string]');
    expect(redactJsonShape(42)).toBe('Redacted[number]');
    expect(redactJsonShape(true)).toBe('Redacted[boolean]');
    expect(redactJsonShape(false)).toBe('Redacted[boolean]');
    expect(redactJsonShape(null)).toBe('Redacted[null]');
  });

  it('preserves object keys while redacting every value', () => {
    expect(redactJsonShape({ email: 'alice@example.com', age: 30, active: true })).toEqual({
      email: 'Redacted[string]',
      age: 'Redacted[number]',
      active: 'Redacted[boolean]'
    });
  });

  it('preserves array length while redacting each element', () => {
    expect(redactJsonShape(['a', 'b', 'c'])).toEqual([
      'Redacted[string]',
      'Redacted[string]',
      'Redacted[string]'
    ]);
  });

  it('recurses through nested objects and arrays without losing structure', () => {
    let input = {
      user: { name: 'Alice', tags: ['admin', 'beta'], meta: { verified: true } },
      counts: [1, 2, { retries: 3 }]
    };

    expect(redactJsonShape(input)).toEqual({
      user: {
        name: 'Redacted[string]',
        tags: ['Redacted[string]', 'Redacted[string]'],
        meta: { verified: 'Redacted[boolean]' }
      },
      counts: ['Redacted[number]', 'Redacted[number]', { retries: 'Redacted[number]' }]
    });
  });

  it('keeps empty objects and arrays empty', () => {
    expect(redactJsonShape({})).toEqual({});
    expect(redactJsonShape([])).toEqual([]);
  });
});
