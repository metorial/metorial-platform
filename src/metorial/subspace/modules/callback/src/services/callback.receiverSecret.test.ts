import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  callbackFind: vi.fn(),
  instanceFind: vi.fn(),
  getTenantForSlates: vi.fn(),
  createReceiverPath: vi.fn(),
  rotateReceiverPath: vi.fn(),
  revokeReceiverPath: vi.fn(),
  revokeAllReceiverPath: vi.fn(),
  consumeReceiverPathReceipt: vi.fn(),
  getReceiverSecretAuditByCorrelation: vi.fn(),
  appendLinked: vi.fn(),
  enqueueRepair: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));
vi.mock('@metorial-subspace/db', () => ({
  CallbackDestinationStatus: {},
  db: {
    callback: { findFirst: state.callbackFind },
    callbackInstance: { findFirst: state.instanceFind }
  },
  getId: vi.fn(),
  snowflake: vi.fn(),
  withTransaction: vi.fn()
}));
vi.mock('@metorial-subspace/module-provider-internal', () => ({
  providerDeploymentInternalService: {}
}));
vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  getTenantForSlates: state.getTenantForSlates
}));
vi.mock('./callbackRegistration', () => ({ callbackRegistrationService: {} }));
vi.mock('../signal', () => ({ getInternalSignal: vi.fn(), getTenantForSignal: vi.fn() }));
vi.mock('./callbackSecurityAudit', () => ({
  callbackSecurityAuditService: { appendLinked: state.appendLinked }
}));
vi.mock('./callbackReceiverSecret', () => ({
  getCallbackReceiverSecretAuthority: () => ({
    createReceiverPath: state.createReceiverPath,
    rotateReceiverPath: state.rotateReceiverPath,
    revokeReceiverPath: state.revokeReceiverPath,
    revokeAllReceiverPath: state.revokeAllReceiverPath,
    consumeReceiverPathReceipt: state.consumeReceiverPathReceipt,
    getReceiverSecretAuditByCorrelation: state.getReceiverSecretAuditByCorrelation
  })
}));
vi.mock('../queues/securityAudit', () => ({
  enqueueCallbackSecurityAuditRepair: state.enqueueRepair
}));

import { callbackService } from './callback';

let tenant = { oid: 1n, id: 'tenant-1' } as any;
let hubTenant = { id: 'hub-tenant-1', identifier: 'tenant-1' };
let solution = { oid: 2n, id: 'solution-1' } as any;
let environment = { oid: 3n, id: 'environment-1' } as any;
let callback = {
  oid: 4n,
  id: 'callback-1',
  tenantOid: tenant.oid,
  solutionOid: solution.oid,
  environmentOid: environment.oid
} as any;
let callbackInstance = {
  oid: 5n,
  id: 'callback-instance-1',
  callbackOid: callback.oid,
  slateTriggerReceiverId: 'receiver-1',
  registrationReceiverAuthorityVersion: 3,
  status: 'attached',
  isParentDeleted: false
} as any;
let auditContext = {
  trustedActorId: 'organization-actor-1',
  requestContext: {
    requestId: 'dashboard-request-1',
    ip: '192.0.2.1',
    ua: 'dashboard-test'
  }
};
let baseInput = {
  tenant,
  solution,
  environment,
  callbackId: callback.id,
  callbackInstanceId: callbackInstance.id,
  ...auditContext
};
let authorityInput = {
  tenantId: hubTenant.id,
  receiverId: callbackInstance.slateTriggerReceiverId,
  callbackId: callback.id,
  callbackInstanceId: callbackInstance.id,
  receiverAuthorityVersion: callbackInstance.registrationReceiverAuthorityVersion,
  trustedActorId: auditContext.trustedActorId,
  requestId: auditContext.requestContext.requestId,
  requestIp: auditContext.requestContext.ip,
  requestUserAgent: auditContext.requestContext.ua
};

let mutation = (auditCorrelationId: string) => ({
  secret: {
    id: 'secret-1',
    status: 'active',
    secretVersion: 1,
    validFrom: new Date('2026-08-15T00:00:00.000Z'),
    validUntil: null
  },
  secretIssuanceReceipt: {
    id: 'receipt-1',
    token: 'one-time-receipt-token',
    expiresAt: new Date('2026-08-15T00:05:00.000Z')
  },
  auditCorrelationId
});

