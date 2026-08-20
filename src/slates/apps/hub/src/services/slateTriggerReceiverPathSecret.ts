import { randomBytes } from 'node:crypto';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { encryption } from '../encryption';
import { getId } from '../id';
import {
  appendAudit,
  callbackReceiverAuditOwner,
  commitHubSecretReencryptionInTransaction,
  issueReceipt,
  sanitizeTrustedSecretActor,
  sanitizeWebhookSecretAuditMetadata,
  SecretIssuanceReceiptDeniedError,
  type CallbackReceiverAuditOwner,
  type TrustedSecretActor
} from './slateTriggerSecretAudit';
import { receiverBinding, type HubTransaction } from './slateTriggerSecretBinding';
import {
  activeWebhookEncryptionVersions,
  assertReadable,
  decryptPath,
  encryptPath,
  RECEIVER_PATH_SECRET_GRACE_MS,
  sha256,
  webhookSecretContexts
} from './slateTriggerSecretCrypto';

export let slateTriggerReceiverPathSecretMethods = {
  async createInitialPathSecret(d: {
    tenant: Tenant;
    receiverId: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    let plaintext = `metorial_whpath_${randomBytes(32).toString('base64url')}`;
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
      let active = await tx.slateTriggerReceiverPathSecret.findFirst({
        where: { receiverOid: receiver.oid, status: 'active' }
      });
      if (active) throw new Error('Receiver already has an active path secret');
      // Revoked/retiring versions keep their rows for audit, so a fresh secret after a
      // full revocation must continue the version sequence to satisfy the
      // [receiverOid, secretVersion] uniqueness constraint.
      let latest = await tx.slateTriggerReceiverPathSecret.findFirst({
        where: { receiverOid: receiver.oid },
        orderBy: { secretVersion: 'desc' },
        select: { secretVersion: true }
      });
      let secretVersion = (latest?.secretVersion ?? 0) + 1;
      let id = getId('secret');
      let versions = activeWebhookEncryptionVersions();
      let encryptedValue = await encryptPath(plaintext, {
        tenantId: d.tenant.id,
        slateInstanceId: receiver.slateInstance.id,
        receiverId: receiver.id,
        secretVersion,
        ...versions
      });
      let secret = await tx.slateTriggerReceiverPathSecret.create({
        data: {
          ...id,
          tenantOid: d.tenant.oid,
          slateInstanceOid: receiver.slateInstanceOid,
          receiverOid: receiver.oid,
          encryptedValue,
          lookupHash: sha256(plaintext),
          secretVersion,
          ...versions,
          status: 'active',
          validFrom: now
        }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_created',
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        callbackReceiverOwner: callbackReceiverAuditOwner(d.tenant, receiver),
        actor: d.actor,
        metadata: { secretClass: 'receiver_path', secretId: secret.id, secretVersion }
      });
      let receipt = await issueReceipt(tx, {
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        callbackReceiverOwner: callbackReceiverAuditOwner(d.tenant, receiver),
        secretClass: 'receiver_path',
        secretId: secret.id,
        plaintext,
        actor: d.actor,
        auditCorrelationId,
        now
      });
      return { secret, receipt, auditCorrelationId };
    });
  },

  async getReceiverSecretAuditByCorrelation(d: {
    tenantId: string;
    receiverId: string;
    callbackId: string;
    callbackInstanceId: string;
    receiverAuthorityVersion: number;
    actor: TrustedSecretActor;
    auditCorrelationId: string;
  }) {
    if (!d.auditCorrelationId || d.auditCorrelationId.length > 160) {
      throw new Error('Webhook secret audit correlation is invalid');
    }
    let actor = sanitizeTrustedSecretActor(d.actor);
    let record = await db.webhookSecretAuditRecord.findFirst({
      where: {
        auditCorrelationId: d.auditCorrelationId,
        tenantIdSnapshot: d.tenantId,
        receiverIdSnapshot: d.receiverId,
        callbackIdSnapshot: d.callbackId,
        callbackInstanceIdSnapshot: d.callbackInstanceId,
        receiverAuthorityVersionSnapshot: d.receiverAuthorityVersion,
        actorId: actor.actorId,
        requestId: actor.requestId,
        requestIp: actor.requestIp ?? null,
        requestUserAgent: actor.requestUserAgent ?? null,
        action: { not: 'secret_issuance_receipt_issued' }
      },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
    });
    if (!record) throw new Error('Webhook secret audit record was not found');
    if (
      !record.tenantIdSnapshot ||
      !record.receiverIdSnapshot ||
      !record.callbackIdSnapshot ||
      !record.callbackInstanceIdSnapshot ||
      record.receiverAuthorityVersionSnapshot === null
    ) {
      throw new Error('Webhook secret audit callback receiver owner snapshot is invalid');
    }
    return {
      id: record.id,
      auditCorrelationId: record.auditCorrelationId,
      action: record.action,
      actorId: record.actorId,
      requestId: record.requestId,
      requestIp: record.requestIp,
      requestUserAgent: record.requestUserAgent,
      metadata: sanitizeWebhookSecretAuditMetadata(
        record.metadata as Record<string, string | number | boolean | null>
      ),
      createdAt: record.createdAt,
      ownerSnapshot: {
        tenantId: record.tenantIdSnapshot,
        receiverId: record.receiverIdSnapshot,
        callbackId: record.callbackIdSnapshot,
        callbackInstanceId: record.callbackInstanceIdSnapshot,
        receiverAuthorityVersion: record.receiverAuthorityVersionSnapshot,
        committedAt: record.createdAt
      }
    };
  },

  async rotatePathSecret(d: {
    tenant: Tenant;
    receiverId: string;
    actor: TrustedSecretActor;
    graceMs?: number;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    let graceMs = d.graceMs ?? RECEIVER_PATH_SECRET_GRACE_MS;
    if (!Number.isInteger(graceMs) || graceMs < 0) {
      throw new Error('Receiver path secret grace period is invalid');
    }
    let validUntil = new Date(now.getTime() + graceMs);
    let plaintext = `metorial_whpath_${randomBytes(32).toString('base64url')}`;
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
      let active = await tx.slateTriggerReceiverPathSecret.findFirst({
        where: { receiverOid: receiver.oid, status: 'active' },
        orderBy: { secretVersion: 'desc' }
      });
      if (!active) throw new Error('Receiver has no active path secret');
      let retired = await tx.slateTriggerReceiverPathSecret.updateMany({
        where: { oid: active.oid, status: 'active' },
        data:
          graceMs === 0
            ? { status: 'revoked', validUntil, rotatedAt: now, revokedAt: now }
            : { status: 'retiring', validUntil, rotatedAt: now }
      });
      if (retired.count !== 1) throw new Error('Receiver path secret rotation conflict');
      let secretVersion = active.secretVersion + 1;
      let id = getId('secret');
      let versions = activeWebhookEncryptionVersions();
      let encryptedValue = await encryptPath(plaintext, {
        tenantId: d.tenant.id,
        slateInstanceId: receiver.slateInstance.id,
        receiverId: receiver.id,
        secretVersion,
        ...versions
      });
      let secret = await tx.slateTriggerReceiverPathSecret.create({
        data: {
          ...id,
          tenantOid: d.tenant.oid,
          slateInstanceOid: receiver.slateInstanceOid,
          receiverOid: receiver.oid,
          encryptedValue,
          lookupHash: sha256(plaintext),
          secretVersion,
          ...versions,
          status: 'active',
          validFrom: now
        }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_rotated',
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        callbackReceiverOwner: callbackReceiverAuditOwner(d.tenant, receiver),
        actor: d.actor,
        metadata: { secretClass: 'receiver_path', secretId: secret.id, secretVersion }
      });
      let receipt = await issueReceipt(tx, {
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        callbackReceiverOwner: callbackReceiverAuditOwner(d.tenant, receiver),
        secretClass: 'receiver_path',
        secretId: secret.id,
        plaintext,
        actor: d.actor,
        auditCorrelationId,
        now
      });
      return { secret, receipt, auditCorrelationId, graceExpiresAt: validUntil };
    });
  },

  async revokePathSecret(d: {
    tenant: Tenant;
    receiverId: string;
    secretId: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
      let secret = await tx.slateTriggerReceiverPathSecret.findFirst({
        where: { id: d.secretId, receiverOid: receiver.oid, tenantOid: d.tenant.oid }
      });
      if (!secret) throw new Error('Receiver path secret not found');
      let revoked = await tx.slateTriggerReceiverPathSecret.update({
        where: { oid: secret.oid },
        data: { status: 'revoked', revokedAt: now }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_revoked',
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        callbackReceiverOwner: callbackReceiverAuditOwner(d.tenant, receiver),
        actor: d.actor,
        metadata: {
          secretClass: 'receiver_path',
          secretId: secret.id,
          secretVersion: secret.secretVersion
        }
      });
      return { secret: revoked, auditCorrelationId };
    });
  },

  async revokeAllPathSecrets(d: {
    tenant: Tenant;
    receiverId: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
      let secrets = await tx.slateTriggerReceiverPathSecret.findMany({
        where: { receiverOid: receiver.oid, status: { in: ['active', 'retiring'] } },
        orderBy: { secretVersion: 'desc' }
      });
      if (secrets.length > 0) {
        let revoked = await tx.slateTriggerReceiverPathSecret.updateMany({
          where: {
            oid: { in: secrets.map(secret => secret.oid) },
            status: { in: ['active', 'retiring'] }
          },
          data: { status: 'revoked', revokedAt: now, validUntil: now }
        });
        if (revoked.count !== secrets.length) {
          throw new Error('Receiver path secret revocation conflict');
        }
      }
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_revoked',
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        callbackReceiverOwner: callbackReceiverAuditOwner(d.tenant, receiver),
        actor: d.actor,
        metadata: {
          secretClass: 'receiver_path',
          operation: 'revoke_all',
          revokedCount: secrets.length
        }
      });
      let revokedSecrets = await tx.slateTriggerReceiverPathSecret.findMany({
        where: { oid: { in: secrets.map(secret => secret.oid) } },
        orderBy: { secretVersion: 'desc' }
      });
      return { secrets: revokedSecrets, revokedCount: secrets.length, auditCorrelationId };
    });
  },

  async cleanupExpiredPathSecrets(d: { now?: Date } = {}) {
    let now = d.now ?? new Date();
    return await db.slateTriggerReceiverPathSecret.updateMany({
      where: { status: 'retiring', validUntil: { lte: now } },
      data: { status: 'revoked', revokedAt: now }
    });
  },

  async resolvePathActiveAndRetiring(d: { tenant: Tenant; receiverId: string; now?: Date }) {
    let now = d.now ?? new Date();
    let receiver = await receiverBinding(
      db as unknown as HubTransaction,
      d.tenant,
      d.receiverId
    );
    let secrets = await db.slateTriggerReceiverPathSecret.findMany({
      where: {
        tenantOid: d.tenant.oid,
        slateInstanceOid: receiver.slateInstanceOid,
        receiverOid: receiver.oid,
        status: { in: ['active', 'retiring'] },
        validFrom: { lte: now },
        OR: [{ status: 'active' }, { status: 'retiring', validUntil: { gt: now } }]
      },
      orderBy: [{ status: 'asc' }, { secretVersion: 'desc' }]
    });
    let resolved = [];
    for (let secret of secrets) {
      assertReadable(secret, now);
      let plaintext = await decryptPath(secret, {
        tenantId: d.tenant.id,
        slateInstanceId: receiver.slateInstance.id,
        receiverId: receiver.id
      });
      if (sha256(plaintext) !== secret.lookupHash)
        throw new Error('Path secret checksum mismatch');
      resolved.push({ secret, plaintext });
    }
    return resolved;
  },

  async reencryptPathSecret(d: {
    tenant: Tenant;
    receiverId: string;
    secretId: string;
    actor: TrustedSecretActor;
  }) {
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
      let secret = await tx.slateTriggerReceiverPathSecret.findFirstOrThrow({
        where: { id: d.secretId, receiverOid: receiver.oid, tenantOid: d.tenant.oid }
      });
      let plaintext = await decryptPath(secret, {
        tenantId: d.tenant.id,
        slateInstanceId: receiver.slateInstance.id,
        receiverId: receiver.id
      });
      let nextVersions = activeWebhookEncryptionVersions();
      let encryptedValue = await encryptPath(plaintext, {
        tenantId: d.tenant.id,
        slateInstanceId: receiver.slateInstance.id,
        receiverId: receiver.id,
        secretVersion: secret.secretVersion,
        ...nextVersions
      });
      return await commitHubSecretReencryptionInTransaction({
        tx,
        actor: d.actor,
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        callbackReceiverOwner: callbackReceiverAuditOwner(d.tenant, receiver),
        metadata: {
          secretClass: 'receiver_path',
          secretId: secret.id,
          secretVersion: secret.secretVersion
        },
        mutate: async () =>
          await tx.slateTriggerReceiverPathSecret.update({
            where: { oid: secret.oid },
            data: { encryptedValue, ...nextVersions }
          })
      });
    });
  },

  async consumePathReceipt(d: {
    callbackReceiverOwner: CallbackReceiverAuditOwner;
    receiptId: string;
    token: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    try {
      return await db.$transaction(async tx => {
        let receiver = await tx.slateTriggerReceiver.findUnique({
          where: { id: d.callbackReceiverOwner.receiverId },
          include: { tenant: true, slateInstance: true }
        });
        if (
          !receiver ||
          receiver.status !== 'active' ||
          receiver.tombstonedAt !== null ||
          receiver.slateInstance.tenantOid !== receiver.tenantOid
        ) {
          throw new Error('Receiver receipt owner binding is invalid');
        }
        let currentOwner = callbackReceiverAuditOwner(receiver.tenant, receiver);
        if (
          currentOwner.tenantId !== d.callbackReceiverOwner.tenantId ||
          currentOwner.receiverId !== d.callbackReceiverOwner.receiverId ||
          currentOwner.callbackId !== d.callbackReceiverOwner.callbackId ||
          currentOwner.callbackInstanceId !== d.callbackReceiverOwner.callbackInstanceId ||
          currentOwner.receiverAuthorityVersion !==
            d.callbackReceiverOwner.receiverAuthorityVersion
        ) {
          throw new Error('Receiver receipt owner binding is invalid');
        }
        let receipt = await tx.secretIssuanceReceipt.findFirst({
          where: {
            id: d.receiptId,
            tokenHash: sha256(d.token),
            tenantOid: receiver.tenantOid,
            receiverOid: receiver.oid,
            secretClass: 'receiver_path'
          }
        });
        if (!receipt || receipt.status !== 'issued' || receipt.expiresAt <= now) {
          throw new Error('Secret issuance receipt is invalid, expired, or consumed');
        }
        let referencedSecret = await tx.slateTriggerReceiverPathSecret.findFirst({
          where: {
            id: receipt.secretId,
            receiverOid: receiver.oid,
            tenantOid: receiver.tenantOid,
            status: 'active',
            validFrom: { lte: now }
          }
        });
        let current = await tx.slateTriggerReceiverPathSecret.findFirst({
          where: {
            receiverOid: receiver.oid,
            tenantOid: receiver.tenantOid,
            status: 'active',
            validFrom: { lte: now }
          },
          orderBy: { secretVersion: 'desc' }
        });
        if (!referencedSecret || current?.oid !== referencedSecret.oid) {
          throw new Error('Receipt no longer references the current active path secret');
        }
        let consumed = await tx.secretIssuanceReceipt.updateMany({
          where: { oid: receipt.oid, status: 'issued', expiresAt: { gt: now } },
          data: { status: 'consumed', consumedAt: now }
        });
        if (consumed.count !== 1)
          throw new Error('Secret issuance receipt was already consumed');
        let plaintext = await encryption.decrypt({
          entityId: webhookSecretContexts.receipt({
            receiptId: receipt.id,
            secretClass: receipt.secretClass,
            secretId: receipt.secretId
          }),
          encrypted: receipt.encryptedMaterial
        });
        let auditCorrelationId = await appendAudit(tx, {
          action: 'secret_issuance_receipt_consumed',
          tenantOid: receiver.tenantOid,
          receiverOid: receiver.oid,
          callbackReceiverOwner: d.callbackReceiverOwner,
          actor: d.actor,
          metadata: { secretClass: receipt.secretClass, secretId: receipt.secretId }
        });
        return { plaintext, auditCorrelationId };
      });
    } catch (error) {
      let auditCorrelationId = await db.$transaction(async tx => {
        return await appendAudit(tx, {
          action: 'secret_issuance_receipt_denied',
          callbackReceiverOwner: d.callbackReceiverOwner,
          actor: d.actor,
          metadata: { secretClass: 'receiver_path', secretId: d.receiptId }
        });
      });
      throw new SecretIssuanceReceiptDeniedError(
        'Secret issuance receipt was denied',
        auditCorrelationId
      );
    }
  }
};
