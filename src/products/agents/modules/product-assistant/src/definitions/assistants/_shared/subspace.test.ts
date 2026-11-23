import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  resourceActorFindUnique: vi.fn(),
  assertCanUseSessionById: vi.fn(),
  getTenantAndEnvironmentById: vi.fn(),
  getSessionByIdInternal: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: { resourceActor: { findUnique: mocks.resourceActorFindUnique } },
  withTransaction: async (cb: (tx: unknown) => Promise<unknown>) => await cb({})
}));
vi.mock('@metorial-subspace/module-session', () => ({
  sessionService: { getSessionByIdInternal: mocks.getSessionByIdInternal },
  sessionMcpMessagingService: { send: vi.fn() }
}));
vi.mock('@metorial-subspace/module-tenant', () => ({
  tenantService: { getTenantAndEnvironmentById: mocks.getTenantAndEnvironmentById },
  assertCanUseSessionById: mocks.assertCanUseSessionById,
  getProjectInternalTenantIdentifier: (project: { oid: bigint }) => `mte-pro-${project.oid}`,
  getInstanceInternalEnvironmentIdentifier: (instance: { oid: bigint }) =>
    `mte-ins-${instance.oid}`
}));

let setEnv = () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/metorial';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.SUBSPACE_SOLUTION = 'metorial-platform';
};

let project = { oid: 2n } as any;
let instance = { oid: 3n } as any;
let actor = { oid: 4n } as any;

describe('subspace assistant input validation', () => {
  beforeEach(() => {
    vi.resetModules();
    setEnv();
  });

  it('returns normalized input for an accessible active session', async () => {
    let { createSubspaceAssistantForTest } = await import('./subspace');
    let tenant = { id: 'tenant_1' };
    let environment = { id: 'production' };
    let getTenantAndEnvironmentById = vi.fn(async () => ({ tenant, environment }));
    let getSessionByIdInternal = vi.fn(async () => ({
      id: 'sess_1',
      status: 'active'
    }));
    let assertCanUseSession = vi.fn(async () => {});
    let subspaceAssistant = createSubspaceAssistantForTest({
      tenant: { getTenantAndEnvironmentById },
      session: { getSessionByIdInternal, assertCanUseSession }
    });

    await expect(
      subspaceAssistant.getInput({
        project,
        instance,
        actor,
        input: { sessionId: 'sess_1' }
      })
    ).resolves.toEqual({
      sessionId: 'sess_1',
      solutionId: 'metorial-platform',
      subspaceTenantId: 'mte-pro-2',
      environmentId: 'mte-ins-3'
    });

    expect(assertCanUseSession).toHaveBeenCalledWith({
      instance,
      actor,
      sessionId: 'sess_1'
    });
    expect(getTenantAndEnvironmentById).toHaveBeenCalledWith({
      tenantId: 'mte-pro-2',
      environmentId: 'mte-ins-3'
    });
    expect(getSessionByIdInternal).toHaveBeenCalledWith({
      tenant,
      environment,
      sessionId: 'sess_1'
    });
  });

  it('rejects an accessible but inactive session', async () => {
    let { createSubspaceAssistantForTest } = await import('./subspace');
    let subspaceAssistant = createSubspaceAssistantForTest({
      tenant: {
        getTenantAndEnvironmentById: vi.fn(async () => ({
          tenant: { id: 'tenant_1' },
          environment: { id: 'production' }
        }))
      },
      session: {
        getSessionByIdInternal: vi.fn(async () => ({
          id: 'sess_1',
          status: 'archived'
        })),
        assertCanUseSession: vi.fn(async () => {})
      }
    });

    await expect(
      subspaceAssistant.getInput({
        project,
        instance,
        actor,
        input: { sessionId: 'sess_1' }
      })
    ).rejects.toThrow('Subspace session sess_1 is not active.');
  });

  it('does not load a session the caller cannot use', async () => {
    let { createSubspaceAssistantForTest } = await import('./subspace');
    let getSessionByIdInternal = vi.fn();
    let subspaceAssistant = createSubspaceAssistantForTest({
      tenant: { getTenantAndEnvironmentById: vi.fn() },
      session: {
        getSessionByIdInternal,
        assertCanUseSession: vi.fn(async () => {
          throw new Error('ownership_restricted');
        })
      }
    });

    await expect(
      subspaceAssistant.getInput({
        project,
        instance,
        actor,
        input: { sessionId: 'sess_1' }
      })
    ).rejects.toThrow('ownership_restricted');

    expect(getSessionByIdInternal).not.toHaveBeenCalled();
  });

  it('checks the requesting actor again before opening a connection', async () => {
    let { createSubspaceAssistantForTest } = await import('./subspace');
    let assertCanUseSession = vi.fn(async () => {
      throw new Error('ownership_restricted');
    });
    let subspaceAssistant = createSubspaceAssistantForTest({
      tenant: { getTenantAndEnvironmentById: vi.fn() },
      session: { getSessionByIdInternal: vi.fn(), assertCanUseSession }
    });

    await expect(
      subspaceAssistant.createMcpServerConfig({
        project,
        instance,
        actor: null,
        input: {
          sessionId: 'sess_1',
          solutionId: 'metorial-platform',
          subspaceTenantId: 'mte-pro-2',
          environmentId: 'mte-ins-3'
        }
      })
    ).rejects.toThrow('ownership_restricted');

    expect(assertCanUseSession).toHaveBeenCalledWith({
      instance,
      actor: null,
      sessionId: 'sess_1'
    });
  });
});

