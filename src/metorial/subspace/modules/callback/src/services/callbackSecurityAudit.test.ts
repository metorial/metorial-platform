import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  findUnique: vi.fn(),
  auditCreate: vi.fn(),
  outboxCreate: vi.fn(),
  transaction: vi.fn(),
  ids: 0
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callbackSecurityAuditRecord: { findUnique: state.findUnique },
    $transaction: state.transaction
  },
  getId: (kind: string) => ({ oid: BigInt(++state.ids), id: `${kind}_${state.ids}` })
}));
vi.mock('./callbackReceiverSecret', () => ({
  CALLBACK_SECURITY_AUDIT_ACTIONS: [
    'secret_created',
    'secret_imported',
    'secret_projected',
    'secret_rotated',
    'secret_revoked',
    'secret_issuance_receipt_issued',
    'secret_issuance_receipt_consumed',
    'secret_issuance_receipt_denied'
  ]
}));

import {
  appendCallbackSecurityAuditInTransaction,
  callbackSecurityAuditService,
  sanitizeCallbackSecurityAuditMetadata
} from './callbackSecurityAudit';

let tenant = { oid: 1n, id: 'tenant-1' } as any;
let hubTenantId = 'hub-tenant-1';
let callback = { oid: 2n, id: 'callback-1', tenantOid: tenant.oid } as any;
let callbackInstance = {
  oid: 3n,
  id: 'instance-1',
  callbackOid: callback.oid
} as any;
let context = {
  trustedActorId: 'actor-1',
  requestId: 'request-1',
  requestIp: '192.0.2.1',
  requestUserAgent: 'dashboard-test'
};
let ownerSnapshot = {
  tenantId: tenant.id,
  callbackId: callback.id,
  callbackInstanceId: callbackInstance.id,
  receiverId: 'receiver-1',
  receiverAuthorityVersion: 3
};
let hubAudit = {
  id: 'hub-audit-1',
  auditCorrelationId: 'correlation-1',
  action: 'secret_created' as const,
  actorId: context.trustedActorId,
  requestId: context.requestId,
  requestIp: context.requestIp,
  requestUserAgent: context.requestUserAgent,
  metadata: {
    secretClass: 'receiver_path',
    secretId: 'secret-1',
    secretVersion: 1,
    plaintext: 'must-not-persist',
    arbitrary: 'must-not-persist'
  },
  createdAt: new Date('2026-08-15T12:00:00.000Z'),
  ownerSnapshot: {
    ...ownerSnapshot,
    tenantId: hubTenantId,
    committedAt: new Date('2026-08-15T12:00:00.000Z')
  }
};

let tx = () => ({
  callbackSecurityAuditRecord: {
    findUnique: state.findUnique,
    create: state.auditCreate
  },
  callbackSecurityAuditOutbox: { create: state.outboxCreate }
});

beforeEach(() => {
  vi.clearAllMocks();
  state.ids = 0;
  state.findUnique.mockResolvedValue(null);
  state.auditCreate.mockImplementation(async ({ data }) => data);
  state.outboxCreate.mockImplementation(async ({ data }) => data);
  state.transaction.mockImplementation(async callback => await callback(tx()));
});

