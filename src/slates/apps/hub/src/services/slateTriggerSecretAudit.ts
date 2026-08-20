import { randomBytes, randomUUID } from 'node:crypto';
import { encryption } from '../encryption';
import { getId } from '../id';
import type { Tenant } from '../../prisma/generated/client';
import type { HubTransaction } from './slateTriggerSecretBinding';
import { sha256, webhookSecretContexts } from './slateTriggerSecretCrypto';

export let SECRET_ISSUANCE_RECEIPT_TTL_MS = 10 * 60 * 1000;
export let hubSecretMigrationMetrics = {
  registrationDetailsLegacyFallbacks: 0,
  instanceConfigLegacyFallbacks: 0
};

export type TrustedSecretActor = {
  actorId: string;
  requestId: string;
  requestIp?: string | null;
  requestUserAgent?: string | null;
};

let SECRET_AUDIT_METADATA_KEYS = new Set([
  'key',
  'name',
  'operation',
  'provisionedTenantAppId',
  'registrationGeneration',
  'revokedCount',
  'secretClass',
  'secretId',
  'secretVersion'
]);

export let sanitizeWebhookSecretAuditMetadata = (
  metadata: Record<string, string | number | boolean | null>
) => {
  let sanitized: Record<string, string | number | boolean | null> = {};
  for (let [key, value] of Object.entries(metadata)) {
    if (!SECRET_AUDIT_METADATA_KEYS.has(key)) {
      throw new Error(`Webhook secret audit metadata key is not allowlisted: ${key}`);
    }
    if (typeof value === 'string') {
      if (value.length > 256) throw new Error('Webhook secret audit metadata is too long');
      if (/plaintext|encrypted|token|material|value/i.test(key)) {
        throw new Error('Sensitive webhook secret audit metadata is forbidden');
      }
    }
    sanitized[key] = value;
  }
  return sanitized;
};

export let sanitizeTrustedSecretActor = (actor: TrustedSecretActor) => {
  let actorId = actor.actorId.trim();
  let requestId = actor.requestId.trim();
  if (!actorId || actorId.length > 160 || !requestId || requestId.length > 160) {
    throw new Error('Trusted secret audit attribution is invalid');
  }
  let requestIp = actor.requestIp?.trim() || null;
  let requestUserAgent = actor.requestUserAgent?.trim() || null;
  if ((requestIp?.length ?? 0) > 128 || (requestUserAgent?.length ?? 0) > 512) {
    throw new Error('Trusted secret request context is invalid');
  }
  return { actorId, requestId, requestIp, requestUserAgent };
};

export class SecretIssuanceReceiptDeniedError extends Error {
  constructor(
    message: string,
    readonly auditCorrelationId: string
  ) {
    super(message);
    this.name = 'SecretIssuanceReceiptDeniedError';
  }
}

export type CallbackReceiverAuditOwner = {
  tenantId: string;
  receiverId: string;
  callbackId: string;
  callbackInstanceId: string;
  receiverAuthorityVersion: number;
};

export let callbackReceiverAuditOwner = (
  tenant: Pick<Tenant, 'id'>,
  receiver: {
    id: string;
    callbackId: string | null;
    callbackInstanceId: string | null;
    callbackOwnerVersion: number;
  }
): CallbackReceiverAuditOwner => {
  if (!receiver.callbackId || !receiver.callbackInstanceId) {
    throw new Error('Callback receiver owner binding is missing');
  }
  return {
    tenantId: tenant.id,
    receiverId: receiver.id,
    callbackId: receiver.callbackId,
    callbackInstanceId: receiver.callbackInstanceId,
    receiverAuthorityVersion: receiver.callbackOwnerVersion
  };
};

let assertCallbackReceiverAuditOwner = (
  metadata: Record<string, string | number | boolean | null>,
  owner: CallbackReceiverAuditOwner | undefined
) => {
  let isCallbackReceiverAudit = metadata.secretClass === 'receiver_path';
  if (isCallbackReceiverAudit !== Boolean(owner)) {
    throw new Error(
      'Callback receiver audit owner snapshot is required only for receiver audits'
    );
  }
  if (
    owner &&
    (!owner.tenantId ||
      !owner.receiverId ||
      !owner.callbackId ||
      !owner.callbackInstanceId ||
      !Number.isSafeInteger(owner.receiverAuthorityVersion) ||
      owner.receiverAuthorityVersion < 1)
  ) {
    throw new Error('Callback receiver audit owner snapshot is invalid');
  }
};

