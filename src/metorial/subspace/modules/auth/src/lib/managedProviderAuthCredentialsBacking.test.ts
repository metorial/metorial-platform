import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerAuthCredentialsCreate: vi.fn(),
  providerAuthCredentialsUpdate: vi.fn(),
  managedBackingFindUnique: vi.fn(),
  managedBackingCreate: vi.fn(),
  addAfterTransactionHook: vi.fn(),
  backendCreateProviderAuthCredentials: vi.fn(),
  queueAdd: vi.fn()
}));

vi.mock('@lowerdeck/error', () => ({
  badRequestError: vi.fn((error: unknown) => error),
  ServiceError: class ServiceError extends Error {
    constructor(public error: unknown) {
      super('ServiceError');
    }
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: vi.fn(() => ({ usingLock: (_keys: unknown, fn: () => unknown) => fn() }))
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerAuthCredentials: {
      create: mocks.providerAuthCredentialsCreate,
      update: mocks.providerAuthCredentialsUpdate
    },
    managedProviderAuthCredentialsBacking: {
      findUnique: mocks.managedBackingFindUnique,
      create: mocks.managedBackingCreate
    }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: mocks.addAfterTransactionHook,
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` }),
    snowflake: { nextId: () => 99n }
  };
});

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' }))
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn(async () => ({
    backend: { oid: 60n },
    auth: {
      createProviderAuthCredentials: mocks.backendCreateProviderAuthCredentials
    }
  }))
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../queues/lifecycle/providerAuthCredentials', () => ({
  providerAuthCredentialsCreatedQueue: { add: mocks.queueAdd },
  providerAuthCredentialsUpdatedQueue: { add: mocks.queueAdd }
}));

import { ensureManagedProviderAuthCredentialsBacking } from './managedProviderAuthCredentialsBacking';

let tenant = { oid: 10n, id: 'ktn_1', projectOid: 20n };
let managedCredentials = {
  oid: 80n,
  name: 'Managed',
  description: null,
  metadata: {},
  status: 'active',
  updatedAt: new Date('2026-01-01'),
  oauthClientId: 'client',
  oauthClientSecret: 'secret',
  oauthScopes: ['read'],
  providerAuthMethodGlobalOid: 5n,
  provider: {
    oid: 50n,
    defaultVariant: { oid: 51n, backendOid: 60n }
  },
  initialProviderAuthMethod: {
    globalOid: 5n,
    provider: {
      oid: 50n,
      defaultVariant: { oid: 51n, backendOid: 60n }
    }
  }
};

describe('ensureManagedProviderAuthCredentialsBacking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.managedBackingFindUnique.mockResolvedValue(null);
    mocks.backendCreateProviderAuthCredentials.mockResolvedValue({
      type: 'oauth',
      isAutoRegistration: false,
      slateOAuthCredentials: undefined,
      shuttleOAuthCredentials: undefined
    });
    mocks.providerAuthCredentialsCreate.mockResolvedValue({
      oid: 100n,
      id: 'pacr_1'
    });
    mocks.managedBackingCreate.mockResolvedValue({});
  });

  it('stamps projectOid from the tenant and leaves environment oids unset', async () => {
    await ensureManagedProviderAuthCredentialsBacking({
      tenant: tenant as any,
      managedCredentials: managedCredentials as any,
      providerAuthMethod: { globalOid: 5n }
    });

    expect(mocks.providerAuthCredentialsCreate).toHaveBeenCalledTimes(1);
    let data = mocks.providerAuthCredentialsCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n
    });
    expect(data).not.toHaveProperty('environmentOid');
    expect(data).not.toHaveProperty('instanceOid');
  });

  it('backfills projectOid on update without writing environment oids', async () => {
    mocks.managedBackingFindUnique.mockResolvedValue({
      providerAuthCredentials: {
        oid: 100n,
        id: 'pacr_1',
        status: 'active',
        scopes: ['read'],
        updatedAt: new Date(0)
      }
    });
    mocks.providerAuthCredentialsUpdate.mockResolvedValue({
      oid: 100n,
      id: 'pacr_1'
    });

    await ensureManagedProviderAuthCredentialsBacking({
      tenant: tenant as any,
      managedCredentials: managedCredentials as any,
      providerAuthMethod: { globalOid: 5n }
    });

    expect(mocks.providerAuthCredentialsUpdate).toHaveBeenCalledTimes(1);
    let data = mocks.providerAuthCredentialsUpdate.mock.calls[0]![0].data;
    expect(data).toMatchObject({ projectOid: 20n });
    expect(data).not.toHaveProperty('environmentOid');
    expect(data).not.toHaveProperty('instanceOid');
  });

  it('backfills missing projectOid on an already-fresh backing without resyncing the backend', async () => {
    mocks.managedBackingFindUnique.mockResolvedValue({
      providerAuthCredentials: {
        oid: 100n,
        id: 'pacr_1',
        status: 'active',
        scopes: ['read'],
        updatedAt: new Date('2026-02-01'),
        projectOid: null
      }
    });
    mocks.providerAuthCredentialsUpdate.mockResolvedValue({
      oid: 100n,
      id: 'pacr_1'
    });

    await ensureManagedProviderAuthCredentialsBacking({
      tenant: tenant as any,
      managedCredentials: managedCredentials as any,
      providerAuthMethod: { globalOid: 5n }
    });

    expect(mocks.backendCreateProviderAuthCredentials).not.toHaveBeenCalled();
    expect(mocks.providerAuthCredentialsUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.providerAuthCredentialsUpdate.mock.calls[0]![0].data).toEqual({
      projectOid: 20n
    });
  });
});
