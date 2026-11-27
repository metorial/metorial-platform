import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, getBackend, listProviderInvocations } = vi.hoisted(() => ({
  db: {
    chatEvent: { findMany: vi.fn() },
    sessionMessage: { findMany: vi.fn() },
    providerRun: { findMany: vi.fn() },
    providerAuthConfigEvent: { findMany: vi.fn() },
    backend: { findFirst: vi.fn() }
  },
  getBackend: vi.fn(),
  listProviderInvocations: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ id: 'sol_1', oid: 3 })),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('@metorial-subspace/provider', () => ({ getBackend }));

vi.mock('@metorial-subspace/provider-utils', () => ({
  parseProviderInvocationId: vi.fn()
}));

import { providerInvocationService } from './providerInvocation';

let tenant = { id: 'ten_1', oid: BigInt(1) };
let environment = { id: 'env_1', oid: BigInt(2) };

describe('providerInvocationService.listProviderInvocationsInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.chatEvent.findMany.mockResolvedValue([{ sessionMessage: { id: 'smg_1' } }]);
    db.sessionMessage.findMany.mockResolvedValue([
      {
        id: 'smg_1',
        providerRun: { id: 'prun_1', providerVersion: { backendOid: BigInt(9) } }
      }
    ]);
    listProviderInvocations.mockResolvedValue({
      items: [
        {
          id: 'pinv_1',
          status: 'failed',
          createdAt: new Date('2026-09-15T10:00:00Z')
        }
      ]
    });
    getBackend.mockResolvedValue({
      providerInvocation: { listProviderInvocations }
    });
  });

  it('resolves a scoped chat event through its session message', async () => {
    let result = await providerInvocationService.listProviderInvocationsInternal({
      tenant: tenant as any,
      environment: environment as any,
      inputs: { chatEventIds: ['chevt_1'] }
    });

    expect(db.chatEvent.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chevt_1'] },
        tenantOid: BigInt(1),
        solutionOid: 3,
        environmentOid: BigInt(2),
        sessionMessageOid: { not: null }
      },
      include: { sessionMessage: true }
    });
    expect(listProviderInvocations).toHaveBeenCalledWith({
      tenant,
      inputs: {
        providerRunIds: [],
        sessionMessageIds: ['smg_1'],
        callbackEventSourceIds: [],
        authConfigEventIds: []
      }
    });
    expect(result).toEqual([expect.objectContaining({ id: 'pinv_1', status: 'failed' })]);
  });

  it('returns no invocations for missing or legacy unlinked chat events', async () => {
    db.chatEvent.findMany.mockResolvedValue([]);

    await expect(
      providerInvocationService.listProviderInvocationsInternal({
        tenant: tenant as any,
        environment: environment as any,
        inputs: { chatEventIds: ['chevt_missing'] }
      })
    ).resolves.toEqual([]);

    expect(db.sessionMessage.findMany).not.toHaveBeenCalled();
    expect(getBackend).not.toHaveBeenCalled();
  });
});
