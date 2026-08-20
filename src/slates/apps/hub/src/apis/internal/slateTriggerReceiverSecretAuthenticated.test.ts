import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

let { authHandlerMock, dbMock, redemptionMock, serviceMock } = vi.hoisted(() => ({
  authHandlerMock: { getSlateInstanceAuth: vi.fn() },
  redemptionMock: { redeem: vi.fn() },
  dbMock: {
    slateAction: { findFirst: vi.fn() },
    slateInstance: { findUnique: vi.fn() },
    slateInstanceConfig: { findUnique: vi.fn() },
    slateTriggerReceiver: { findUnique: vi.fn() }
  },
  serviceMock: {
    generateDeclaredTriggerSecret: vi.fn(),
    importDeclaredTriggerSecret: vi.fn(),
    rotateImportedDeclaredTriggerSecret: vi.fn(),
    resolveDeclaredTriggerSecretMetadata: vi.fn(),
    reencryptDeclaredTriggerSecret: vi.fn(),
    revokeDeclaredTriggerSecret: vi.fn(),
    importDeclaredInstanceConfigSecret: vi.fn(),
    createInitialPathSecret: vi.fn(),
    rotatePathSecret: vi.fn(),
    revokePathSecret: vi.fn(),
    revokeAllPathSecrets: vi.fn(),
    consumePathReceipt: vi.fn(),
    getReceiverSecretAuditByCorrelation: vi.fn(),
    createOrRotateProvisionedTenantAppSecret: vi.fn(),
    revokeProvisionedTenantAppSecret: vi.fn(),
    resolveInstanceConfigSecret: vi.fn()
  }
}));
vi.mock('../../db', () => ({ db: dbMock }));
vi.mock('../../services', () => ({
  SecretIssuanceReceiptDeniedError: class SecretIssuanceReceiptDeniedError extends Error {
    constructor(
      message: string,
      public auditCorrelationId: string
    ) {
      super(message);
    }
  },
  slateTriggerReceiverSecretService: serviceMock
}));
vi.mock('../../services/slateInstanceAuthHandler', () => ({
  slateAuthHandlerService: authHandlerMock
}));
vi.mock('../../services/slateTriggerReceiverSecurity', () => ({
  authenticatedScopedGrantRedemption: redemptionMock
}));
import {
  authenticatedInstanceConfigSecretLifecycle,
  authenticatedProvisionedTenantSecretLifecycle,
  authenticatedReceiverSecretLifecycle,
  authenticatedToolInvocationGrantRedemption,
  authenticatedTriggerSecretLifecycle
} from './slateTriggerReceiverSecretAuthenticated';
import { SecretIssuanceReceiptDeniedError } from '../../services';

let ctx = { serviceActorId: 'signed-internal-service', requestId: 'request-123' };
let runtimeCaller = {
  deploymentId: 'deployment-1',
  runtimeIdentityId: 'runtime-1',
  runtimeIdentityGeneration: 2,
  hubInvocationId: 'invocation-1'
};
let runtimeContext = {
  serviceActorId: 'slates_function_bay_runtime',
  deploymentId: 'deployment-1',
  runtimeIdentityId: 'runtime-1',
  runtimeIdentityGeneration: 2
};
let now = new Date('2026-08-14T00:00:00.000Z');
let mutation = {
  secret: {
    id: 'secret-1',
    status: 'active',
    secretVersion: 2,
    encryptionKeyVersion: 3,
    aadVersion: 2,
    validFrom: now,
    validUntil: null,
    encryptedValue: 'must-not-leak'
  },
  auditCorrelationId: 'audit-1'
};

afterEach(() => vi.resetAllMocks());

