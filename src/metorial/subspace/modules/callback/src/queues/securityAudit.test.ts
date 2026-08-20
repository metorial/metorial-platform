import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  handler: undefined as undefined | ((input: any) => Promise<void>),
  getExisting: vi.fn(),
  appendLinked: vi.fn(),
  getHubAudit: vi.fn(),
  tenantFind: vi.fn(),
  callbackFind: vi.fn(),
  instanceFind: vi.fn(),
  add: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: () => ({
    add: state.add,
    process: (handler: (input: any) => Promise<void>) => {
      state.handler = handler;
      return { name: 'security-audit-repair' };
    }
  })
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenant: { findUnique: state.tenantFind },
    callback: { findFirst: state.callbackFind },
    callbackInstance: { findFirst: state.instanceFind }
  }
}));
vi.mock('../services/callbackSecurityAudit', () => ({
  callbackSecurityAuditService: {
    getByCorrelation: state.getExisting,
    appendLinked: state.appendLinked
  }
}));
vi.mock('../services/callbackReceiverSecret', () => ({
  getCallbackReceiverSecretAuthority: () => ({
    getReceiverSecretAuditByCorrelation: state.getHubAudit
  })
}));

import {
  enqueueCallbackSecurityAuditRepair,
  repairCallbackSecurityAudit
} from './securityAudit';

let input = {
  tenantId: 'tenant-1',
  hubTenantId: 'hub-tenant-1',
  callbackId: 'callback-1',
  callbackInstanceId: 'instance-1',
  receiverId: 'receiver-1',
  receiverAuthorityVersion: 3,
  auditCorrelationId: 'correlation-1',
  auditContext: {
    trustedActorId: 'actor-1',
    requestId: 'request-1',
    requestIp: '192.0.2.1',
    requestUserAgent: 'dashboard-test'
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  state.getExisting.mockResolvedValue(null);
  state.tenantFind.mockResolvedValue({ oid: 1n, id: input.tenantId });
  state.callbackFind.mockResolvedValue({
    oid: 2n,
    id: input.callbackId,
    tenantOid: 1n
  });
  state.instanceFind.mockResolvedValue({
    oid: 3n,
    id: input.callbackInstanceId,
    callbackOid: 2n
  });
  state.getHubAudit.mockResolvedValue({
    auditCorrelationId: input.auditCorrelationId,
    action: 'secret_created'
  });
  state.appendLinked.mockResolvedValue({ id: 'local-audit-1' });
});

describe('callback security audit repair queue', () => {
  it('uses a stable correlation job id', async () => {
    await enqueueCallbackSecurityAuditRepair(input);
    expect(state.add).toHaveBeenCalledWith(input, {
      id: `callback-security-audit:${input.auditCorrelationId}`
    });
  });

  it('repairs by authenticated Hub correlation and is exactly-once on repetition', async () => {
    await repairCallbackSecurityAudit(input);
    expect(state.getHubAudit).toHaveBeenCalledWith({
      tenantId: input.hubTenantId,
      receiverId: input.receiverId,
      callbackId: input.callbackId,
      callbackInstanceId: input.callbackInstanceId,
      receiverAuthorityVersion: input.receiverAuthorityVersion,
      ...input.auditContext,
      auditCorrelationId: input.auditCorrelationId
    });
    expect(state.tenantFind).toHaveBeenCalledWith({ where: { id: input.tenantId } });
    expect(state.callbackFind).toHaveBeenCalledWith({
      where: { id: input.callbackId, tenantOid: 1n }
    });
    expect(state.instanceFind).toHaveBeenCalledWith({
      where: { id: input.callbackInstanceId, callbackOid: 2n }
    });
    expect(state.appendLinked).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerSnapshot: expect.objectContaining({ tenantId: input.tenantId }),
        expectedHubTenantId: input.hubTenantId
      })
    );
    expect(state.appendLinked).toHaveBeenCalledOnce();

    state.getExisting.mockResolvedValueOnce({ id: 'local-audit-1' });
    await repairCallbackSecurityAudit(input);
    expect(state.getHubAudit).toHaveBeenCalledOnce();
    expect(state.appendLinked).toHaveBeenCalledOnce();
  });

  it('repairs from the immutable Hub snapshot after detach, rebind, version advance, or deletion', async () => {
    state.tenantFind.mockResolvedValueOnce(null);
    state.callbackFind.mockResolvedValueOnce(null);
    state.instanceFind.mockResolvedValueOnce(null);
    await expect(repairCallbackSecurityAudit(input)).resolves.toEqual({
      id: 'local-audit-1'
    });
    expect(state.getHubAudit).toHaveBeenCalledOnce();
    expect(state.appendLinked).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: undefined,
        callback: undefined,
        callbackInstance: undefined,
        expectedHubTenantId: input.hubTenantId,
        ownerSnapshot: {
          tenantId: input.tenantId,
          callbackId: input.callbackId,
          callbackInstanceId: input.callbackInstanceId,
          receiverId: input.receiverId,
          receiverAuthorityVersion: input.receiverAuthorityVersion
        }
      })
    );
  });
});
