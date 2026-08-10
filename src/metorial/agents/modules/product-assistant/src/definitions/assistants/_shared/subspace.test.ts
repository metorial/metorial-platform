import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {},
  withTransaction: async (cb: (tx: unknown) => Promise<unknown>) => await cb({})
}));

let setEnv = () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/metorial';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.SUBSPACE_URL = 'http://localhost:52070/subspace-controller';
  process.env.SUBSPACE_CONNECTION_URL = 'http://localhost:52072';
  process.env.SUBSPACE_SOLUTION = 'metorial-platform';
};

describe('subspace assistant input validation', () => {
  beforeEach(() => {
    vi.resetModules();
    setEnv();
  });

  it('returns normalized input for an accessible active session', async () => {
    let { createSubspaceAssistantForTest } = await import('./subspace');
    let get = vi.fn(async () => ({
      id: 'sess_1',
      status: 'active'
    }));
    let subspaceAssistant = createSubspaceAssistantForTest({
      session: { get }
    });

    await expect(
      subspaceAssistant.getInput({
        tenant: { identifier: 'tenant_1' } as any,
        environment: { identifier: 'production' } as any,
        input: { sessionId: 'sess_1' }
      })
    ).resolves.toEqual({
      sessionId: 'sess_1',
      solutionId: 'metorial-platform',
      subspaceTenantId: 'tenant_1',
      environmentId: 'production'
    });

    expect(get).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      environmentId: 'production',
      sessionId: 'sess_1'
    });
  });

  it('rejects an accessible but inactive session', async () => {
    let { createSubspaceAssistantForTest } = await import('./subspace');
    let subspaceAssistant = createSubspaceAssistantForTest({
      session: {
        get: vi.fn(async () => ({
          id: 'sess_1',
          status: 'archived'
        }))
      }
    });

    await expect(
      subspaceAssistant.getInput({
        tenant: { identifier: 'tenant_1' } as any,
        environment: { identifier: 'production' } as any,
        input: { sessionId: 'sess_1' }
      })
    ).rejects.toThrow('Subspace session sess_1 is not active.');
  });

  it('uses a system agent client for subspace mcp headers', async () => {
    let { createSubspaceAssistantForTest } = await import('./subspace');
    let subspaceAssistant = createSubspaceAssistantForTest({
      session: {
        get: vi.fn()
      }
    });

    let headers = (subspaceAssistant as any).getMcpHeaders({
      tenant: { id: 'ten_1' },
      environment: { id: 'env_1' },
      input: {
        sessionId: 'sess_1',
        solutionId: 'metorial-platform',
        subspaceTenantId: 'tenant_1',
        environmentId: 'production'
      },
      url: 'http://localhost:52072/metorial-platform/tenant_1/sessions/sess_1/mcp'
    });

    expect(JSON.parse(headers['Metorial-Agent-Client'])).toEqual({
      name: 'Metorial Assistant',
      type: 'system_client',
      foreignId: 'product-assistant:ten_1:env_1:sess_1'
    });
  });
});