describe('authenticated Hub secret RPC', () => {
  it('derives provisioned secret authority in the service and never returns imported material or a receipt', async () => {
    serviceMock.createOrRotateProvisionedTenantAppSecret.mockResolvedValue({
      ...mutation,
      idempotent: false
    });
    let result = await authenticatedProvisionedTenantSecretLifecycle.createOrRotate(ctx, {
      provisionedTenantAppId: 'binding-1',
      importedValue: 'top-secret'
    });
    expect(serviceMock.createOrRotateProvisionedTenantAppSecret).toHaveBeenCalledWith({
      provisionedTenantAppId: 'binding-1',
      plaintext: 'top-secret',
      actor: { actorId: ctx.serviceActorId, requestId: ctx.requestId }
    });
    expect(result).toMatchObject({
      secret: { id: 'secret-1', secretVersion: 2, status: 'active' },
      secretIssuanceReceipt: null,
      idempotent: false
    });
    expect(JSON.stringify(result)).not.toContain('top-secret');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');

    serviceMock.revokeProvisionedTenantAppSecret.mockResolvedValue({
      ...mutation,
      secret: { ...mutation.secret, status: 'revoked' },
      idempotent: false
    });
    await expect(
      authenticatedProvisionedTenantSecretLifecycle.revoke(ctx, {
        provisionedTenantAppId: 'binding-1'
      })
    ).resolves.toMatchObject({
      secret: { status: 'revoked' },
      secretIssuanceReceipt: null
    });
  });

  it('rejects a wrong-tenant scoped tool binding before secret resolution', async () => {
    redemptionMock.redeem.mockResolvedValue({
      grantId: 'grant',
      deploymentId: 'deployment-1',
      runtimeIdentityId: 'runtime-1',
      runtimeIdentityGeneration: 2,
      tenantId: 'tenant-a',
      slateInstanceId: 'instance-1',
      configSchemaVersion: 2,
      configSchemaHash: 'a'.repeat(64),
      hubInvocationId: 'invocation-1',
      requestId: 'request-1',
      actionId: 'tool.read',
      operation: 'tool_invoke',
      issuedAtMs: 1,
      expiresAtMs: 2,
      configSecretVersions: { 'config:token': 1 },
      authConfigId: null,
      authSecretVersions: {}
    });
    dbMock.slateInstance.findUnique.mockResolvedValue({
      slateOid: 1n,
      tenant: { id: 'tenant-b' },
      currentConfig: {
        id: 'config-1',
        schema: { version: 2, descriptorHash: 'a'.repeat(64) }
      }
    });
    await expect(
      authenticatedToolInvocationGrantRedemption({
        caller: runtimeCaller,
        authenticatedContext: runtimeContext,
        envelope: {
          version: 'scoped_invocation_grant_v1',
          grantId: 'grant',
          token: 'captured-token',
          requestId: 'request-1'
        },
        expected: {
          requestId: 'request-1',
          operation: 'tool_invoke',
          actionId: 'tool.read',
          secretNames: ['config:token']
        }
      })
    ).rejects.toThrow(/owner or schema binding/);
    expect(serviceMock.resolveInstanceConfigSecret).not.toHaveBeenCalled();
  });

  it('resolves the version-bound auth output only at authenticated redemption', async () => {
    let updatedAt = new Date('2026-08-14T01:02:03.000Z');
    redemptionMock.redeem.mockResolvedValue({
      grantId: 'grant',
      deploymentId: 'deployment-1',
      runtimeIdentityId: 'runtime-1',
      runtimeIdentityGeneration: 2,
      tenantId: 'tenant-a',
      slateInstanceId: 'instance-1',
      configSchemaVersion: 2,
      configSchemaHash: 'a'.repeat(64),
      hubInvocationId: 'invocation-1',
      requestId: 'request-1',
      actionId: 'tool.read',
      operation: 'tool_invoke',
      issuedAtMs: 1,
      expiresAtMs: 2,
      configSecretVersions: {},
      authConfigId: 'auth-config-1',
      authSecretVersions: { 'auth:$output': updatedAt.getTime() }
    });
    dbMock.slateInstance.findUnique.mockResolvedValue({
      oid: 5n,
      id: 'instance-1',
      slateOid: 1n,
      tenant: { oid: 2n, id: 'tenant-a' },
      currentConfig: {
        id: 'config-1',
        schema: { version: 2, descriptorHash: 'a'.repeat(64) }
      }
    });
    dbMock.slateAction.findFirst.mockResolvedValue({ id: 'action-1' });
    authHandlerMock.getSlateInstanceAuth.mockResolvedValue({
      authConfig: { id: 'auth-config-1', updatedAt },
      output: { token: 'jit-auth-sentinel' }
    });

    let result = await authenticatedToolInvocationGrantRedemption({
      caller: runtimeCaller,
      authenticatedContext: runtimeContext,
      envelope: {
        version: 'scoped_invocation_grant_v1',
        grantId: 'grant',
        token: 'captured-token',
        requestId: 'request-1'
      },
      expected: {
        requestId: 'request-1',
        operation: 'tool_invoke',
        actionId: 'tool.read',
        secretNames: ['auth:$output']
      }
    });

    expect(authHandlerMock.getSlateInstanceAuth).toHaveBeenCalledOnce();
    expect(result.secrets).toEqual({
      'auth:$output': {
        value: JSON.stringify({ token: 'jit-auth-sentinel' }),
        version: updatedAt.getTime()
      }
    });
  });

  it.each([
    ['deploymentId', 'deployment-2'],
    ['runtimeIdentityId', 'runtime-2'],
    ['runtimeIdentityGeneration', 3]
  ] as const)(
    'rejects a copied envelope from a different runtime %s before grant access',
    async (key, value) => {
      await expect(
        authenticatedToolInvocationGrantRedemption({
          caller: { ...runtimeCaller, [key]: value },
          authenticatedContext: runtimeContext,
          envelope: {
            version: 'scoped_invocation_grant_v1',
            grantId: 'grant',
            token: 'captured-token',
            requestId: 'request-1'
          },
          expected: {
            requestId: 'request-1',
            operation: 'tool_invoke',
            actionId: 'tool.read',
            secretNames: []
          }
        })
      ).rejects.toThrow('runtime caller identity is invalid');
      expect(redemptionMock.redeem).not.toHaveBeenCalled();
    }
  );

  it('binds the live Hub invocation ID into grant redemption', async () => {
    redemptionMock.redeem.mockRejectedValue(new Error('binding validation failed'));
    await expect(
      authenticatedToolInvocationGrantRedemption({
        caller: { ...runtimeCaller, hubInvocationId: 'copied-invocation' },
        authenticatedContext: runtimeContext,
        envelope: {
          version: 'scoped_invocation_grant_v1',
          grantId: 'grant',
          token: 'captured-token',
          requestId: 'request-1'
        },
        expected: {
          requestId: 'request-1',
          operation: 'tool_invoke',
          actionId: 'tool.read',
          secretNames: []
        }
      })
    ).rejects.toThrow('binding validation failed');
    expect(redemptionMock.redeem).toHaveBeenCalledWith(
      expect.objectContaining({
        expected: expect.objectContaining({ hubInvocationId: 'copied-invocation' })
      })
    );
  });

  it('requires repository RPC signatures and derives actor/request context', async () => {
    let api = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(api).toContain('getSignatureToken');
    expect(api).toContain("path: '/slates-hub-secrets'");

    let generate = serviceMock.generateDeclaredTriggerSecret.mockResolvedValue(mutation);
    let result = await authenticatedTriggerSecretLifecycle.generate(ctx, {
      receiverTriggerId: 'trigger-1',
      name: 'verification'
    });

    expect(generate).toHaveBeenCalledWith({
      receiverTriggerId: 'trigger-1',
      name: 'verification',
      actor: { actorId: 'signed-internal-service', requestId: 'request-123' }
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(result.secret).toMatchObject({ id: 'secret-1', secretVersion: 2, aadVersion: 2 });
  });

  it('executes imported rotation, configured re-encryption, revoke, and metadata paths', async () => {
    let rotate = serviceMock.rotateImportedDeclaredTriggerSecret.mockResolvedValue(mutation);
    let reencrypt = serviceMock.reencryptDeclaredTriggerSecret.mockResolvedValue(mutation);
    let revoke = serviceMock.revokeDeclaredTriggerSecret.mockResolvedValue(mutation);
    let resolve = serviceMock.resolveDeclaredTriggerSecretMetadata.mockResolvedValue([
      { id: 'secret-1', status: 'active' }
    ]);

    await authenticatedTriggerSecretLifecycle.rotateImported(ctx, {
      receiverTriggerId: 'trigger-1',
      name: 'verification',
      value: 'imported-only-at-authenticated-boundary'
    });
    await authenticatedTriggerSecretLifecycle.reencrypt(ctx, {
      receiverTriggerId: 'trigger-1',
      name: 'verification',
      secretId: 'secret-1'
    });
    await authenticatedTriggerSecretLifecycle.revoke(ctx, {
      receiverTriggerId: 'trigger-1',
      name: 'verification',
      secretId: 'secret-1'
    });
    let metadata = await authenticatedTriggerSecretLifecycle.resolveMetadata({
      receiverTriggerId: 'trigger-1',
      name: 'verification'
    });

    expect(rotate).toHaveBeenCalledWith(
      expect.objectContaining({
        plaintext: 'imported-only-at-authenticated-boundary',
        actor: { actorId: 'signed-internal-service', requestId: 'request-123' }
      })
    );
    expect(reencrypt).toHaveBeenCalledWith({
      receiverTriggerId: 'trigger-1',
      name: 'verification',
      secretId: 'secret-1',
      actor: { actorId: 'signed-internal-service', requestId: 'request-123' }
    });
    expect(revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        secretId: 'secret-1',
        actor: { actorId: 'signed-internal-service', requestId: 'request-123' }
      })
    );
    expect(resolve).toHaveBeenCalledWith({
      receiverTriggerId: 'trigger-1',
      name: 'verification'
    });
    expect(metadata).toEqual([{ id: 'secret-1', status: 'active' }]);
  });

  it('propagates authoritative tenant, spec, and operation denials', async () => {
    serviceMock.generateDeclaredTriggerSecret.mockRejectedValueOnce(
      new Error('tenant binding denied')
    );
    await expect(
      authenticatedTriggerSecretLifecycle.generate(ctx, {
        receiverTriggerId: 'cross-tenant-trigger',
        name: 'verification'
      })
    ).rejects.toThrow('tenant binding denied');

    serviceMock.resolveDeclaredTriggerSecretMetadata.mockRejectedValueOnce(
      new Error('published spec mismatch')
    );
    await expect(
      authenticatedTriggerSecretLifecycle.resolveMetadata({
        receiverTriggerId: 'trigger-1',
        name: 'undeclared'
      })
    ).rejects.toThrow('published spec mismatch');

    serviceMock.importDeclaredTriggerSecret.mockRejectedValueOnce(
      new Error('generated secret refs cannot import caller material')
    );
    await expect(
      authenticatedTriggerSecretLifecycle.import(ctx, {
        receiverTriggerId: 'trigger-1',
        name: 'generated-ref',
        value: 'forbidden'
      })
    ).rejects.toThrow('generated secret refs cannot import caller material');
  });

  it('derives config ownership and forwards only the declared canonical path', async () => {
    let tenant = { oid: 1n, id: 'tenant-1' };
    dbMock.slateInstanceConfig.findUnique.mockResolvedValue({
      oid: 2n,
      id: 'config-1',
      tenantOid: 1n,
      tenant,
      instance: { tenantOid: 1n }
    });
    serviceMock.importDeclaredInstanceConfigSecret.mockResolvedValue({
      ...mutation,
      marker: { type: 'metorial.instance_config_secret/v1', key: 'clients/0/secret' }
    });

    await authenticatedInstanceConfigSecretLifecycle.importDeclared(ctx, {
      slateInstanceConfigId: 'config-1',
      path: 'clients/0/secret',
      value: 'new-value'
    });

    expect(serviceMock.importDeclaredInstanceConfigSecret).toHaveBeenCalledWith({
      tenant,
      instanceConfigId: 'config-1',
      key: 'clients/0/secret',
      plaintext: 'new-value',
      actor: { actorId: 'signed-internal-service', requestId: 'request-123' }
    });

    dbMock.slateInstanceConfig.findUnique.mockResolvedValueOnce({
      id: 'config-2',
      tenantOid: 1n,
      tenant,
      instance: { tenantOid: 9n }
    });
    await expect(
      authenticatedInstanceConfigSecretLifecycle.importDeclared(ctx, {
        slateInstanceConfigId: 'config-2',
        path: 'clients/0/secret',
        value: 'cross-tenant'
      })
    ).rejects.toThrow('Authenticated config owner binding is invalid');
  });

  it('derives receiver ownership for rotate/revoke and propagates receipt state denials', async () => {
    let tenant = { oid: 1n, id: 'tenant-1' };
    let callbackCtx = {
      serviceActorId: 'subspace_callback_security',
      requestId: 'hub-rpc-request'
    };
    let callbackAuthority = {
      tenantId: tenant.id,
      receiverId: 'receiver-1',
      callbackId: 'callback-1',
      callbackInstanceId: 'callback-instance-1',
      receiverAuthorityVersion: 3,
      trustedActorId: 'organization-actor-1',
      requestId: 'dashboard-request-1',
      requestIp: '192.0.2.10',
      requestUserAgent: 'dashboard-test'
    };
    dbMock.slateTriggerReceiver.findUnique.mockResolvedValue({
      oid: 2n,
      id: 'receiver-1',
      tenantOid: 1n,
      tenant,
      callbackId: callbackAuthority.callbackId,
      callbackInstanceId: callbackAuthority.callbackInstanceId,
      callbackOwnerVersion: callbackAuthority.receiverAuthorityVersion,
      status: 'active',
      tombstonedAt: null
    });
    serviceMock.rotatePathSecret.mockResolvedValue({
      ...mutation,
      receipt: { id: 'receipt-rotate', token: 'one-time-token' }
    });
    serviceMock.revokePathSecret.mockResolvedValue(mutation);
    serviceMock.revokeAllPathSecrets.mockResolvedValue({
      secrets: [{ ...mutation.secret, status: 'revoked' }],
      revokedCount: 1,
      auditCorrelationId: 'audit-revoke-all'
    });
    serviceMock.consumePathReceipt
      .mockResolvedValueOnce({
        plaintext: 'metorial_whpath_generated',
        auditCorrelationId: 'a-1'
      })
      .mockRejectedValueOnce(new SecretIssuanceReceiptDeniedError('denied', 'a-denied-1'))
      .mockRejectedValueOnce(new SecretIssuanceReceiptDeniedError('denied', 'a-denied-2'));

    let rotated = await authenticatedReceiverSecretLifecycle.rotatePath(callbackCtx, {
      ...callbackAuthority,
      graceMs: 30_000
    });
    await authenticatedReceiverSecretLifecycle.revokePath(callbackCtx, {
      ...callbackAuthority,
      secretId: 'secret-1'
    });
    let revokedAll = await authenticatedReceiverSecretLifecycle.revokeAllPath(
      callbackCtx,
      callbackAuthority
    );
    let receiptInput = {
      ...callbackAuthority,
      receiptId: 'receipt-rotate',
      receiptToken: 'one-time-token'
    };
    await expect(
      authenticatedReceiverSecretLifecycle.consumePathReceipt(callbackCtx, receiptInput)
    ).resolves.toMatchObject({
      outcome: 'consumed',
      plaintext: 'metorial_whpath_generated'
    });
    await expect(
      authenticatedReceiverSecretLifecycle.consumePathReceipt(callbackCtx, receiptInput)
    ).resolves.toEqual({ outcome: 'denied', auditCorrelationId: 'a-denied-1' });
    await expect(
      authenticatedReceiverSecretLifecycle.consumePathReceipt(callbackCtx, {
        ...receiptInput,
        receiptId: 'receipt-for-retiring-or-revoked-secret'
      })
    ).resolves.toEqual({ outcome: 'denied', auditCorrelationId: 'a-denied-2' });

    expect(serviceMock.rotatePathSecret).toHaveBeenCalledWith({
      tenant,
      receiverId: 'receiver-1',
      actor: {
        actorId: callbackAuthority.trustedActorId,
        requestId: callbackAuthority.requestId,
        requestIp: callbackAuthority.requestIp,
        requestUserAgent: callbackAuthority.requestUserAgent
      },
      graceMs: 30_000
    });
    expect(serviceMock.revokePathSecret).toHaveBeenCalledWith({
      tenant,
      receiverId: 'receiver-1',
      secretId: 'secret-1',
      actor: {
        actorId: callbackAuthority.trustedActorId,
        requestId: callbackAuthority.requestId,
        requestIp: callbackAuthority.requestIp,
        requestUserAgent: callbackAuthority.requestUserAgent
      }
    });
    expect(serviceMock.revokeAllPathSecrets).toHaveBeenCalledWith({
      tenant,
      receiverId: 'receiver-1',
      actor: {
        actorId: callbackAuthority.trustedActorId,
        requestId: callbackAuthority.requestId,
        requestIp: callbackAuthority.requestIp,
        requestUserAgent: callbackAuthority.requestUserAgent
      }
    });
    expect(revokedAll).toEqual({
      secrets: [
        expect.objectContaining({ id: 'secret-1', status: 'revoked', secretVersion: 2 })
      ],
      revokedCount: 1,
      auditCorrelationId: 'audit-revoke-all'
    });
    expect(JSON.stringify(rotated)).not.toMatch(/encryptedValue|lookupHash|plaintext/);
    expect(JSON.stringify(revokedAll)).not.toMatch(/encryptedValue|lookupHash|plaintext/);
  });

  it('rejects unknown/cross-tenant receiver authority before any lifecycle service call', async () => {
    dbMock.slateTriggerReceiver.findUnique.mockResolvedValue(null);
    await expect(
      authenticatedReceiverSecretLifecycle.rotatePath(
        { serviceActorId: 'subspace_callback_security', requestId: 'rpc-request' },
        {
          receiverId: 'receiver-owned-by-another-tenant',
          callbackId: 'callback-1',
          callbackInstanceId: 'callback-instance-1',
          receiverAuthorityVersion: 1,
          trustedActorId: 'actor-1',
          requestId: 'dashboard-request'
        }
      )
    ).rejects.toThrow('Authenticated receiver owner was not found');
    expect(serviceMock.rotatePathSecret).not.toHaveBeenCalled();
  });

  it.each([
    'wrong receiver',
    'wrong tenant',
    'stale authority',
    'detached receiver',
    'deleted receiver'
  ])(
    'returns one non-disclosing response for authenticated %s receipt denial without a controller lookup',
    async () => {
      serviceMock.consumePathReceipt.mockRejectedValue(
        new SecretIssuanceReceiptDeniedError('denied', 'audit-denied')
      );
      let input = {
        tenantId: 'tenant-1',
        receiverId: 'receiver-1',
        callbackId: 'callback-1',
        callbackInstanceId: 'callback-instance-1',
        receiverAuthorityVersion: 3,
        trustedActorId: 'organization-actor-1',
        requestId: 'dashboard-request-1',
        requestIp: '192.0.2.10',
        requestUserAgent: 'dashboard-test',
        receiptId: 'receipt-1',
        receiptToken: 'one-time-token'
      };

      await expect(
        authenticatedReceiverSecretLifecycle.consumePathReceipt(
          { serviceActorId: 'subspace_callback_security', requestId: 'hub-request' },
          input
        )
      ).resolves.toEqual({ outcome: 'denied', auditCorrelationId: 'audit-denied' });
      expect(dbMock.slateTriggerReceiver.findUnique).not.toHaveBeenCalled();
      expect(serviceMock.consumePathReceipt).toHaveBeenCalledWith({
        callbackReceiverOwner: {
          tenantId: input.tenantId,
          receiverId: input.receiverId,
          callbackId: input.callbackId,
          callbackInstanceId: input.callbackInstanceId,
          receiverAuthorityVersion: input.receiverAuthorityVersion
        },
        receiptId: input.receiptId,
        token: input.receiptToken,
        actor: {
          actorId: input.trustedActorId,
          requestId: input.requestId,
          requestIp: input.requestIp,
          requestUserAgent: input.requestUserAgent
        }
      });
    }
  );

  it('authorizes audit repair against the immutable commit snapshot after receiver deletion', async () => {
    let callbackCtx = {
      serviceActorId: 'subspace_callback_security',
      requestId: 'hub-rpc-request'
    };
    let input = {
      tenantId: 'tenant-deleted',
      receiverId: 'receiver-deleted',
      callbackId: 'callback-1',
      callbackInstanceId: 'callback-instance-detached',
      receiverAuthorityVersion: 4,
      trustedActorId: 'organization-actor-1',
      requestId: 'dashboard-request-1',
      requestIp: '192.0.2.10',
      requestUserAgent: 'dashboard-test',
      auditCorrelationId: 'audit-after-delete'
    };
    serviceMock.getReceiverSecretAuditByCorrelation.mockResolvedValue({
      id: 'audit-1',
      auditCorrelationId: input.auditCorrelationId
    });

    await authenticatedReceiverSecretLifecycle.getAudit(callbackCtx, input);

    expect(dbMock.slateTriggerReceiver.findUnique).not.toHaveBeenCalled();
    expect(serviceMock.getReceiverSecretAuditByCorrelation).toHaveBeenCalledWith({
      tenantId: input.tenantId,
      receiverId: input.receiverId,
      callbackId: input.callbackId,
      callbackInstanceId: input.callbackInstanceId,
      receiverAuthorityVersion: input.receiverAuthorityVersion,
      actor: {
        actorId: input.trustedActorId,
        requestId: input.requestId,
        requestIp: input.requestIp,
        requestUserAgent: input.requestUserAgent
      },
      auditCorrelationId: input.auditCorrelationId
    });
  });
});
