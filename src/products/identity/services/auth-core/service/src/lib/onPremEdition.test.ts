import { afterEach, describe, expect, it, vi } from 'vitest';

let load = async <T>(importer: () => Promise<T>, edition: string) => {
  process.env.METORIAL_EDITION = edition;
  process.env.METORIAL_PUBLIC_URL = 'https://metorial.example.com';
  vi.resetModules();
  return importer();
};

afterEach(() => {
  delete process.env.METORIAL_EDITION;
  delete process.env.METORIAL_PUBLIC_URL;
  delete process.env.ASSETS_BASE_URL;
  delete process.env.AVATAR_BASE_URL;
  delete process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
});

describe('ares editions', () => {
  it('derives the on-prem delegation fallback from the auth url argument', async () => {
    let { getExportedDelegationRedirectUri } = await load(
      () => import('./ssoDelegationProtocol'),
      'on-prem'
    );

    expect(getExportedDelegationRedirectUri(null, 'https://id.example.com')).toBe(
      'https://id.example.com/metorial-ares/hooks/sso-delegation-response'
    );
    expect(getExportedDelegationRedirectUri('https://stored.example/cb', 'https://x')).toBe(
      'https://stored.example/cb'
    );
  });

  it('keeps the cloud delegation fallback', async () => {
    let { getExportedDelegationRedirectUri } = await load(
      () => import('./ssoDelegationProtocol'),
      'cloud'
    );

    expect(getExportedDelegationRedirectUri(null, 'https://ignored.example.com')).toBe(
      'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response'
    );
  });

  it('keeps the cloud cors allowlist', async () => {
    let { aresCorsDomains } = await load(() => import('./corsDomains'), 'cloud');

    expect(aresCorsDomains()).toEqual(
      expect.arrayContaining([
        'localhost',
        'metorial.test',
        'metorial.com',
        'metorial.work',
        'metorial.app',
        'metorial.cloud'
      ])
    );
  });

  it('allows images from the on-prem asset origins', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AVATAR_BASE_URL = 'https://avatars.example.net/a';
    let { withSecurityHeaders } = await load(() => import('./securityHeaders'), 'on-prem');
    process.env.NODE_ENV = 'production';

    let response = await withSecurityHeaders(async () => new Response('ok'))(
      new Request('https://id.example.com/login'),
      undefined
    );
    let csp = response.headers.get('content-security-policy')!;

    expect(csp).toContain("img-src 'self' data: https://metorial.example.com");
    expect(csp).toContain('https://avatars.example.net');
  });
});
