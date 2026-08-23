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
    portal: {
      findFirst: vi.fn(async () => ({ oid: 1n, slug: 'acme' }))
    },
    instanceConsumer: {
      findFirst: vi.fn(async () => null)
    },
    consumerProviderSetupSessionBinding: {
      create: vi.fn(async () => ({}))
    }
  },
  ID: { generateId: vi.fn(async () => 'cpssb_1') }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial/module-magic', () => ({
  providerTemplateService: {
    getProviderTemplateById: vi.fn(async () => ({
      oid: 2n,
      id: 'prvtpl_1',
      name: 'Acme',
      description: null,
      metadata: null,
      subspaceIntegrationId: 'itg_1'
    }))
  }
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  integrationService: {
    getIntegrationById: vi.fn(async () => ({ id: 'itg_1' }))
  },
  integrationSetupSessionService: {
    createIntegrationSetupSession: vi.fn(async () => ({ id: 'itgss_1' }))
  }
}));

vi.mock('@metorial/portal-url', () => ({
  getPortalUrlForOrigin: vi.fn()
}));

import { integrationSetupSessionService } from '@metorial-subspace/module-integration';
import { consumerProviderSetupSessionService } from '../src/services/consumerProviderSetupSession';
import { getPortalUrlForOrigin } from '@metorial/portal-url';

let startSetup = async (portalUrl: string, requestOrigin?: string) => {
  vi.mocked(getPortalUrlForOrigin).mockResolvedValue(portalUrl);

  await consumerProviderSetupSessionService.startSetupSession({
    instance: { oid: 1n } as any,
    context: { ip: '127.0.0.1', ua: 'test' },
    accessTags: null as any,
    consumerSurface: { oid: 1n } as any,
    consumerProfile: { oid: 1n, consumerOid: 1n } as any,
    providerTemplateId: 'prvtpl_1',
    requestOrigin,
    input: {}
  });

  return vi.mocked(integrationSetupSessionService.createIntegrationSetupSession).mock
    .calls[0]![0].input.redirectUrl;
};

describe('consumer provider setup redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends the completion path to a portal-specific namespace host', async () => {
    expect(await startSetup('https://acme-portal.portals.metorial.com')).toBe(
      'https://acme-portal.portals.metorial.com/provider-setup-complete'
    );
  });

  it('keeps the slug prefix of a shared namespace host', async () => {
    expect(await startSetup('https://acme.portals.metorial.com/p/acme')).toBe(
      'https://acme.portals.metorial.com/p/acme/provider-setup-complete'
    );
  });

  it('drops any query and hash the portal URL carries', async () => {
    expect(await startSetup('https://acme.portals.metorial.com/p/acme?a=1#b')).toBe(
      'https://acme.portals.metorial.com/p/acme/provider-setup-complete'
    );
  });

  it('does not double up slashes on a trailing-slash portal URL', async () => {
    expect(await startSetup('https://acme-portal.portals.metorial.com/')).toBe(
      'https://acme-portal.portals.metorial.com/provider-setup-complete'
    );
  });

  it('resolves the portal URL against the origin the setup was started from', async () => {
    await startSetup(
      'https://acme-portal.portals.metorial.com',
      'https://acme-portal.portals.metorial.com'
    );

    expect(getPortalUrlForOrigin).toHaveBeenCalledWith({
      portal: { oid: 1n, slug: 'acme' },
      origin: 'https://acme-portal.portals.metorial.com'
    });
  });
});
