import { describe, expect, it } from 'vitest';
import {
  defaultPortalAllowedRedirectUrlFilters,
  portalAllowedRedirectUrlFiltersEqual,
  portalAllowedRedirectUrlFilterMatches,
  validatePortalRedirectUriAgainstAllowedFilters,
  validatePortalAllowedRedirectUrlFilters,
  validatePortalRedirectUrisAgainstAllowedFilters,
  validateRedirectUri,
  validateUrlString
} from '../src/lib/oauth';

describe('portal oauth redirect filters', () => {
  it('matches the default portal redirect filters', () => {
    expect(defaultPortalAllowedRedirectUrlFilters.map(filter => filter.url)).toStrictEqual([
      'http://localhost:*/*',
      'http://*.localhost:*/*',
      'https://*/*',
      '*://*'
    ]);

    expect(
      portalAllowedRedirectUrlFilterMatches(
        { url: 'http://localhost:*/*' },
        'http://localhost'
      )
    ).toBe(true);
    expect(
      portalAllowedRedirectUrlFilterMatches(
        { url: 'http://localhost:*/*' },
        'http://localhost:4310/callback'
      )
    ).toBe(true);
    expect(
      portalAllowedRedirectUrlFilterMatches(
        { url: 'http://*.localhost:*/*' },
        'http://testing.localhost:4310/callback'
      )
    ).toBe(true);
    expect(
      portalAllowedRedirectUrlFilterMatches(
        { url: 'http://*.localhost:*/*' },
        'http://localhost:4310/callback'
      )
    ).toBe(false);
    expect(
      portalAllowedRedirectUrlFilterMatches(
        { url: 'http://localhost:*/*' },
        'http://127.0.0.1:4310/callback'
      )
    ).toBe(true);
    expect(
      portalAllowedRedirectUrlFilterMatches({ url: 'https://*/*' }, 'https://example.com/test')
    ).toBe(true);
    expect(
      portalAllowedRedirectUrlFilterMatches({ url: 'https://*/*' }, 'http://example.com/test')
    ).toBe(false);
    expect(portalAllowedRedirectUrlFilterMatches({ url: '*://*' }, 'custom://oauth')).toBe(
      true
    );
    expect(portalAllowedRedirectUrlFilterMatches({ url: '*://*' }, 'http://localhost')).toBe(
      false
    );
    expect(
      portalAllowedRedirectUrlFilterMatches({ url: '*://*' }, 'https://example.com')
    ).toBe(false);
  });

  it('accepts custom protocols with wildcard hosts', () => {
    expect(
      portalAllowedRedirectUrlFilterMatches({ url: 'custom://*' }, 'custom://oauth')
    ).toBe(true);
    expect(
      portalAllowedRedirectUrlFilterMatches(
        { url: 'custom://*' },
        'custom://oauth/callback/path'
      )
    ).toBe(true);
    expect(portalAllowedRedirectUrlFilterMatches({ url: 'custom://*' }, 'other://oauth')).toBe(
      false
    );
  });

  it('rejects unsupported filter patterns', () => {
    expect(() =>
      validatePortalAllowedRedirectUrlFilters([{ url: 'http://loc*alhost:*/*' }])
    ).toThrow('unsupported hostname wildcard');
    expect(() => validatePortalAllowedRedirectUrlFilters([{ url: 'ssh://*' }])).toThrow(
      'blocked redirect protocol'
    );
  });

  it('allows client registration when at least one redirect uri matches the portal allowlist', () => {
    expect(() =>
      validatePortalRedirectUrisAgainstAllowedFilters({
        redirectUris: ['https://example.com/callback', 'http://127.0.0.1:33418/'],
        allowedRedirectUrlFilters: [{ url: 'http://localhost:*/*' }]
      })
    ).not.toThrow();
  });

  it('rejects authorization redirect uris outside the portal allowlist', () => {
    expect(() =>
      validatePortalRedirectUriAgainstAllowedFilters({
        redirectUri: 'https://example.com/callback',
        allowedRedirectUrlFilters: [{ url: 'http://localhost:*/*' }]
      })
    ).toThrow('redirect_uri is not allowed for this portal');
  });

  it('treats loopback hosts as equivalent during redirect uri matching', () => {
    expect(() =>
      validateRedirectUri('http://127.0.0.1:33418/', ['http://localhost:33418/'])
    ).not.toThrow();
  });

  it('rejects blocked well known redirect protocols', () => {
    expect(() => validateUrlString('ftp://example.com/callback', 'redirect_uri')).toThrow(
      'blocked redirect protocol'
    );
    expect(() =>
      portalAllowedRedirectUrlFilterMatches({ url: '*://*' }, 'ssh://example.com/callback')
    ).toThrow('blocked redirect protocol');
  });

  it('normalizes the default filters back to null storage', () => {
    expect(
      portalAllowedRedirectUrlFiltersEqual(
        [
          { url: 'https://*/*' },
          { url: '*://*' },
          { url: 'http://*.localhost:*/*' },
          { url: 'http://127.0.0.1:*/*' }
        ],
        defaultPortalAllowedRedirectUrlFilters
      )
    ).toBe(true);
  });
});
