import { describe, expect, it } from 'vitest';
import {
  generateIngestToken,
  hashIngestTokenSecret,
  parseIngestToken,
  secretHashesMatch
} from '../tokenSecret';

describe('ingest token secrets', () => {
  it('generates tokens that parse back into prefix and secret', () => {
    let { prefix, secret, token } = generateIngestToken();

    expect(token.startsWith('gsk_')).toBe(true);
    expect(parseIngestToken(token)).toEqual({ prefix, secret });
  });

  it('generates distinct tokens', () => {
    let tokens = new Set(Array.from({ length: 50 }, () => generateIngestToken().token));

    expect(tokens.size).toBe(50);
  });

  it('rejects malformed credentials', () => {
    let { token } = generateIngestToken();

    expect(parseIngestToken('')).toBeNull();
    expect(parseIngestToken('Bearer x')).toBeNull();
    expect(parseIngestToken(token.replace('gsk_', 'sk_'))).toBeNull();
    expect(parseIngestToken(`${token}!`)).toBeNull();
    expect(parseIngestToken(token.slice(0, -40))).toBeNull();
    expect(parseIngestToken('gsk_abc_def')).toBeNull();
  });

  it('hashes deterministically and compares in constant time', async () => {
    let first = await hashIngestTokenSecret('secret-a');
    let again = await hashIngestTokenSecret('secret-a');
    let other = await hashIngestTokenSecret('secret-b');

    expect(first).toBe(again);
    expect(first).not.toBe('secret-a');
    expect(secretHashesMatch(first, again)).toBe(true);
    expect(secretHashesMatch(first, other)).toBe(false);
    expect(secretHashesMatch(first, first.slice(1))).toBe(false);
  });
});
