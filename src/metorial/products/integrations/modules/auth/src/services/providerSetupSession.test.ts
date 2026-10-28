import { addDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerSetupSessionCreate: vi.fn(),
  providerSetupSessionFindUniqueOrThrow: vi.fn(),
  providerSetupSessionUpdate: vi.fn(),
  providerSetupSessionEventCreateMany: vi.fn(),
  addAfterTransactionHook: vi.fn(),
  queueAdd: vi.fn(),
  evaluate: vi.fn(),
  initializeProviderSetupSessionProvider: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn(), validate: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerSetupSession: {
      create: mocks.providerSetupSessionCreate,
      update: mocks.providerSetupSessionUpdate,
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: mocks.providerSetupSessionFindUniqueOrThrow
    },
    providerSetupSessionEvent: {
      createMany: mocks.providerSetupSessionEventCreateMany,
      findMany: vi.fn()
    },
    provider: { findFirstOrThrow: vi.fn() },
    identity: { findFirst: vi.fn() }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: mocks.addAfterTransactionHook,
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` }),
    generateRegionalClientSecret: vi.fn(async () => 'secret'),
    ProviderSetupSessionTypeConcrete: { auth_only: 'auth_only' }
  };
});

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ onlyParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ onlyParent: {} })),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderAuthCredentials: vi.fn(),
  resolveProviderAuthMethods: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkProviderMatch: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  ownerActorSelect: { select: { id: true } },
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  metorialDb: {
    instanceConsumer: { findFirst: vi.fn() },
    consumerActor: { findFirst: vi.fn(), findUnique: vi.fn() }
  },
  resolveMetorialFacing: vi.fn(),
  resolveMetorialFacingWithOptionalActor: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../queues/lifecycle/providerSetupSession', () => ({
  providerSetupSessionCreatedQueue: { add: mocks.queueAdd },
  providerSetupSessionUpdatedQueue: { add: mocks.queueAdd }
}));

vi.mock('./providerAuthConfig', () => ({
  providerAuthConfigInclude: {}
}));

vi.mock('./providerSetupSessionInternal', () => ({
  providerSetupSessionInternalService: {
    evaluate: mocks.evaluate,
    initializeProviderSetupSessionProvider: mocks.initializeProviderSetupSessionProvider
  }
}));

import { providerSetupSessionService } from './providerSetupSession';

let makeParams = ({
  projectOid = 20n as bigint | null,
  instanceOid = 40n as bigint | null
} = {}) => ({
  tenant: { oid: 10n, projectOid } as any,
  environment: { oid: 30n, instanceOid } as any,
  input: {
    type: 'auto' as const,
    uiMode: 'metorial_elements' as const
  },
  import: { ip: '127.0.0.1', ua: 'test-agent' }
});

describe('createProviderSetupSessionInternal double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerSetupSessionCreate.mockResolvedValue({ oid: 100n, id: 'pss_1' });
    mocks.providerSetupSessionFindUniqueOrThrow.mockResolvedValue({ oid: 100n, id: 'pss_1' });
  });

  it('mirrors the tenant project and environment instance onto the setup session', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal(makeParams() as any);

    expect(mocks.providerSetupSessionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('keeps the mirrored oids null while the tenant is not linked yet', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal(
      makeParams({ projectOid: null, instanceOid: null }) as any
    );

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: null,
      environmentOid: 30n,
      instanceOid: null
    });
  });

  it("owns the session by the identity's actor when no owner is given", async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal({
      ...makeParams(),
      identity: { oid: 50n, actorOid: 60n, tenantOid: 10n, status: 'active' }
    } as any);

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      identityOid: 50n,
      ownerActorOid: 60n
    });
  });

  it('prefers an explicit owner actor over the identity actor', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal({
      ...makeParams(),
      identity: { oid: 50n, actorOid: 60n, tenantOid: 10n, status: 'active' },
      ownerActorOid: 70n
    } as any);

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      ownerActorOid: 70n
    });
  });

  it('leaves the session unowned without an identity or owner', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal(makeParams() as any);

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      ownerActorOid: null
    });
  });
});

describe('createProviderSetupSessionInternal ownership flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerSetupSessionCreate.mockResolvedValue({ oid: 100n, id: 'pss_1' });
    mocks.providerSetupSessionFindUniqueOrThrow.mockResolvedValue({ oid: 100n, id: 'pss_1' });
  });

  it('defaults to a public, non-system session', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal(makeParams() as any);

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      isOwnerOnlyVisible: false,
      isSystemOwned: false
    });
  });

  it('inherits owner-only visibility from the provider config when owned', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal({
      ...makeParams(),
      ownerActorOid: 70n,
      providerConfig: { oid: 80n, tenantOid: 10n, status: 'active', isOwnerOnlyVisible: true }
    } as any);

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      ownerActorOid: 70n,
      isOwnerOnlyVisible: true
    });
  });

  it('never marks an unowned session as owner-only visible', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal({
      ...makeParams(),
      isOwnerOnlyVisible: true
    } as any);

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      ownerActorOid: null,
      isOwnerOnlyVisible: false
    });
  });

  it('drops the owner of system owned sessions', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal({
      ...makeParams(),
      ownerActorOid: 70n,
      isSystemOwned: true
    } as any);

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      ownerActorOid: null,
      isOwnerOnlyVisible: false,
      isSystemOwned: true
    });
  });
});

describe('createProviderSetupSessionInternal admin sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerSetupSessionCreate.mockResolvedValue({ oid: 100n, id: 'pss_1' });
    mocks.providerSetupSessionFindUniqueOrThrow.mockResolvedValue({ oid: 100n, id: 'pss_1' });
    mocks.initializeProviderSetupSessionProvider.mockResolvedValue({
      concreteType: 'admin',
      inner: { oauthSetupOid: 200n, authMethodOid: 60n }
    });
  });

  let createAdminSession = (input: Record<string, unknown> = {}) => {
    let params = makeParams();

    return providerSetupSessionService.createProviderSetupSessionInternal({
      ...params,
      provider: { oid: 50n, defaultVariant: { oid: 51n }, type: {} },
      input: { ...params.input, type: 'admin', ...input }
    } as any);
  };

  it('rejects admin sessions bound to an identity', async () => {
    let params = makeParams();

    await expect(
      providerSetupSessionService.createProviderSetupSessionInternal({
        ...params,
        input: { ...params.input, type: 'admin' },
        identity: { oid: 50n, actorOid: 60n, tenantOid: 10n, status: 'active' }
      } as any)
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'admin_setup_invalid_binding' })
    });

    expect(mocks.providerSetupSessionCreate).not.toHaveBeenCalled();
  });

  it('creates admin sessions without an identity', async () => {
    await createAdminSession();

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      typeSelected: 'admin',
      typeConcrete: 'admin',
      identityOid: null
    });
  });

  it('rejects admin sessions without a provider', async () => {
    let params = makeParams();

    await expect(
      providerSetupSessionService.createProviderSetupSessionInternal({
        ...params,
        input: { ...params.input, type: 'admin' }
      } as any)
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'admin_setup_provider_required' })
    });

    expect(mocks.providerSetupSessionCreate).not.toHaveBeenCalled();
  });

  it('rejects admin sessions with tool filters enabled', async () => {
    await expect(
      createAdminSession({ configuration: { toolFilters: { enabled: true } } })
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'admin_setup_invalid_configuration' })
    });

    expect(mocks.initializeProviderSetupSessionProvider).not.toHaveBeenCalled();
    expect(mocks.providerSetupSessionCreate).not.toHaveBeenCalled();
  });

  it('defaults admin sessions to a 14 day expiry and passes it to the OAuth setup', async () => {
    let before = new Date();

    await createAdminSession();

    let after = new Date();
    let expiresAt = mocks.providerSetupSessionCreate.mock.calls[0]![0].data.expiresAt as Date;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(addDays(before, 14).getTime());
    expect(expiresAt.getTime()).toBeLessThanOrEqual(addDays(after, 14).getTime());
    expect(mocks.initializeProviderSetupSessionProvider).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt })
    );
  });

  it('keeps an explicit expiry for admin sessions', async () => {
    let expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await createAdminSession({ expiresAt });

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data.expiresAt).toEqual(
      expiresAt
    );
  });

  it('keeps the 30 minute default for other session types', async () => {
    let before = Date.now();

    await providerSetupSessionService.createProviderSetupSessionInternal(makeParams() as any);

    let expiresAt = mocks.providerSetupSessionCreate.mock.calls[0]![0].data.expiresAt as Date;
    let ttl = expiresAt.getTime() - before;

    expect(ttl).toBeGreaterThanOrEqual(30 * 60 * 1000);
    expect(ttl).toBeLessThan(31 * 60 * 1000);
  });
});

describe('updateProviderSetupSessionInternal admin sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerSetupSessionUpdate.mockResolvedValue({ oid: 100n, id: 'pss_1' });
  });

  let update = (session: Record<string, unknown>) =>
    providerSetupSessionService.updateProviderSetupSessionInternal({
      tenant: { oid: 10n } as any,
      environment: { oid: 30n } as any,
      providerSetupSession: {
        oid: 100n,
        id: 'pss_1',
        status: 'pending',
        identityOid: null,
        identityCredentialOid: null,
        ...session
      } as any,
      input: {
        identity: { oid: 50n, actorOid: 60n, tenantOid: 10n, status: 'active' } as any
      }
    });

  it('rejects binding an identity to an admin session', async () => {
    await expect(
      update({ typeSelected: 'admin', typeConcrete: 'admin' })
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'admin_setup_invalid_binding' })
    });

    expect(mocks.providerSetupSessionUpdate).not.toHaveBeenCalled();
  });

  it('binds an identity to other session types', async () => {
    await update({ typeSelected: 'auto', typeConcrete: 'auth_only' });

    expect(mocks.providerSetupSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ identityOid: 50n }) })
    );
  });
});

describe('listProviderSetupSessionsInternal type filter', () => {
  let runList = async (types?: ('admin' | 'auth_only')[]) => {
    vi.clearAllMocks();
    let { Paginator } = await import('@lowerdeck/pagination');
    let { db } = await import('@metorial-subspace/db');
    vi.mocked(Paginator.create).mockImplementation(((fn: any) => fn) as any);
    vi.mocked(db.providerSetupSession.findMany).mockResolvedValue([]);

    let paginator: any = await providerSetupSessionService.listProviderSetupSessionsInternal({
      tenant: { oid: 10n } as any,
      environment: { oid: 30n } as any,
      types
    });
    await paginator({ prisma: (cb: (opts: object) => unknown) => cb({}) });

    return vi.mocked(db.providerSetupSession.findMany).mock.calls[0]![0] as any;
  };

  it('matches either the selected or the concrete type', async () => {
    let args = await runList(['admin']);

    expect(args.where.AND).toContainEqual({
      OR: [{ typeSelected: { in: ['admin'] } }, { typeConcrete: { in: ['admin'] } }]
    });
  });

  it('adds no type condition without types', async () => {
    let args = await runList();

    expect(args.where.AND).not.toContainEqual(
      expect.objectContaining({ OR: expect.anything() })
    );
  });
});
