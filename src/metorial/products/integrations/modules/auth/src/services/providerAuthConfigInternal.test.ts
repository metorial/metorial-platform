import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerAuthConfigCreate: vi.fn(),
  providerAuthConfigUpdate: vi.fn(),
  providerAuthConfigUpdateMany: vi.fn(),
  providerAuthConfigVersionCreate: vi.fn(),
  providerAuthConfigUpdateCreate: vi.fn(),
  providerAuthImportCreate: vi.fn(),
  providerDeploymentUpdate: vi.fn(),
  addAfterTransactionHook: vi.fn(),
  queueAdd: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerAuthConfig: {
      create: mocks.providerAuthConfigCreate,
      update: mocks.providerAuthConfigUpdate,
      updateMany: mocks.providerAuthConfigUpdateMany
    },
    providerAuthConfigVersion: { create: mocks.providerAuthConfigVersionCreate },
    providerAuthConfigUpdate: { create: mocks.providerAuthConfigUpdateCreate },
    providerAuthImport: { create: mocks.providerAuthImportCreate },
    providerDeployment: { update: mocks.providerDeploymentUpdate }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: mocks.addAfterTransactionHook,
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` }),
    ProviderAuthMethodType: { oauth: 'oauth' }
  };
});

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkProviderMatch: vi.fn(),
  providerDeploymentInternalService: { getCurrentVersionOptional: vi.fn() }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' }))
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn()
}));

vi.mock('../queues/lifecycle/providerAuthConfig', () => ({
  providerAuthConfigCreatedQueue: { add: mocks.queueAdd }
}));

vi.mock('./providerAuthConfig', () => ({
  providerAuthConfigInclude: {}
}));

import { providerAuthConfigInternalService } from './providerAuthConfigInternal';

let makeParams = ({
  projectOid = 20n as bigint | null,
  instanceOid = 40n as bigint | null
} = {}) => ({
  tenant: { oid: 10n, projectOid } as any,
  environment: { oid: 30n, instanceOid } as any,
  provider: { oid: 50n } as any,
  backend: { oid: 60n } as any,
  type: 'manual' as const,
  source: 'manual' as const,
  authMethod: { oid: 70n, type: 'password' } as any,
  input: {},
  import: { ip: '127.0.0.1', ua: 'test-agent' },
  backendProviderAuthConfig: {
    slateAuthConfig: undefined,
    shuttleAuthConfig: undefined,
    expiresAt: null
  } as any
});

describe('createProviderAuthConfigInternal double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerAuthConfigCreate.mockResolvedValue({
      oid: 100n,
      id: 'pac_1',
      source: 'manual',
      type: 'manual',
      isDefault: false
    });
    mocks.providerAuthConfigVersionCreate.mockResolvedValue({ oid: 200n });
    mocks.providerAuthConfigUpdateCreate.mockResolvedValue({ oid: 300n });
    mocks.providerAuthImportCreate.mockResolvedValue({ oid: 400n });
  });

  it('mirrors the tenant project and environment instance onto the auth config', async () => {
    await providerAuthConfigInternalService.createProviderAuthConfigInternal(
      makeParams() as any
    );

    expect(mocks.providerAuthConfigCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerAuthConfigCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('mirrors the tenant project and environment instance onto the auth import', async () => {
    await providerAuthConfigInternalService.createProviderAuthConfigInternal(
      makeParams() as any
    );

    expect(mocks.providerAuthImportCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerAuthImportCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('keeps the mirrored oids null while the tenant is not linked yet', async () => {
    await providerAuthConfigInternalService.createProviderAuthConfigInternal(
      makeParams({ projectOid: null, instanceOid: null }) as any
    );

    expect(mocks.providerAuthConfigCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: null,
      environmentOid: 30n,
      instanceOid: null
    });
    expect(mocks.providerAuthImportCreate.mock.calls[0]![0].data).toMatchObject({
      projectOid: null,
      instanceOid: null
    });
  });
});
