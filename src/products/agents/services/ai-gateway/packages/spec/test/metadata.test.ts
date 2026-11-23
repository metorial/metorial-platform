import { describe, expect, it } from 'vitest';
import { parseRequestMetadata } from '../src/metadata';

describe('parseRequestMetadata', () => {
  it('treats a missing header as empty metadata', () => {
    expect(parseRequestMetadata(undefined)).toEqual({ metadata: {} });
    expect(parseRequestMetadata('  ')).toEqual({ metadata: {} });
  });

  it('accepts a JSON object of strings', () => {
    expect(parseRequestMetadata('{"session":"abc","tier":"free"}')).toEqual({
      metadata: { session: 'abc', tier: 'free' }
    });
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['an array', '["a"]'],
    ['null', 'null'],
    ['non-string values', '{"n":1}'],
    ['long values', JSON.stringify({ k: 'x'.repeat(257) })],
    ['long keys', JSON.stringify({ ['k'.repeat(65)]: 'v' })],
    [
      'too many entries',
      JSON.stringify(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 'v'])))
    ]
  ])('rejects %s', (_, raw) => {
    expect(parseRequestMetadata(raw)).toHaveProperty('error');
  });
});
