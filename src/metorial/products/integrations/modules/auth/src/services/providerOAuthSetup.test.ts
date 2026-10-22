import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerOAuthSetupCreate: vi.fn(),
  createBackendOAuthSetup: vi.fn(),
  getVersionAndAuthMethod: vi.fn(),
  getCredentialsForBackendUse: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerOAuthSetup: {
      create: mocks.providerOAuthSetupCreate,
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: vi.fn(),
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` }),
    getOAuthCallbackUrl: vi.fn(async () => 'https://callback.test'),
    ID: { generateId: vi.fn(async () => 'secret') }
  };
});

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedRelation: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ onlyParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ onlyParent: {} }))
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkProviderMatch: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn(async () => ({
    auth: { createProviderOAuthSetup: mocks.createBackendOAuthSetup }
  }))
}));

vi.mock('../env', () => ({
  env: { service: { INTEGRATIONS_API_URL: 'https://integrations.test' } }
}));

vi.mock('../queues/lifecycle/providerOAuthSetup', () => ({
  providerOAuthSetupCreatedQueue: { add: vi.fn() },
  providerOAuthSetupUpdatedQueue: { add: vi.fn() }
}));

vi.mock('./providerAuthConfigInternal', () => ({
  providerAuthConfigInternalService: {
    getVersionAndAuthMethod: mocks.getVersionAndAuthMethod
  }
}));

vi.mock('./providerAuthCredentials', () => ({
  providerAuthCredentialsService: {
    ensureDefaultProviderAuthCredentialsInternal: vi.fn(),
    getProviderAuthCredentialsForBackendUseInternal: mocks.getCredentialsForBackendUse
  }
}));

import { providerOAuthSetupService } from './providerOAuthSetup';

let credentials = { oid: 50n, id: 'pac_1', origin: 'tenant_created' } as any;

let createSetup = (input: { expiresAt?: Date }) =>
  providerOAuthSetupService.createProviderOAuthSetupInternal({
    tenant: { oid: 10n, projectOid: 20n } as any,
    environment: { oid: 30n, instanceOid: 40n } as any,
    provider: {
      oid: 60n,
      defaultVariant: { oid: 61n },
      type: { attributes: { auth: {} } }
    } as any,
    credentials,
    input: { config: {}, ...input }
  });

describe('createProviderOAuthSetupInternal expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getVersionAndAuthMethod.mockResolvedValue({
      version: { oid: 70n },
      authMethod: { oid: 80n, type: 'oauth' }
    });
    mocks.getCredentialsForBackendUse.mockResolvedValue(credentials);
    mocks.createBackendOAuthSetup.mockResolvedValue({ url: 'https://idp.test/authorize' });
    mocks.providerOAuthSetupCreate.mockImplementation(async ({ data }) => data);
  });

  it('stores the requested expiry', async () => {
    let expiresAt = new Date('2030-01-01T00:00:00.000Z');

    await createSetup({ expiresAt });

    expect(mocks.providerOAuthSetupCreate.mock.calls[0]![0].data.expiresAt).toEqual(expiresAt);
  });

  it('defaults to a 30 minute expiry', async () => {
    let before = Date.now();

    await createSetup({});

    let stored: Date = mocks.providerOAuthSetupCreate.mock.calls[0]![0].data.expiresAt;
    expect(stored.getTime()).toBeGreaterThanOrEqual(before + 30 * 60_000);
    expect(stored.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
  });
});