describe('callback security audit append-only transaction', () => {
  it('commits one immutable audit and outbox with trusted attribution and sanitized metadata', async () => {
    let result = await callbackSecurityAuditService.appendLinked({
      tenant,
      callback,
      callbackInstance,
      ownerSnapshot,
      expectedHubTenantId: hubTenantId,
      hubAudit,
      expectedContext: context
    });

    expect(result.hubAuditCorrelationId).toBe('correlation-1');
    expect(state.auditCreate).toHaveBeenCalledOnce();
    expect(state.outboxCreate).toHaveBeenCalledOnce();
    let persisted = state.auditCreate.mock.calls[0]![0].data;
    expect(persisted).toEqual(
      expect.objectContaining({
        actorId: context.trustedActorId,
        requestId: context.requestId,
        requestIp: context.requestIp,
        requestUserAgent: context.requestUserAgent,
        tenantIdSnapshot: tenant.id,
        callbackIdSnapshot: callback.id,
        callbackInstanceIdSnapshot: callbackInstance.id,
        hubReceiverId: ownerSnapshot.receiverId,
        receiverAuthorityVersionSnapshot: ownerSnapshot.receiverAuthorityVersion,
        authorityCommittedAt: hubAudit.createdAt,
        metadata: {
          secretClass: 'receiver_path',
          secretId: 'secret-1',
          secretVersion: 1
        }
      })
    );
    expect(JSON.stringify(persisted.metadata)).not.toContain('must-not-persist');
    expect(Object.keys(callbackSecurityAuditService).sort()).toEqual([
      'appendLinked',
      'getByCorrelation'
    ]);
  });

  it('rejects untrusted attribution and owner mismatches before persistence', async () => {
    await expect(
      appendCallbackSecurityAuditInTransaction({
        tx: tx() as any,
        tenant,
        callback,
        callbackInstance,
        ownerSnapshot,
        expectedHubTenantId: hubTenantId,
        hubAudit: { ...hubAudit, actorId: 'caller-controlled' },
        expectedContext: context
      })
    ).rejects.toThrow('attribution');
    await expect(
      appendCallbackSecurityAuditInTransaction({
        tx: tx() as any,
        tenant,
        callback: { ...callback, tenantOid: 99n },
        callbackInstance,
        ownerSnapshot,
        expectedHubTenantId: hubTenantId,
        hubAudit,
        expectedContext: context
      })
    ).rejects.toThrow('owner binding');
    expect(state.auditCreate).not.toHaveBeenCalled();
  });

  it('rejects a Hub audit from the local Subspace tenant namespace', async () => {
    await expect(
      appendCallbackSecurityAuditInTransaction({
        tx: tx() as any,
        tenant,
        callback,
        callbackInstance,
        ownerSnapshot,
        expectedHubTenantId: hubTenantId,
        hubAudit: {
          ...hubAudit,
          ownerSnapshot: { ...hubAudit.ownerSnapshot, tenantId: tenant.id }
        },
        expectedContext: context
      })
    ).rejects.toThrow('immutable owner snapshot');
    expect(state.auditCreate).not.toHaveBeenCalled();
  });

  it('uses the same database transaction for audit and outbox and rolls back on outbox error', async () => {
    state.outboxCreate.mockRejectedValueOnce(new Error('outbox unavailable'));
    await expect(
      callbackSecurityAuditService.appendLinked({
        tenant,
        callback,
        callbackInstance,
        ownerSnapshot,
        expectedHubTenantId: hubTenantId,
        hubAudit,
        expectedContext: context
      })
    ).rejects.toThrow('outbox unavailable');
    expect(state.transaction).toHaveBeenCalledOnce();
    expect(state.auditCreate).toHaveBeenCalledOnce();
    expect(state.outboxCreate).toHaveBeenCalledOnce();
  });

  it('is correlation-idempotent and never creates a second outbox', async () => {
    state.findUnique.mockResolvedValueOnce({
      tenantIdSnapshot: tenant.id,
      callbackIdSnapshot: callback.id,
      callbackInstanceIdSnapshot: callbackInstance.id,
      hubReceiverId: 'receiver-1',
      receiverAuthorityVersionSnapshot: 3,
      action: hubAudit.action
    });
    await callbackSecurityAuditService.appendLinked({
      tenant,
      callback,
      callbackInstance,
      ownerSnapshot,
      expectedHubTenantId: hubTenantId,
      hubAudit,
      expectedContext: context
    });
    expect(state.auditCreate).not.toHaveBeenCalled();
    expect(state.outboxCreate).not.toHaveBeenCalled();
  });

  it('retains and idempotently authorizes the immutable snapshot after relations are deleted', async () => {
    state.findUnique.mockResolvedValueOnce({
      tenantOid: null,
      callbackOid: null,
      callbackInstanceOid: null,
      tenantIdSnapshot: tenant.id,
      callbackIdSnapshot: callback.id,
      callbackInstanceIdSnapshot: callbackInstance.id,
      hubReceiverId: ownerSnapshot.receiverId,
      receiverAuthorityVersionSnapshot: ownerSnapshot.receiverAuthorityVersion,
      action: hubAudit.action
    });
    await expect(
      callbackSecurityAuditService.appendLinked({
        ownerSnapshot,
        expectedHubTenantId: hubTenantId,
        hubAudit,
        expectedContext: context
      })
    ).resolves.toEqual(expect.objectContaining({ tenantOid: null }));
    expect(state.auditCreate).not.toHaveBeenCalled();
  });
});

describe('callback audit metadata', () => {
  it('keeps only the allowlisted bounded scalar projection', () => {
    expect(
      sanitizeCallbackSecurityAuditMetadata({
        secretClass: 'receiver_path',
        secretId: 'secret-1',
        value: 'sensitive',
        nested: { no: true },
        huge: 'x'.repeat(1000)
      })
    ).toEqual({ secretClass: 'receiver_path', secretId: 'secret-1' });
  });
});