let hubAudit = (auditCorrelationId: string, action: string) => ({
  id: `hub-${auditCorrelationId}`,
  auditCorrelationId,
  action,
  actorId: authorityInput.trustedActorId,
  requestId: authorityInput.requestId,
  requestIp: authorityInput.requestIp,
  requestUserAgent: authorityInput.requestUserAgent,
  metadata: { secretClass: 'receiver_path', secretId: 'secret-1' },
  createdAt: new Date('2026-08-15T00:00:00.000Z'),
  ownerSnapshot: {
    tenantId: hubTenant.id,
    receiverId: callbackInstance.slateTriggerReceiverId,
    callbackId: callback.id,
    callbackInstanceId: callbackInstance.id,
    receiverAuthorityVersion: callbackInstance.registrationReceiverAuthorityVersion,
    committedAt: new Date('2026-08-15T00:00:00.000Z')
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  state.callbackFind.mockResolvedValue(callback);
  state.instanceFind.mockResolvedValue(callbackInstance);
  state.getTenantForSlates.mockResolvedValue(hubTenant);
  state.appendLinked.mockResolvedValue({ id: 'local-audit-1' });
  state.enqueueRepair.mockResolvedValue(undefined);
  state.getReceiverSecretAuditByCorrelation.mockImplementation(async input =>
    hubAudit(input.auditCorrelationId, 'secret_created')
  );
});

describe('callback receiver-secret authority', () => {
  it('authorizes exact tenant/callback/receiver ownership and propagates trusted context', async () => {
    state.createReceiverPath.mockResolvedValue(mutation('correlation-create'));

    let result = await callbackService.createReceiverPathSecret(baseInput);

    expect(result.secretIssuanceReceipt?.id).toBe('receipt-1');
    expect(state.callbackFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: callback.id,
          tenantOid: tenant.oid,
          solutionOid: solution.oid,
          environmentOid: environment.oid
        })
      })
    );
    expect(state.instanceFind).toHaveBeenCalledWith({
      where: {
        id: callbackInstance.id,
        callbackOid: callback.oid,
        status: 'attached',
        isParentDeleted: false
      }
    });
    expect(state.getTenantForSlates).toHaveBeenCalledWith(tenant);
    expect(state.createReceiverPath).toHaveBeenCalledWith(authorityInput);
    expect(state.getReceiverSecretAuditByCorrelation).toHaveBeenCalledWith({
      ...authorityInput,
      auditCorrelationId: 'correlation-create'
    });
    expect(state.appendLinked).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant,
        callback,
        callbackInstance,
        ownerSnapshot: {
          tenantId: tenant.id,
          callbackId: callback.id,
          callbackInstanceId: callbackInstance.id,
          receiverId: 'receiver-1',
          receiverAuthorityVersion: 3
        },
        expectedHubTenantId: hubTenant.id,
        expectedContext: {
          trustedActorId: authorityInput.trustedActorId,
          requestId: authorityInput.requestId,
          requestIp: authorityInput.requestIp,
          requestUserAgent: authorityInput.requestUserAgent
        }
      })
    );
  });

  it('denies the wrong tenant and stale or missing receiver binding before Hub access', async () => {
    state.callbackFind.mockResolvedValueOnce(null);
    await expect(
      callbackService.createReceiverPathSecret({
        ...baseInput,
        tenant: { ...tenant, oid: 99n, id: 'tenant-other' }
      })
    ).rejects.toThrow();
    expect(state.createReceiverPath).not.toHaveBeenCalled();

    state.instanceFind.mockResolvedValueOnce({
      ...callbackInstance,
      slateTriggerReceiverId: null
    });
    await expect(callbackService.createReceiverPathSecret(baseInput)).rejects.toThrow(
      /receiver binding/i
    );
    expect(state.createReceiverPath).not.toHaveBeenCalled();

    state.instanceFind.mockResolvedValueOnce(null);
    await expect(callbackService.createReceiverPathSecret(baseInput)).rejects.toThrow();
    expect(state.getTenantForSlates).not.toHaveBeenCalled();
    expect(state.createReceiverPath).not.toHaveBeenCalled();
  });

  it('does not create a Core audit when the Hub mutation fails', async () => {
    state.createReceiverPath.mockRejectedValueOnce(new Error('Hub unavailable'));
    await expect(callbackService.createReceiverPathSecret(baseInput)).rejects.toThrow(
      'Hub unavailable'
    );
    expect(state.getReceiverSecretAuditByCorrelation).not.toHaveBeenCalled();
    expect(state.appendLinked).not.toHaveBeenCalled();
    expect(state.enqueueRepair).not.toHaveBeenCalled();
  });

  it('does not call the Hub secret authority when tenant resolution fails', async () => {
    state.getTenantForSlates.mockRejectedValueOnce(new Error('tenant resolution unavailable'));

    await expect(callbackService.createReceiverPathSecret(baseInput)).rejects.toThrow(
      'tenant resolution unavailable'
    );
    expect(state.createReceiverPath).not.toHaveBeenCalled();
    expect(state.getReceiverSecretAuditByCorrelation).not.toHaveBeenCalled();
    expect(state.appendLinked).not.toHaveBeenCalled();
    expect(state.enqueueRepair).not.toHaveBeenCalled();
  });

  it('enqueues correlation repair after a committed Hub mutation when local linking fails', async () => {
    state.rotateReceiverPath.mockResolvedValueOnce({
      ...mutation('correlation-rotate'),
      graceExpiresAt: new Date('2026-08-15T00:05:00.000Z')
    });
    state.getReceiverSecretAuditByCorrelation.mockResolvedValueOnce(
      hubAudit('correlation-rotate', 'secret_rotated')
    );
    state.appendLinked.mockRejectedValueOnce(new Error('Core audit database unavailable'));

    await expect(
      callbackService.rotateReceiverPathSecret({ ...baseInput, graceMs: 60_000 })
    ).resolves.toEqual(expect.objectContaining({ auditCorrelationId: 'correlation-rotate' }));
    expect(state.enqueueRepair).toHaveBeenCalledWith({
      tenantId: tenant.id,
      hubTenantId: hubTenant.id,
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id,
      receiverId: callbackInstance.slateTriggerReceiverId,
      receiverAuthorityVersion: callbackInstance.registrationReceiverAuthorityVersion,
      auditCorrelationId: 'correlation-rotate',
      auditContext: {
        trustedActorId: authorityInput.trustedActorId,
        requestId: authorityInput.requestId,
        requestIp: authorityInput.requestIp,
        requestUserAgent: authorityInput.requestUserAgent
      }
    });
  });

  it('returns one-time material after Hub lookup failure only when repair is durably queued', async () => {
    state.createReceiverPath.mockResolvedValueOnce(mutation('correlation-lookup-failed'));
    state.getReceiverSecretAuditByCorrelation.mockRejectedValueOnce(
      new Error('Hub audit lookup unavailable')
    );
    await expect(callbackService.createReceiverPathSecret(baseInput)).resolves.toEqual(
      expect.objectContaining({
        auditCorrelationId: 'correlation-lookup-failed',
        secretIssuanceReceipt: expect.objectContaining({
          token: 'one-time-receipt-token'
        })
      })
    );
    expect(state.enqueueRepair).toHaveBeenCalledOnce();

    state.createReceiverPath.mockResolvedValueOnce(mutation('correlation-no-durability'));
    state.getReceiverSecretAuditByCorrelation.mockRejectedValueOnce(
      new Error('Hub audit lookup unavailable')
    );
    state.enqueueRepair.mockRejectedValueOnce(new Error('repair queue unavailable'));
    await expect(callbackService.createReceiverPathSecret(baseInput)).rejects.toThrow(
      'repair queue unavailable'
    );
  });

  it('audits create, rotate, revoke, consumed, and denied receipt outcomes without a read method', async () => {
    state.createReceiverPath.mockResolvedValueOnce(mutation('correlation-create'));
    state.rotateReceiverPath.mockResolvedValueOnce({
      ...mutation('correlation-rotate'),
      graceExpiresAt: new Date('2026-08-15T00:05:00.000Z')
    });
    state.revokeReceiverPath.mockResolvedValueOnce({
      ...mutation('correlation-revoke'),
      secretIssuanceReceipt: null
    });
    state.consumeReceiverPathReceipt
      .mockResolvedValueOnce({
        outcome: 'consumed',
        plaintext: 'metorial_whpath_one_time',
        auditCorrelationId: 'correlation-consumed'
      })
      .mockResolvedValueOnce({
        outcome: 'denied',
        auditCorrelationId: 'correlation-denied'
      });
    state.getReceiverSecretAuditByCorrelation.mockImplementation(async input => {
      let action =
        input.auditCorrelationId === 'correlation-rotate'
          ? 'secret_rotated'
          : input.auditCorrelationId === 'correlation-revoke'
            ? 'secret_revoked'
            : input.auditCorrelationId === 'correlation-consumed'
              ? 'secret_issuance_receipt_consumed'
              : input.auditCorrelationId === 'correlation-denied'
                ? 'secret_issuance_receipt_denied'
                : 'secret_created';
      return hubAudit(input.auditCorrelationId, action);
    });

    await callbackService.createReceiverPathSecret(baseInput);
    await callbackService.rotateReceiverPathSecret({ ...baseInput, graceMs: 60_000 });
    await callbackService.revokeReceiverPathSecret({
      ...baseInput,
      secretId: 'secret-1'
    });
    await expect(
      callbackService.consumeReceiverPathSecretReceipt({
        ...baseInput,
        receiptId: 'receipt-1',
        receiptToken: 'one-time-token'
      })
    ).resolves.toEqual({
      plaintext: 'metorial_whpath_one_time',
      auditCorrelationId: 'correlation-consumed'
    });
    await expect(
      callbackService.consumeReceiverPathSecretReceipt({
        ...baseInput,
        receiptId: 'receipt-1',
        receiptToken: 'one-time-token'
      })
    ).rejects.toThrow(/invalid, expired, or already consumed/i);

    expect(state.appendLinked).toHaveBeenCalledTimes(5);
    expect(state.appendLinked.mock.calls.map(call => call[0].hubAudit.action)).toEqual([
      'secret_created',
      'secret_rotated',
      'secret_revoked',
      'secret_issuance_receipt_consumed',
      'secret_issuance_receipt_denied'
    ]);
    expect('getReceiverPathSecret' in callbackService).toBe(false);
    expect('readReceiverPathSecret' in callbackService).toBe(false);
  });

  it('accepts an immediate (zero) grace period and rejects sub-minute or over-limit windows', async () => {
    state.rotateReceiverPath.mockResolvedValue({
      ...mutation('correlation-immediate'),
      graceExpiresAt: new Date('2026-08-15T00:00:00.000Z')
    });
    state.getReceiverSecretAuditByCorrelation.mockImplementation(async input =>
      hubAudit(input.auditCorrelationId, 'secret_rotated')
    );

    await expect(
      callbackService.rotateReceiverPathSecret({ ...baseInput, graceMs: 0 })
    ).resolves.toEqual(expect.objectContaining({ auditCorrelationId: 'correlation-immediate' }));
    expect(state.rotateReceiverPath).toHaveBeenCalledWith({ ...authorityInput, graceMs: 0 });

    for (let graceMs of [30_000, 59_999, 7 * 86_400_000 + 1, 1.5, -1]) {
      await expect(
        callbackService.rotateReceiverPathSecret({ ...baseInput, graceMs })
      ).rejects.toThrow(/grace period/i);
    }
    expect(state.rotateReceiverPath).toHaveBeenCalledTimes(1);
  });

  it('revokes every path secret through the trusted authority and links one bulk audit', async () => {
    state.revokeAllReceiverPath.mockResolvedValueOnce({
      secrets: [
        {
          id: 'secret-2',
          status: 'revoked',
          secretVersion: 2,
          validFrom: new Date('2026-08-15T00:00:00.000Z'),
          validUntil: new Date('2026-08-18T00:00:00.000Z')
        },
        {
          id: 'secret-1',
          status: 'revoked',
          secretVersion: 1,
          validFrom: new Date('2026-08-14T00:00:00.000Z'),
          validUntil: new Date('2026-08-18T00:00:00.000Z')
        }
      ],
      revokedCount: 2,
      auditCorrelationId: 'correlation-revoke-all'
    });
    state.getReceiverSecretAuditByCorrelation.mockResolvedValueOnce(
      hubAudit('correlation-revoke-all', 'secret_revoked')
    );

    let result = await callbackService.revokeAllReceiverPathSecrets(baseInput);

    expect(result.revokedCount).toBe(2);
    expect(result.secrets.map(secret => secret.status)).toEqual(['revoked', 'revoked']);
    expect(state.revokeAllReceiverPath).toHaveBeenCalledWith(authorityInput);
    expect(state.appendLinked).toHaveBeenCalledWith(
      expect.objectContaining({
        hubAudit: expect.objectContaining({ action: 'secret_revoked' })
      })
    );
  });

  it('rejects untrusted or unbounded request attribution before Hub access', async () => {
    await expect(
      callbackService.createReceiverPathSecret({
        ...baseInput,
        trustedActorId: '   '
      })
    ).rejects.toThrow(/request context/i);
    await expect(
      callbackService.createReceiverPathSecret({
        ...baseInput,
        requestContext: { ...baseInput.requestContext, ua: 'x'.repeat(513) }
      })
    ).rejects.toThrow(/request context/i);
    expect(state.getTenantForSlates).not.toHaveBeenCalled();
    expect(state.createReceiverPath).not.toHaveBeenCalled();
  });
});
