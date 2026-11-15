import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerAuthAttempt: {
      create: vi.fn(async () => ({ id: 'cnat_1' }))
    }
  },
  ID: { generateId: vi.fn(async () => 'cnat_1') }
}));

vi.mock('@metorial/consumer-oauth-utils', () => ({
  getPortalAllowedRedirectUrlFilters: vi.fn(() => []),
  validatePortalRedirectUriAgainstAllowedFilters: vi.fn(),
  validateRedirectUri: vi.fn()
}));

vi.mock('@metorial/module-portal', () => ({
  portalService: {
    getPrimaryPortalUrl: vi.fn()
  }
}));

vi.mock('../src/services/_helpers', () => ({
  buildDashboardConsumerAuthUrl: vi.fn(() => 'https://app.metorial.test/dashboard'),
  getConsumerAuthClient: vi.fn(async () => ({
    oid: 1n,
    redirectUris: [],
    skillPluginOid: null
  })),
  resolveConsumerSurface: vi.fn(() => ({ oid: 1n }))
}));

vi.mock('../src/services/client', () => ({
  consumerOAuthClientService: {}
}));

import { portalService } from '@metorial/module-portal';
import { consumerOAuthAuthorizationService } from '../src/services/authorization';

let authorize = async (portalUrl: string) => {
  vi.mocked(portalService.getPrimaryPortalUrl).mockResolvedValue(portalUrl);

  let { redirectUrl } =
    await consumerOAuthAuthorizationService.createConsumerAuthAuthorization({
      portal: { oid: 1n, slug: 'acme' } as any,
      magicMcpTarget: null,
      input: {
        responseType: 'code',
        clientId: 'client_1',
        redirectUri: 'https://client.test/callback',
        state: 'state_1'
      }
    });

  return redirectUrl;
};

describe('portal OAuth authorize redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends the authorize path to a portal-specific namespace host', async () => {
    expect(await authorize('https://acme-portal.portals.metorial.com')).toBe(
      'https://acme-portal.portals.metorial.com/oauth/authorize/cnat_1'
    );
  });

  it('keeps the slug prefix of a shared namespace host', async () => {
    expect(await authorize('https://acme.portals.metorial.com/p/acme')).toBe(
      'https://acme.portals.metorial.com/p/acme/oauth/authorize/cnat_1'
    );
  });

  it('drops any query and hash the portal URL carries', async () => {
    expect(await authorize('https://acme.portals.metorial.com/p/acme?a=1#b')).toBe(
      'https://acme.portals.metorial.com/p/acme/oauth/authorize/cnat_1'
    );
  });

  it('does not double up slashes on a trailing-slash portal URL', async () => {
    expect(await authorize('https://acme-portal.portals.metorial.com/')).toBe(
      'https://acme-portal.portals.metorial.com/oauth/authorize/cnat_1'
    );
  });
});
