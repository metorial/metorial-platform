import { describe, expect, it } from 'vitest';
import {
  generateIngestSourceSecret,
  generateIngestToken,
  hashIngestTokenSecret,
  parseIngestCredential,
  secretHashesMatch
} from '../tokenSecret';

describe('ingest credential secrets', () => {
  it('generates tokens that parse back into prefix and secret', () => {
    let { prefix, secret, token } = generateIngestToken();

    expect(token.startsWith('metorial_agit_')).toBe(true);
    expect(parseIngestCredential(token)).toEqual({ kind: 'token', prefix, secret });
  });

  it('generates source secrets that parse back as sources', () => {
    let { prefix, secret, token } = generateIngestSourceSecret();

    expect(token.startsWith('metorial_agis_')).toBe(true);
    expect(parseIngestCredential(token)).toEqual({ kind: 'source', prefix, secret });
  });

  it('generates prefixes with at least 16 characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateIngestToken().prefix.length).toBeGreaterThanOrEqual(16);
    }
  });

  it('generates distinct tokens', () => {
    let tokens = new Set(Array.from({ length: 50 }, () => generateIngestToken().token));

    expect(tokens.size).toBe(50);
  });

  it('rejects malformed credentials', () => {
    let { token } = generateIngestToken();

    expect(parseIngestCredential('')).toBeNull();
    expect(parseIngestCredential('Bearer x')).toBeNull();
    expect(parseIngestCredential(token.replace('metorial_agit_', 'sk_'))).toBeNull();
    expect(
      parseIngestCredential(token.replace('metorial_agit_', 'metorial_agix_'))
    ).toBeNull();
    expect(parseIngestCredential(`${token}!`)).toBeNull();
    expect(parseIngestCredential(token.slice(0, -40))).toBeNull();
    expect(parseIngestCredential('metorial_agit_abc_def')).toBeNull();
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
