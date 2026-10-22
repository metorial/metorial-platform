import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  sessionFindFirstOrThrow: vi.fn(),
  sessionUpdate: vi.fn(),
  sessionEventCreateMany: vi.fn(async () => ({ count: 1 })),
  oauthSetupUpdate: vi.fn(),
  authConfigUpdate: vi.fn(),
  defaultCredentialsFindFirst: vi.fn(),
  getVersionAndAuthMethod: vi.fn(),
  createProviderOAuthSetupInternal: vi.fn(),
  createIdentityCredentialInternal: vi.fn(),
  createProviderConfigInternal: vi.fn(),
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
    providerSetupSession: {
      findFirstOrThrow: mocks.sessionFindFirstOrThrow,
      update: mocks.sessionUpdate
    },
    providerSetupSessionEvent: { createMany: mocks.sessionEventCreateMany },
    providerOAuthSetup: { update: mocks.oauthSetupUpdate },
    providerAuthConfig: { update: mocks.authConfigUpdate, updateMany: vi.fn() },
    providerConfig: { updateMany: vi.fn() },
    providerAuthCredentials: { findFirst: mocks.defaultCredentialsFindFirst },
    identity: { findFirstOrThrow: vi.fn(async () => ({ oid: 5n })) },
    tenant: { findFirstOrThrow: vi.fn(async () => ({ oid: 10n })) },
    environment: { findFirstOrThrow: vi.fn(async () => ({ oid: 30n, instanceOid: 40n })) }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: vi.fn(),
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` }),
    ProviderSetupSessionTypeConcrete: {}
  };
});

vi.mock('@metorial-subspace/module-deployment', () => ({
  providerConfigService: {
    createProviderConfigInternal: mocks.createProviderConfigInternal,
    getProviderConfigSchemaInternal: vi.fn()
  }
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityCredentialService: {
    createIdentityCredentialInternal: mocks.createIdentityCredentialInternal
  }
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  assertAuthMethodAllowedForTenant: vi.fn(),
  checkProviderMatch: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  getSubspaceSystemProviderEventBase: vi.fn(async () => ({}))
}));

vi.mock('@metorial-subspace/provider-utils', () => ({
  normalizeJsonSchema: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../lib/publicMcpOwnership', () => ({
  stampPublicMcpOwnership: vi.fn()
}));

vi.mock('../queues/lifecycle/providerSetupSession', () => ({
  providerSetupSessionUpdatedQueue: { add: mocks.queueAdd }
}));

vi.mock('./providerAuthConfig', () => ({
  providerAuthConfigService: { createProviderAuthConfigInternal: vi.fn() }
}));

vi.mock('./providerAuthConfigInternal', () => ({
  providerAuthConfigInternalService: {
    getVersionAndAuthMethod: mocks.getVersionAndAuthMethod
  }
}));

vi.mock('./providerOAuthSetup', () => ({
  providerOAuthSetupService: {
    createProviderOAuthSetupInternal: mocks.createProviderOAuthSetupInternal
  }
}));

import { providerSetupSessionInternalService } from './providerSetupSessionInternal';

let context = { ip: '127.0.0.1', ua: 'test-agent' };

let sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

let adminAuthMethod = (
  capabilities: Record<string, any> = { adminSetup: { enabled: true } }
) => ({
  oid: 60n,
  id: 'pam_1',
  type: 'oauth',
  value: { capabilities }
});

let provider = {
  oid: 50n,
  defaultVariant: { oid: 51n },
  type: {
    attributes: {
      auth: { status: 'enabled', oauth: {} },
      config: { status: 'enabled' }
    }
  }
};

let initialize = (input: Record<string, any> = {}) =>
  providerSetupSessionInternalService.initializeProviderSetupSessionProvider({
    tenant: { oid: 10n } as any,
    environment: { oid: 30n, instanceOid: 40n } as any,
    provider: provider as any,
    credentials: { oid: 70n } as any,
    expiresAt: sessionExpiresAt,
    input: { type: 'admin', ...input },
    import: { ip: undefined, ua: undefined }
  });

let session = (overrides: Record<string, unknown> = {}) => ({
  oid: 100n,
  id: 'pss_1',
  status: 'pending',
  typeConcrete: 'admin',
  authConfigOid: null,
  configOid: null,
  oauthSetupOid: 200n,
  identityOid: null,
  identityCredentialOid: null,
  ownerPublicMcpServerOid: null,
  tenantOid: 10n,
  solutionOid: 7,
  environmentOid: 30n,
  deploymentOid: null,
  metadata: null,
  redirectUrl: null,
  expiresAt: new Date(Date.now() + 60_000),
  authConfig: null,
  config: null,
  oauthSetup: null,
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();

  mocks.sessionUpdate.mockImplementation(async ({ data }: { data: Record<string, any> }) =>
    session(data)
  );
  mocks.oauthSetupUpdate.mockImplementation(async () => ({ oid: 200n, status: 'completed' }));
  mocks.createProviderOAuthSetupInternal.mockResolvedValue({
    oid: 200n,
    deploymentOid: null,
    authConfigOid: null,
    authMethodOid: 60n,
    authCredentialsOid: 70n
  });
});

describe('initializeProviderSetupSessionProvider for admin sessions', () => {
  it('rejects auth methods without admin setup support', async () => {
    mocks.getVersionAndAuthMethod.mockResolvedValue({ authMethod: adminAuthMethod({}) });

    await expect(initialize()).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'admin_setup_not_supported' })
    });
  });

  it('rejects config input', async () => {
    await expect(initialize({ configInput: { region: 'eu' } })).rejects.toThrow(
      'Config input provided for admin session type'
    );
  });

  it('creates an admin OAuth setup and never a config', async () => {
    mocks.getVersionAndAuthMethod.mockResolvedValue({ authMethod: adminAuthMethod() });

    let res = await initialize({ authConfigInput: {} });

    expect(res.concreteType).toBe('admin');
    expect(mocks.createProviderOAuthSetupInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          isAdminSetup: true,
          authMethodId: 'pam_1',
          expiresAt: sessionExpiresAt
        })
      })
    );
    expect(mocks.createProviderConfigInternal).not.toHaveBeenCalled();
    expect(res.inner).toMatchObject({ oauthSetupOid: 200n, authMethodOid: 60n });
    expect(res.inner.configOid).toBeUndefined();
  });
});

describe('evaluate for admin sessions', () => {
  it('completes once the admin OAuth setup is completed without creating credentials', async () => {
    mocks.sessionFindFirstOrThrow.mockResolvedValue(
      session({ identityOid: 5n, oauthSetup: { oid: 200n, status: 'completed' } })
    );

    let result = await providerSetupSessionInternalService.evaluate({
      session: session() as any,
      context
    });

    expect(mocks.sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'completed' } })
    );
    expect(result.status).toBe('completed');
    expect(mocks.createIdentityCredentialInternal).not.toHaveBeenCalled();
  });

  it('stays pending while the admin OAuth setup is not completed', async () => {
    mocks.sessionFindFirstOrThrow.mockResolvedValue(
      session({ oauthSetup: { oid: 200n, status: 'opened' } })
    );

    let result = await providerSetupSessionInternalService.evaluate({
      session: session() as any,
      context
    });

    expect(mocks.sessionUpdate).not.toHaveBeenCalled();
    expect(result.status).toBe('pending');
  });
});

describe('oauthSetupCompleted for admin sessions', () => {
  it('records the completion without an auth_config_set event and completes the session', async () => {
    mocks.sessionFindFirstOrThrow.mockResolvedValue(
      session({ oauthSetup: { oid: 200n, status: 'completed' } })
    );

    await providerSetupSessionInternalService.oauthSetupCompleted({
      session: session() as any,
      setup: { oid: 200n, status: 'completed', authConfigOid: null } as any,
      context
    });

    let eventTypes = mocks.sessionEventCreateMany.mock.calls.flatMap(call => {
      let data = (call as any)[0].data;
      return (Array.isArray(data) ? data : [data]).map(
        (event: { type: string }) => event.type
      );
    });

    expect(eventTypes).toContain('oauth_setup_completed');
    expect(eventTypes).toContain('completed');
    expect(eventTypes).not.toContain('auth_config_set');
    expect(mocks.authConfigUpdate).not.toHaveBeenCalled();
  });
});
