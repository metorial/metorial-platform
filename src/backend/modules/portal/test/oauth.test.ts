import { describe, expect, it } from 'vitest';
import {
  defaultPortalAllowedRedirectUrlFilters,
  portalAllowedRedirectUrlFilterMatches,
  validatePortalAllowedRedirectUrlFilters,
  validatePortalRedirectUrisAgainstAllowedFilters
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
  });

  it('rejects client redirect uris outside the portal allowlist', () => {
    expect(() =>
      validatePortalRedirectUrisAgainstAllowedFilters({
        redirectUris: ['https://example.com/callback'],
        allowedRedirectUrlFilters: [{ url: 'http://localhost:*/*' }]
      })
    ).toThrow('redirect_uri is not allowed for this portal');
  });
});
