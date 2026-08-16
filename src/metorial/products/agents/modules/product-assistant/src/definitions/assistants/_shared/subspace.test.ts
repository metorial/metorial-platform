import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {},
  withTransaction: async (cb: (tx: unknown) => Promise<unknown>) => await cb({})
}));
vi.mock('@metorial-subspace/module-session', () => ({
  sessionService: {},
  sessionMcpMessagingService: { send: vi.fn() }
}));
vi.mock('@metorial-subspace/module-tenant', () => ({
  tenantService: {},
  getProjectInternalTenantIdentifier: (project: { oid: bigint }) => `mte-pro-${project.oid}`,
  getInstanceInternalEnvironmentIdentifier: (instance: { oid: bigint }) =>
    `mte-ins-${instance.oid}`
}));

let setEnv = () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/metorial';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.SUBSPACE_SOLUTION = 'metorial-platform';
};

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
    let subspaceAssistant = createSubspaceAssistantForTest({
      tenant: { getTenantAndEnvironmentById },
      session: { getSessionByIdInternal }
    });

    await expect(
      subspaceAssistant.getInput({
        project: { oid: 2n } as any,
        instance: { oid: 3n } as any,
        input: { sessionId: 'sess_1' }
      })
    ).resolves.toEqual({
      sessionId: 'sess_1',
      solutionId: 'metorial-platform',
      subspaceTenantId: 'mte-pro-2',
      environmentId: 'mte-ins-3'
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
        }))
      }
    });

    await expect(
      subspaceAssistant.getInput({
        project: { oid: 2n } as any,
        instance: { oid: 3n } as any,
        input: { sessionId: 'sess_1' }
      })
    ).rejects.toThrow('Subspace session sess_1 is not active.');
  });
});