export let appendAudit = async (
  tx: HubTransaction,
  d: {
    action:
      | 'secret_created'
      | 'secret_imported'
      | 'secret_projected'
      | 'secret_rotated'
      | 'secret_revoked'
      | 'secret_issuance_receipt_issued'
      | 'secret_issuance_receipt_consumed'
      | 'secret_issuance_receipt_denied';
    tenantOid?: bigint;
    receiverOid?: bigint;
    provisionedRouteId?: string;
    actor: TrustedSecretActor;
    metadata: Record<string, string | number | boolean | null>;
    callbackReceiverOwner?: CallbackReceiverAuditOwner;
    auditCorrelationId?: string;
  }
) => {
  let actor = sanitizeTrustedSecretActor(d.actor);
  let metadata = sanitizeWebhookSecretAuditMetadata(d.metadata);
  assertCallbackReceiverAuditOwner(metadata, d.callbackReceiverOwner);
  let auditCorrelationId = d.auditCorrelationId ?? randomUUID();
  let auditId = getId('secret');
  await tx.webhookSecretAuditRecord.create({
    data: {
      oid: auditId.oid,
      id: auditId.id,
      auditCorrelationId,
      tenantOid: d.tenantOid,
      receiverOid: d.receiverOid,
      provisionedRouteId: d.provisionedRouteId,
      tenantIdSnapshot: d.callbackReceiverOwner?.tenantId,
      receiverIdSnapshot: d.callbackReceiverOwner?.receiverId,
      callbackIdSnapshot: d.callbackReceiverOwner?.callbackId,
      callbackInstanceIdSnapshot: d.callbackReceiverOwner?.callbackInstanceId,
      receiverAuthorityVersionSnapshot: d.callbackReceiverOwner?.receiverAuthorityVersion,
      action: d.action,
      actorId: actor.actorId,
      requestId: actor.requestId,
      requestIp: actor.requestIp,
      requestUserAgent: actor.requestUserAgent,
      metadata
    }
  });
  let outboxId = getId('secret');
  await tx.webhookSecretOutboxRecord.create({
    data: {
      oid: outboxId.oid,
      id: outboxId.id,
      auditCorrelationId,
      action: d.action,
      payload: {
        auditRecordId: auditId.id,
        secretClass: metadata.secretClass ?? null,
        secretId: metadata.secretId ?? null
      }
    }
  });
  return auditCorrelationId;
};

export let commitHubSecretReencryptionInTransaction = async <T>(d: {
  tx: HubTransaction;
  actor: TrustedSecretActor;
  tenantOid?: bigint;
  receiverOid?: bigint;
  provisionedRouteId?: string;
  callbackReceiverOwner?: CallbackReceiverAuditOwner;
  metadata: Record<string, string | number | boolean | null>;
  mutate: () => Promise<T>;
}) => {
  let secret = await d.mutate();
  let auditCorrelationId = await appendAudit(d.tx, {
    action: 'secret_projected',
    tenantOid: d.tenantOid,
    receiverOid: d.receiverOid,
    provisionedRouteId: d.provisionedRouteId,
    callbackReceiverOwner: d.callbackReceiverOwner,
    actor: d.actor,
    metadata: { ...d.metadata, operation: 'reencrypt' }
  });
  return { secret, auditCorrelationId };
};

export let issueReceipt = async (
  tx: HubTransaction,
  d: {
    tenantOid?: bigint;
    receiverOid?: bigint;
    provisionedRouteId?: string;
    secretClass: 'receiver_path' | 'app_route_path';
    secretId: string;
    plaintext: string;
    actor: TrustedSecretActor;
    callbackReceiverOwner?: CallbackReceiverAuditOwner;
    auditCorrelationId: string;
    now: Date;
  }
) => {
  let id = getId('secret');
  let token = `shrcpt_${randomBytes(32).toString('base64url')}`;
  let encryptedMaterial = await encryption.encrypt({
    entityId: webhookSecretContexts.receipt({
      receiptId: id.id,
      secretClass: d.secretClass,
      secretId: d.secretId
    }),
    secret: d.plaintext
  });
  let expiresAt = new Date(d.now.getTime() + SECRET_ISSUANCE_RECEIPT_TTL_MS);
  await tx.secretIssuanceReceipt.create({
    data: {
      oid: id.oid,
      id: id.id,
      tokenHash: sha256(token),
      tenantOid: d.tenantOid,
      receiverOid: d.receiverOid,
      provisionedRouteId: d.provisionedRouteId,
      secretClass: d.secretClass,
      secretId: d.secretId,
      encryptedMaterial,
      expiresAt
    }
  });
  await appendAudit(tx, {
    action: 'secret_issuance_receipt_issued',
    tenantOid: d.tenantOid,
    receiverOid: d.receiverOid,
    provisionedRouteId: d.provisionedRouteId,
    actor: d.actor,
    callbackReceiverOwner: d.callbackReceiverOwner,
    auditCorrelationId: d.auditCorrelationId,
    metadata: { secretClass: d.secretClass, secretId: d.secretId }
  });
  return { id: id.id, token, expiresAt };
};
