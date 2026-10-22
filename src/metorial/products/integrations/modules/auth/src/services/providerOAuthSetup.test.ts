import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  oauthSetupCreate: vi.fn(),
  createBackendOAuthSetup: vi.fn(),
  getVersionAndAuthMethod: vi.fn()
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
      create: mocks.oauthSetupCreate,
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
    getOAuthCallbackUrl: vi.fn(async () => null),
    ID: { generateId: vi.fn(async () => 'client-secret') }
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
  env: { service: { INTEGRATIONS_API_URL: 'http://integrations.test' } }
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
    getProviderAuthCredentialsForBackendUseInternal: vi.fn(
      async (d: { providerAuthCredentials: unknown }) => d.providerAuthCredentials
    )
  }
}));

import { providerOAuthSetupService } from './providerOAuthSetup';

let create = (input: Record<string, any> = {}) =>
  providerOAuthSetupService.createProviderOAuthSetupInternal({
    tenant: { oid: 10n, projectOid: 20n } as any,
    environment: { oid: 30n, instanceOid: 40n } as any,
    provider: { oid: 50n, defaultVariant: { oid: 51n }, type: { attributes: {} } } as any,
    credentials: { oid: 70n, origin: 'managed_public' } as any,
    input: { config: {}, ...input }
  });

let createdExpiresAt = () => mocks.oauthSetupCreate.mock.calls[0]![0].data.expiresAt as Date;

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getVersionAndAuthMethod.mockResolvedValue({
    version: { oid: 80n },
    authMethod: { oid: 60n, type: 'oauth' }
  });
  mocks.createBackendOAuthSetup.mockResolvedValue({ url: 'https://hub.test/authorize' });
  mocks.oauthSetupCreate.mockImplementation(async ({ data }: { data: unknown }) => data);
});

describe('createProviderOAuthSetupInternal expiry', () => {
  it('uses the expiry it is given', async () => {
    let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await create({ expiresAt, isAdminSetup: true });

    expect(createdExpiresAt()).toEqual(expiresAt);
  });

  it('defaults to 30 minutes without an expiry', async () => {
    let before = Date.now();

    await create();

    let ttl = createdExpiresAt().getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(30 * 60 * 1000);
    expect(ttl).toBeLessThan(31 * 60 * 1000);
  });
});
