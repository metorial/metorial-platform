import { Service } from '@lowerdeck/service';
import {
  type Callback,
  type CallbackInstance,
  type CallbackSecurityAuditRecord,
  type Tenant,
  db,
  getId
} from '@metorial-subspace/db';
import {
  CALLBACK_SECURITY_AUDIT_ACTIONS,
  type CallbackSecurityAuditAction,
  type CallbackSecretAuditContext,
  type HubCallbackSecurityAudit
} from './callbackReceiverSecret';

let METADATA_KEYS = new Set([
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

export let sanitizeCallbackSecurityAuditMetadata = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Callback security audit metadata must be an object');
  }
  let output: Record<string, string | number | boolean | null> = {};
  for (let [key, item] of Object.entries(value)) {
    if (!METADATA_KEYS.has(key)) continue;
    if (
      item !== null &&
      typeof item !== 'string' &&
      typeof item !== 'number' &&
      typeof item !== 'boolean'
    ) {
      continue;
    }
    if (typeof item === 'string' && item.length > 256) continue;
    output[key] = item;
  }
  return output;
};

export type CallbackSecurityAuditTransaction = Pick<
  typeof db,
  'callbackSecurityAuditRecord' | 'callbackSecurityAuditOutbox'
>;

let assertAudit = (
  hubAudit: HubCallbackSecurityAudit,
  expected: CallbackSecretAuditContext,
  owner: {
    tenantId: string;
    callbackId: string;
    callbackInstanceId: string;
    receiverId: string;
    receiverAuthorityVersion: number;
  },
  expectedHubTenantId: string
) => {
  if (!CALLBACK_SECURITY_AUDIT_ACTIONS.includes(hubAudit.action)) {
    throw new Error('Hub callback security audit action is not in the closed union');
  }
  if (
    hubAudit.actorId !== expected.trustedActorId ||
    hubAudit.requestId !== expected.requestId ||
    (hubAudit.requestIp ?? undefined) !== expected.requestIp ||
    (hubAudit.requestUserAgent ?? undefined) !== expected.requestUserAgent
  ) {
    throw new Error('Hub callback security audit attribution does not match trusted context');
  }
  if (
    hubAudit.ownerSnapshot.tenantId !== expectedHubTenantId ||
    hubAudit.ownerSnapshot.callbackId !== owner.callbackId ||
    hubAudit.ownerSnapshot.callbackInstanceId !== owner.callbackInstanceId ||
    hubAudit.ownerSnapshot.receiverId !== owner.receiverId ||
    hubAudit.ownerSnapshot.receiverAuthorityVersion !== owner.receiverAuthorityVersion ||
    hubAudit.ownerSnapshot.committedAt.getTime() !== hubAudit.createdAt.getTime()
  ) {
    throw new Error('Hub callback security audit immutable owner snapshot is invalid');
  }
};

