import { beforeEach, describe, expect, it, vi } from 'vitest';

let { dbMock, rows } = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  dbMock: {
    slateScopedInvocationGrant: { create: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn()
  }
}));

vi.mock('../db', () => ({ db: dbMock }));
vi.mock('../id', () => ({ getId: () => ({ id: 'grant-row', oid: 1n }) }));
vi.mock('./slateSession', () => ({ slateSessionService: {} }));
vi.mock('./slateTriggerReceiverSecret', () => ({ slateTriggerReceiverSecretService: {} }));
vi.mock('./slateTriggerReceiverRuntime', () => ({
  computeHubWebhookActionSpecHashV1: vi.fn(),
  computeHubWebhookWireRequestHash: vi.fn()
}));
vi.mock('./slateTriggerReceiverShared', () => ({ receiverTriggerInclude: {} }));

import { slateTriggerReceiverProductionSecurity } from './slateTriggerReceiverSecurity';

beforeEach(() => {
  rows.clear();
  vi.resetAllMocks();
  dbMock.slateScopedInvocationGrant.create.mockImplementation(async ({ data }: any) => {
    rows.set(data.tokenHash, { ...data, status: 'active', consumedAt: null, revokedAt: null });
  });
  dbMock.slateScopedInvocationGrant.updateMany.mockImplementation(async ({ where, data }: any) => {
    let row = rows.get(where.tokenHash);
    if (!row || row.status !== 'active') return { count: 0 };
    rows.set(where.tokenHash, { ...row, ...data });
    return { count: 1 };
  });
  dbMock.$transaction.mockImplementation(async (handler: any) =>
    handler({
      slateScopedInvocationGrant: {
        findUnique: vi.fn(async ({ where }: any) => rows.get(where.tokenHash) ?? null),
        updateMany: vi.fn(async ({ where, data }: any) => {
          let row = rows.get(where.tokenHash);
          if (!row || row.status !== 'active' || row.expiresAt <= where.expiresAt.gt) {
            return { count: 0 };
          }
          rows.set(where.tokenHash, { ...row, ...data });
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(async ({ where }: any) => {
          let row = rows.get(where.tokenHash);
          if (!row) throw new Error('missing row');
          return row;
        })
      }
    })
  );
});

let bindings = {
  deploymentId: 'deployment-1',
  runtimeIdentityId: 'runtime-1',
  runtimeIdentityGeneration: 2,
  tenantId: 'tenant-1',
  slateInstanceId: 'instance-1',
  configSchemaVersion: 2,
  configSchemaHash: 'a'.repeat(64),
  hubInvocationId: 'invocation-1',
  requestId: 'request-1',
  actionId: 'tool.read',
  operation: 'tool_invoke' as const,
  configSecretVersions: { 'config:token': 3 },
  authConfigId: null,
  authSecretVersions: {}
};

describe('production durable scoped tool grant store', () => {
  it('issues, rejects a copied runtime before CAS, consumes globally once, and rejects replay', async () => {
    let envelope = await slateTriggerReceiverProductionSecurity.issueToolGrant(bindings);
    let expected = {
      requestId: bindings.requestId,
      operation: bindings.operation,
      actionId: bindings.actionId,
      deploymentId: bindings.deploymentId,
      runtimeIdentityId: bindings.runtimeIdentityId,
      runtimeIdentityGeneration: bindings.runtimeIdentityGeneration,
      hubInvocationId: bindings.hubInvocationId
    };
    await expect(
      slateTriggerReceiverProductionSecurity.grants.redeem({
        envelope,
        authenticated: true,
        expected: { ...expected, runtimeIdentityId: 'copied-runtime' }
      })
    ).rejects.toThrow('binding validation failed');
    expect([...rows.values()][0]?.status).toBe('active');
    await expect(
      slateTriggerReceiverProductionSecurity.grants.redeem({
        envelope,
        authenticated: true,
        expected
      })
    ).resolves.toMatchObject(bindings);
    expect([...rows.values()][0]?.status).toBe('consumed');
    await expect(
      slateTriggerReceiverProductionSecurity.grants.redeem({
        envelope,
        authenticated: true,
        expected
      })
    ).rejects.toThrow('already consumed');
  });

  it('revokes an unredeemed production grant idempotently', async () => {
    let envelope = await slateTriggerReceiverProductionSecurity.issueToolGrant({
      ...bindings,
      requestId: 'request-2',
      hubInvocationId: 'invocation-2'
    });
    await slateTriggerReceiverProductionSecurity.grants.revoke(envelope);
    await slateTriggerReceiverProductionSecurity.grants.revoke(envelope);
    expect([...rows.values()][0]?.status).toBe('revoked');
  });
});
