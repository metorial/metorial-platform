import { beforeEach, describe, expect, it, vi } from 'vitest';

let setEnv = () => {
  process.env.SYNTHESIS_API_PORT = '52080';
  process.env.SYNTHESIS_HEALTH_PORT = '52081';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/synthesis';
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
});
