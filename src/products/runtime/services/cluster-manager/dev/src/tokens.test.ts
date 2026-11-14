import { describe, expect, test } from 'bun:test';
import { refreshDelay, tokenExpiry } from './tokens';

let jwt = (claims: object) =>
  ['{"alg":"RS256"}', JSON.stringify(claims)]
    .map(part => Buffer.from(part).toString('base64url'))
    .join('.') + '.signature';

describe('caller tokens', () => {
  test('reads the expiry from the token', () => {
    expect(tokenExpiry(jwt({ exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
    expect(() => tokenExpiry(jwt({ sub: 'x' }))).toThrow(/exp/);
  });

  test('refreshes at half the remaining lifetime, at most once a minute', () => {
    let now = 1_000_000;

    expect(refreshDelay(now + 24 * 3_600_000, now)).toBe(12 * 3_600_000);
    expect(refreshDelay(now + 3_600_000, now)).toBe(1_800_000);
    expect(refreshDelay(now + 10_000, now)).toBe(60_000);
    expect(refreshDelay(now - 10_000, now)).toBe(60_000);
  });
});
