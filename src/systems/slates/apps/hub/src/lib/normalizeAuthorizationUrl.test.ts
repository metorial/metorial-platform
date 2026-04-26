import { describe, expect, it } from 'vitest';
import { normalizeAuthorizationUrl } from './normalizeAuthorizationUrl';

describe('normalizeAuthorizationUrl', () => {
  it('keeps https authorization URLs and clears userinfo', () => {
    expect(normalizeAuthorizationUrl('https://user:pass@example.com/oauth')).toBe(
      'https://example.com/oauth'
    );
  });

  it('adds https for URLs without a protocol', () => {
    expect(normalizeAuthorizationUrl('example.com/oauth?state=abc')).toBe(
      'https://example.com/oauth?state=abc'
    );
  });

  it('replaces invalid protocols with https', () => {
    expect(normalizeAuthorizationUrl('http://user:pass@example.com/oauth')).toBe(
      'https://example.com/oauth'
    );
    expect(normalizeAuthorizationUrl('ftp://user:pass@example.com/oauth')).toBe(
      'https://example.com/oauth'
    );
  });
});
