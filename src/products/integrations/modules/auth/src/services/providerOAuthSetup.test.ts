import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  oauthSetupCreate: vi.fn(),
  createBackendOAuthSetup: vi.fn(),
  getVersionAndAuthMethod: vi.fn(),
  getDefaultOAuthCredentialsForMethodInternal: vi.fn(),
  getInstallationTemplateDefaultInternal: vi.fn(),
  findAuthMethods: vi.fn()
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
    },
    providerAuthMethod: { findMany: mocks.findAuthMethods }
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
    getDefaultOAuthCredentialsForMethodInternal:
      mocks.getDefaultOAuthCredentialsForMethodInternal,
    getInstallationTemplateDefaultInternal: mocks.getInstallationTemplateDefaultInternal,
    getProviderAuthCredentialsForBackendUseInternal: vi.fn(
      async (d: { providerAuthCredentials: unknown }) => d.providerAuthCredentials
    )
  }
}));

import { providerOAuthSetupService } from './providerOAuthSetup';

let create = (input: Record<string, any> = {}, useExplicitCredentials = true) =>
  providerOAuthSetupService.createProviderOAuthSetupInternal({
    tenant: { oid: 10n, projectOid: 20n } as any,
    environment: { oid: 30n, instanceOid: 40n } as any,
    provider: {
      oid: 50n,
      defaultVariant: { oid: 51n },
      type: { attributes: { auth: {} } }
    } as any,
    credentials: useExplicitCredentials
      ? ({ oid: 70n, origin: 'managed_public' } as any)
      : undefined,
    input: { config: {}, ...input }
  });

let createdExpiresAt = () => mocks.oauthSetupCreate.mock.calls[0]![0].data.expiresAt as Date;

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getVersionAndAuthMethod.mockResolvedValue({
    version: { oid: 80n, specificationOid: 90n },
    authMethod: { oid: 60n, id: 'pam_github', key: 'github', type: 'oauth' }
  });
  mocks.getDefaultOAuthCredentialsForMethodInternal.mockResolvedValue(null);
  mocks.createBackendOAuthSetup.mockResolvedValue({ url: 'https://hub.test/authorize' });
  mocks.oauthSetupCreate.mockImplementation(async ({ data }: { data: unknown }) => data);
});

describe('createProviderOAuthSetupInternal OAuth app choice', () => {
  let enterpriseMethod = { oid: 61n, key: 'github_enterprise', type: 'oauth' };
  let enterpriseApp = {
    oid: 71n,
    fixedAuthMethodKey: enterpriseMethod.key,
    origin: 'installation_template'
  };

  it('keeps the requested method when it has no compatible credentials', async () => {
    await expect(create({ authMethodId: 'pam_github' }, false)).rejects.toMatchObject({
      data: { code: 'missing_auth_credentials' }
    });
    expect(mocks.getDefaultOAuthCredentialsForMethodInternal).toHaveBeenCalledWith(
      expect.objectContaining({ authMethod: expect.objectContaining({ id: 'pam_github' }) })
    );
    expect(mocks.getInstallationTemplateDefaultInternal).not.toHaveBeenCalled();
    expect(mocks.createBackendOAuthSetup).not.toHaveBeenCalled();
  });

  it('uses an available installation app when the caller leaves the method open', async () => {
    mocks.findAuthMethods.mockResolvedValue([enterpriseMethod]);
    mocks.getInstallationTemplateDefaultInternal.mockResolvedValue(enterpriseApp);

    await create({}, false);

    expect(mocks.createBackendOAuthSetup).toHaveBeenCalledWith(
      expect.objectContaining({ authMethod: enterpriseMethod, credentials: enterpriseApp })
    );
  });
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
