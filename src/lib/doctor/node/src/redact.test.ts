import { describe, expect, it } from 'vitest';
import { isSecretKey, redact, redactString } from './redact';
import { readFixture } from './test/fixtures';

let vectors =
  readFixture<{ name: string; input: unknown; expected: unknown }[]>('redaction.json');

describe('redact', () => {
  it.each(vectors.map(vector => [vector.name, vector]))('%s', (_, vector) => {
    expect(redact(vector.input)).toEqual(vector.expected);
  });

  it('caps long strings at 2048 code points', () => {
    let value = '✓'.repeat(3000);
    let result = redactString(value);

    expect(Array.from(result)).toHaveLength(2048 + Array.from('…[truncated]').length);
    expect(result.endsWith('…[truncated]')).toBe(true);
    expect(redactString('a'.repeat(2048))).toBe('a'.repeat(2048));
  });

  it('can be applied twice', () => {
    for (let vector of vectors) {
      expect(redact(redact(vector.input))).toEqual(vector.expected);
    }
  });

  it('drops values JSON cannot carry', () => {
    expect(
      redact({ a: undefined, b: () => 1, c: Number.NaN, d: 10n, e: new Date(0) })
    ).toEqual({
      c: null,
      d: '10',
      e: '1970-01-01T00:00:00.000Z'
    });
  });

  it('detects secret keys', () => {
    expect(isSecretKey('DB_PASSWORD')).toBe(true);
    expect(isSecretKey('keyId')).toBe(false);
  });
});