describe('subspace assistant session ownership', () => {
  let memberActor = { id: 'oac_member', type: 'member' };
  let consumerProfileActor = { id: 'oac_consumer', type: 'consumer_profile' };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv();
    mocks.getTenantAndEnvironmentById.mockResolvedValue({ tenant: {}, environment: {} });
    mocks.getSessionByIdInternal.mockResolvedValue({ id: 'sess_1', status: 'active' });
  });

  let getInput = async (caller: { oid: bigint } | null) => {
    let { subspaceAssistant } = await import('./subspace');

    return await subspaceAssistant.getInput({
      project,
      instance,
      actor: caller,
      input: { sessionId: 'sess_1' }
    });
  };

  it("checks the session as the member's organization actor", async () => {
    mocks.resourceActorFindUnique.mockResolvedValue({
      organizationActor: memberActor,
      consumerProfile: null
    });

    await expect(getInput(actor)).resolves.toMatchObject({ sessionId: 'sess_1' });

    expect(mocks.resourceActorFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 4n } })
    );
    expect(mocks.assertCanUseSessionById).toHaveBeenCalledWith({
      instance,
      organizationActor: memberActor,
      sessionId: 'sess_1',
      isCrossConsumerUseDenied: true
    });
  });

  it("checks the session as the consumer profile's organization actor", async () => {
    mocks.resourceActorFindUnique.mockResolvedValue({
      organizationActor: null,
      consumerProfile: { organizationActor: consumerProfileActor }
    });

    await getInput(actor);

    expect(mocks.assertCanUseSessionById.mock.calls[0]![0].organizationActor).toBe(
      consumerProfileActor
    );
  });

  it('rejects a session the ownership check refuses', async () => {
    mocks.resourceActorFindUnique.mockResolvedValue({
      organizationActor: memberActor,
      consumerProfile: null
    });
    mocks.assertCanUseSessionById.mockRejectedValue(new Error('ownership_restricted'));

    await expect(getInput(actor)).rejects.toThrow('ownership_restricted');
    expect(mocks.getSessionByIdInternal).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing actor', null, null],
    ['an actor without an organization actor', actor, { organizationActor: null }],
    ['an actor that no longer exists', actor, null]
  ])('rejects %s without checking as an internal caller', async (_name, caller, row) => {
    mocks.resourceActorFindUnique.mockResolvedValue(row);

    await expect(getInput(caller)).rejects.toThrow(
      'Subspace session sess_1 cannot be used by this actor.'
    );
    expect(mocks.assertCanUseSessionById).not.toHaveBeenCalled();
    expect(mocks.getSessionByIdInternal).not.toHaveBeenCalled();
  });
});