export let appendCallbackSecurityAuditInTransaction = async (d: {
  tx: CallbackSecurityAuditTransaction;
  tenant?: Tenant;
  callback?: Callback;
  callbackInstance?: CallbackInstance;
  ownerSnapshot: {
    tenantId: string;
    callbackId: string;
    callbackInstanceId: string;
    receiverId: string;
    receiverAuthorityVersion: number;
  };
  expectedHubTenantId: string;
  hubAudit: HubCallbackSecurityAudit;
  expectedContext: CallbackSecretAuditContext;
}) => {
  if (
    (d.tenant && d.tenant.id !== d.ownerSnapshot.tenantId) ||
    (d.callback &&
      (d.callback.id !== d.ownerSnapshot.callbackId ||
        (d.tenant && d.callback.tenantOid !== d.tenant.oid))) ||
    (d.callbackInstance &&
      (d.callbackInstance.id !== d.ownerSnapshot.callbackInstanceId ||
        (d.callback && d.callbackInstance.callbackOid !== d.callback.oid)))
  ) {
    throw new Error('Callback security audit owner binding is invalid');
  }
  assertAudit(d.hubAudit, d.expectedContext, d.ownerSnapshot, d.expectedHubTenantId);
  let existing = await d.tx.callbackSecurityAuditRecord.findUnique({
    where: { hubAuditCorrelationId: d.hubAudit.auditCorrelationId }
  });
  if (existing) {
    if (
      existing.tenantIdSnapshot !== d.ownerSnapshot.tenantId ||
      existing.callbackIdSnapshot !== d.ownerSnapshot.callbackId ||
      existing.callbackInstanceIdSnapshot !== d.ownerSnapshot.callbackInstanceId ||
      existing.hubReceiverId !== d.ownerSnapshot.receiverId ||
      existing.receiverAuthorityVersionSnapshot !== d.ownerSnapshot.receiverAuthorityVersion ||
      existing.action !== d.hubAudit.action
    ) {
      throw new Error('Callback security audit correlation is bound to another owner');
    }
    return existing;
  }

  let metadata = sanitizeCallbackSecurityAuditMetadata(d.hubAudit.metadata);
  let auditId = getId('callbackSecurityAudit');
  let audit = await d.tx.callbackSecurityAuditRecord.create({
    data: {
      ...auditId,
      tenantOid: d.tenant?.oid,
      callbackOid: d.callback?.oid,
      callbackInstanceOid: d.callbackInstance?.oid,
      hubReceiverId: d.ownerSnapshot.receiverId,
      hubAuditCorrelationId: d.hubAudit.auditCorrelationId,
      tenantIdSnapshot: d.ownerSnapshot.tenantId,
      callbackIdSnapshot: d.ownerSnapshot.callbackId,
      callbackInstanceIdSnapshot: d.ownerSnapshot.callbackInstanceId,
      receiverAuthorityVersionSnapshot: d.ownerSnapshot.receiverAuthorityVersion,
      authorityCommittedAt: d.hubAudit.ownerSnapshot.committedAt,
      action: d.hubAudit.action,
      actorId: d.hubAudit.actorId,
      requestId: d.hubAudit.requestId,
      requestIp: d.hubAudit.requestIp,
      requestUserAgent: d.hubAudit.requestUserAgent,
      metadata
    }
  });
  let outboxId = getId('callbackSecurityAuditOutbox');
  await d.tx.callbackSecurityAuditOutbox.create({
    data: {
      ...outboxId,
      auditRecordOid: audit.oid,
      hubAuditCorrelationId: audit.hubAuditCorrelationId,
      action: audit.action,
      payload: {
        version: 1,
        auditRecordId: audit.id,
        tenantId: d.ownerSnapshot.tenantId,
        callbackId: d.ownerSnapshot.callbackId,
        callbackInstanceId: d.ownerSnapshot.callbackInstanceId,
        hubReceiverId: d.ownerSnapshot.receiverId,
        receiverAuthorityVersion: d.ownerSnapshot.receiverAuthorityVersion,
        hubAuditCorrelationId: audit.hubAuditCorrelationId,
        action: audit.action,
        metadata
      }
    }
  });
  return audit;
};

class callbackSecurityAuditServiceImpl {
  async appendLinked(d: {
    tenant?: Tenant;
    callback?: Callback;
    callbackInstance?: CallbackInstance;
    ownerSnapshot: {
      tenantId: string;
      callbackId: string;
      callbackInstanceId: string;
      receiverId: string;
      receiverAuthorityVersion: number;
    };
    expectedHubTenantId: string;
    hubAudit: HubCallbackSecurityAudit;
    expectedContext: CallbackSecretAuditContext;
  }): Promise<CallbackSecurityAuditRecord> {
    return await db.$transaction(async tx =>
      appendCallbackSecurityAuditInTransaction({ ...d, tx })
    );
  }

  async getByCorrelation(auditCorrelationId: string) {
    return await db.callbackSecurityAuditRecord.findUnique({
      where: { hubAuditCorrelationId: auditCorrelationId }
    });
  }
}

export let callbackSecurityAuditService = Service.create(
  'callbackSecurityAuditService',
  () => new callbackSecurityAuditServiceImpl()
).build();

export type { CallbackSecurityAuditAction };
