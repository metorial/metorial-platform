import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerAuthConfigCreate: vi.fn(),
  providerAuthConfigUpdate: vi.fn(),
  providerAuthConfigUpdateMany: vi.fn(),
  providerAuthConfigVersionCreate: vi.fn(),
  providerAuthConfigUpdateCreate: vi.fn(),
  providerAuthImportCreate: vi.fn(),
  providerDeploymentUpdate: vi.fn(),
  providerAuthMethodFindMany: vi.fn(),
  providerAuthMethodFindFirst: vi.fn(),
  getCurrentVersionOptional: vi.fn(),
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
    providerDeployment: { update: mocks.providerDeploymentUpdate },
    providerAuthMethod: {
      findMany: mocks.providerAuthMethodFindMany,
      findFirst: mocks.providerAuthMethodFindFirst
    }
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
  providerDeploymentInternalService: {
    getCurrentVersionOptional: mocks.getCurrentVersionOptional
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getConsumerOwnedResourceName: vi.fn(async () => null),
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

describe('getVersionAndAuthMethod auth method resolution', () => {
  let timestamp = new Date('2026-01-01T00:00:00Z');

  let authMethod = (d: {
    id: string;
    globalOid: bigint;
    key: string;
    type?: string;
    isDefault?: boolean;
  }) => ({
    oid: d.globalOid * 10n,
    id: d.id,
    globalOid: d.globalOid,
    specId: `spec_${d.key}`,
    specUniqueIdentifier: `unique_${d.key}`,
    key: d.key,
    callableId: `callable_${d.key}`,
    type: d.type ?? 'oauth',
    isDefault: d.isDefault ?? false,
    createdAt: timestamp
  });

  let resolve = (authMethodId: string) =>
    providerAuthConfigInternalService.getVersionAndAuthMethod({
      tenant: { oid: 10n } as any,
      environment: { oid: 30n } as any,
      provider: { oid: 50n, defaultVariant: null } as any,
      authMethodId
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentVersionOptional.mockResolvedValue({ oid: 80n, specificationOid: 90n });
  });

  it('resolves the requested auth method within the current specification', async () => {
    let requested = authMethod({ id: 'pam_new', globalOid: 1n, key: 'oauth' });
    mocks.providerAuthMethodFindMany.mockResolvedValue([requested]);

    let result = await resolve('pam_new');

    expect(result.authMethod).toBe(requested);
    expect(mocks.providerAuthMethodFindMany.mock.calls[0]![0].where).toEqual({
      providerOid: 50n,
      specificationOid: 90n
    });
    expect(mocks.providerAuthMethodFindFirst).not.toHaveBeenCalled();
  });

  it('re-matches an auth method pinned in an older specification by its key', async () => {
    let rekeyed = authMethod({ id: 'pam_new', globalOid: 2n, key: 'oauth' });
    mocks.providerAuthMethodFindMany.mockResolvedValue([
      authMethod({ id: 'pam_other', globalOid: 3n, key: 'oauth_v2', isDefault: true }),
      rekeyed
    ]);
    mocks.providerAuthMethodFindFirst.mockResolvedValue(
      authMethod({ id: 'pam_old', globalOid: 1n, key: 'oauth' })
    );

    let result = await resolve('pam_old');

    expect(result.authMethod).toBe(rekeyed);
    expect(mocks.providerAuthMethodFindFirst.mock.calls[0]![0].where).toEqual({
      providerOid: 50n,
      id: 'pam_old'
    });
  });

  it('rejects an auth method id that matches nothing', async () => {
    mocks.providerAuthMethodFindMany.mockResolvedValue([
      authMethod({ id: 'pam_new', globalOid: 1n, key: 'oauth' })
    ]);
    mocks.providerAuthMethodFindFirst.mockResolvedValue(null);

    await expect(resolve('pam_missing')).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'invalid_auth_method' })
    });
  });
});
