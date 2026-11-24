import { describe, expect, it } from 'vitest';
import {
  extractGatewayToken,
  generateGatewayToken,
  hashGatewayTokenSecret,
  parseGatewayToken,
  secretHashesMatch
} from '../src/lib/tokenSecret';

describe('gateway token secrets', () => {
  it('generates tokens that parse back into their prefix and secret', () => {
    let { prefix, secret, token } = generateGatewayToken();

    expect(token).toMatch(/^metorial_aigt_[0-9A-Za-z]+_[0-9A-Za-z]+$/);
    expect(parseGatewayToken(token)).toEqual({ prefix, secret });
  });

  it('generates distinct tokens', () => {
    let tokens = new Set(Array.from({ length: 50 }, () => generateGatewayToken().token));

    expect(tokens.size).toBe(50);
  });

  it.each([
    '',
    'sk-ant-api03-something',
    'metorial_agit_abcdefghij_abcdefghijabcdefghijabcdefghijabcdefghij',
    'metorial_aigt_short_abcdefghijabcdefghijabcdefghijabcdefghij',
    'metorial_aigt_abcdefghij_tooshort',
    'metorial_aigt_abc-defghij_abcdefghijabcdefghijabcdefghijabcdefghij',
    ' metorial_aigt_abcdefghij_abcdefghijabcdefghijabcdefghijabcdefghij'
  ])('rejects malformed token %j', token => {
    expect(parseGatewayToken(token)).toBeNull();
  });

  it('matches hashes of the same secret only', async () => {
    let { secret } = generateGatewayToken();
    let hash = await hashGatewayTokenSecret(secret);

    expect(secretHashesMatch(hash, await hashGatewayTokenSecret(secret))).toBe(true);
    expect(secretHashesMatch(hash, await hashGatewayTokenSecret(`${secret}x`))).toBe(false);
    expect(secretHashesMatch(hash, hash.slice(1))).toBe(false);
  });
});

describe('extractGatewayToken', () => {
  it('reads OpenAI-style bearer tokens', () => {
    expect(extractGatewayToken({ authorization: 'Bearer metorial_aigt_a_b' })).toBe(
      'metorial_aigt_a_b'
    );
    expect(extractGatewayToken({ authorization: 'bearer   tok ' })).toBe('tok');
  });

  it('reads Anthropic-style x-api-key tokens', () => {
    expect(extractGatewayToken({ apiKey: 'tok' })).toBe('tok');
  });

  it('prefers the bearer token when both are sent', () => {
    expect(extractGatewayToken({ authorization: 'Bearer one', apiKey: 'two' })).toBe('one');
  });

  it('ignores non-bearer authorization schemes', () => {
    expect(extractGatewayToken({ authorization: 'Basic abc' })).toBeUndefined();
    expect(extractGatewayToken({})).toBeUndefined();
  });
});
