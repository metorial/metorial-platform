import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  resolveUsableMaterial: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));
vi.mock('@lowerdeck/pagination', () => ({ Paginator: {} }));
vi.mock('@metorial-subspace/db', () => ({
  db: { integrationProvider: { findMany: mocks.findMany } },
  withTransaction: vi.fn(),
  getId: vi.fn(),
  generateRegionalClientSecret: vi.fn()
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial-subspace/list-utils', () => ({}));
vi.mock('@metorial-subspace/module-auth', () => ({
  providerSetupSessionInclude: {},
  providerSetupSessionService: {}
}));
vi.mock('@metorial-subspace/module-tenant', () => ({}));
vi.mock('../src/lib/versions', () => ({}));
vi.mock('../src/lib/integrationIncludes', () => ({ integrationProviderVersionInclude: {} }));
vi.mock('../src/services/integration', () => ({}));
vi.mock('../src/services/integrationInstance', () => ({
  integrationInstanceInclude: {},
  integrationInstanceProviderInclude: {},
  integrationInstanceService: {}
}));
vi.mock('../src/services/integrationInstanceProvider', () => ({
  integrationInstanceProviderService: {}
}));
vi.mock('../src/services/integrationProvider', () => ({
  integrationProviderService: {
    resolveUsableIntegrationProviderMaterialInternal: mocks.resolveUsableMaterial
  }
}));

import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { integrationSetupSessionService } from '../src/services/integrationSetupSession';

let credentialsUnavailable = () =>
  new ServiceError(
    preconditionFailedError({
      code: 'integration_provider_credentials_unavailable',
      message: 'removed'
    })
  );

let getUsableIntegrationProviders = () =>
  (integrationSetupSessionService as any).getUsableIntegrationProviders({
    tenant: { oid: 1n },
    environment: { oid: 2n },
    integration: { oid: 3n }
  });

describe('integration setup session usable providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      { oid: 10n, id: 'ipr_broken' },
      { oid: 11n, id: 'ipr_ok' }
    ]);
  });

  it('skips providers whose credentials cannot be replaced', async () => {
    mocks.resolveUsableMaterial
      .mockRejectedValueOnce(credentialsUnavailable())
      .mockResolvedValueOnce({ isHealed: false });

    let providers = await getUsableIntegrationProviders();

    expect(providers.map((p: any) => p.id)).toEqual(['ipr_ok']);
  });

  it('reloads providers after healing and still skips unusable ones', async () => {
    mocks.resolveUsableMaterial
      .mockRejectedValueOnce(credentialsUnavailable())
      .mockResolvedValueOnce({ isHealed: true });

    let providers = await getUsableIntegrationProviders();

    expect(mocks.findMany).toHaveBeenCalledTimes(2);
    expect(providers.map((p: any) => p.id)).toEqual(['ipr_ok']);
  });

  it('surfaces the credentials error when no provider is usable', async () => {
    mocks.resolveUsableMaterial.mockRejectedValue(credentialsUnavailable());

    await expect(getUsableIntegrationProviders()).rejects.toMatchObject({
      data: { code: 'integration_provider_credentials_unavailable' }
    });
  });

  it('propagates unexpected errors', async () => {
    mocks.resolveUsableMaterial
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ isHealed: false });

    await expect(getUsableIntegrationProviders()).rejects.toThrow('db down');
  });
});
