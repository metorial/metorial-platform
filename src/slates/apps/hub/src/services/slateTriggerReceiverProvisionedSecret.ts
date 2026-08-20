import { computeWebhookActionSpecHashV1 } from '@slates/proto';
import { db } from '../db';
import { getId } from '../id';
import { appendAudit, type TrustedSecretActor } from './slateTriggerSecretAudit';
import type { HubTransaction } from './slateTriggerSecretBinding';
import {
  activeWebhookEncryptionVersions,
  getWebhookSecretEncryption,
  sha256,
  WEBHOOK_SECRET_GRACE_MS,
  webhookSecretContexts
} from './slateTriggerSecretCrypto';

let resolveProvisionedTenantAppSecretBinding = async (
  tx: HubTransaction,
  provisionedTenantAppId: string,
  now: Date
) => {
  let binding = await tx.slateProvisionedTenantAppProjection.findUnique({
    where: { provisionedTenantAppId },
    include: {
      tenant: true,
      routeProjection: true,
      receiver: { include: { slateInstance: true } },
      receiverTrigger: { include: { action: true } }
    }
  });
  let actionSpec = binding?.receiverTrigger.action.spec as Record<string, any> | undefined;
  let currentSpecHash = actionSpec
    ? computeWebhookActionSpecHashV1(actionSpec as never)
    : null;
  if (
    !binding ||
    binding.tombstonedAt ||
    binding.status === 'tombstoned' ||
    (binding.expiresAt && binding.expiresAt <= now) ||
    binding.credentialOwnerType !== 'byo' ||
    binding.purpose !== 'shared_provisioned_app' ||
    binding.credentialSecretPurpose !== 'vendor_verification' ||
    !binding.credentialSecretId ||
    !Number.isInteger(binding.credentialVersion) ||
    binding.credentialVersion <= 0 ||
    binding.routeProjection.generation !== binding.routeGeneration ||
    binding.routeProjection.status !== 'active' ||
    binding.routeProjection.tombstonedAt ||
    (binding.routeProjection.expiresAt && binding.routeProjection.expiresAt <= now) ||
    binding.receiver.tenantOid !== binding.tenantOid ||
    binding.receiver.slateInstance.tenantOid !== binding.tenantOid ||
    binding.receiver.callbackInstanceId !== binding.callbackInstanceId ||
    binding.receiver.status !== 'active' ||
    binding.receiver.tombstonedAt ||
    binding.receiverTrigger.receiverOid !== binding.receiverOid ||
    binding.receiverTrigger.registrationGeneration !== binding.hubReceiverGeneration ||
    binding.receiverTrigger.action.key !== binding.triggerActionId ||
    currentSpecHash !== binding.triggerSpecHash ||
    binding.receiverTrigger.tombstonedAt
  ) {
    throw new Error('Provisioned tenant app secret authority is stale or invalid');
  }
  return binding;
};

export let slateTriggerReceiverProvisionedSecretMethods = {
  async createOrRotateProvisionedTenantAppSecret(d: {
    provisionedTenantAppId: string;
    plaintext: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    if (!d.plaintext) throw new Error('Provisioned tenant app secret material is required');
    return await db.$transaction(async tx => {
      let binding = await resolveProvisionedTenantAppSecretBinding(
        tx,
        d.provisionedTenantAppId,
        now
      );
      let sourceBindingId = binding.provisionedTenantAppId;
      let current = await tx.slateTriggerReceiverSecret.findFirst({
        where: {
          receiverTriggerOid: binding.receiverTriggerOid,
          specHash: binding.triggerSpecHash,
          name: 'vendor_verification'
        },
        orderBy: { secretVersion: 'desc' }
      });
      if (
        current?.id === binding.credentialSecretId &&
        current.secretVersion === binding.credentialVersion &&
        current.sourceBindingType === 'provisioned_app' &&
        current.sourceBindingId === sourceBindingId &&
        current.status === 'active'
      ) {
        let context = webhookSecretContexts.trigger({
          tenantId: binding.tenant.id,
          slateInstanceId: binding.receiver.slateInstance.id,
          receiverId: binding.receiver.id,
          receiverTriggerId: binding.receiverTrigger.id,
          specHash: binding.triggerSpecHash,
          sourceBindingType: 'provisioned_app',
          sourceBindingId,
          name: 'vendor_verification',
          kind: 'platform',
          encoding: 'utf8',
          secretVersion: current.secretVersion,
          encryptionKeyVersion: current.encryptionKeyVersion,
          aadVersion: current.aadVersion
        });
        let plaintext = await getWebhookSecretEncryption().decrypt({
          entityId: context,
          encrypted: current.encryptedValue,
          encryptionKeyVersion: current.encryptionKeyVersion,
          aadVersion: current.aadVersion
        });
        if (sha256(plaintext) !== sha256(d.plaintext)) {
          throw new Error('Provisioned tenant app secret retry material does not match');
        }
        return { secret: current, auditCorrelationId: null, idempotent: true as const };
      }
      if (
        (current && binding.credentialVersion !== current.secretVersion + 1) ||
        (current && current.status === 'active' && current.sourceBindingId === sourceBindingId)
      ) {
        throw new Error('Provisioned tenant app secret generation is stale or invalid');
      }
      if (current?.status === 'active') {
        let retired = await tx.slateTriggerReceiverSecret.updateMany({
          where: { oid: current.oid, status: 'active' },
          data: {
            status: 'retiring',
            validUntil: new Date(now.getTime() + WEBHOOK_SECRET_GRACE_MS),
            rotatedAt: now
          }
        });
        if (retired.count !== 1) throw new Error('Provisioned secret rotation conflict');
      }
      let versions = activeWebhookEncryptionVersions();
      let context = webhookSecretContexts.trigger({
        tenantId: binding.tenant.id,
        slateInstanceId: binding.receiver.slateInstance.id,
        receiverId: binding.receiver.id,
        receiverTriggerId: binding.receiverTrigger.id,
        specHash: binding.triggerSpecHash,
        sourceBindingType: 'provisioned_app',
        sourceBindingId,
        name: 'vendor_verification',
        kind: 'platform',
        encoding: 'utf8',
        secretVersion: binding.credentialVersion,
        ...versions
      });
      let encryptedValue = await getWebhookSecretEncryption().encrypt({
        entityId: context,
        secret: d.plaintext,
        ...versions
      });
      let generated = getId('secret');
      let secret = await tx.slateTriggerReceiverSecret.create({
        data: {
          oid: generated.oid,
          id: binding.credentialSecretId!,
          tenantOid: binding.tenantOid,
          slateInstanceOid: binding.receiver.slateInstanceOid,
          receiverOid: binding.receiverOid,
          receiverTriggerOid: binding.receiverTriggerOid,
          specHash: binding.triggerSpecHash,
          sourceBindingType: 'provisioned_app',
          sourceBindingId,
          name: 'vendor_verification',
          kind: 'platform',
          encoding: 'utf8',
          encryptedValue,
          secretVersion: binding.credentialVersion,
          ...versions,
          status: 'active',
          validFrom: now
        }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: current ? 'secret_rotated' : 'secret_imported',
        tenantOid: binding.tenantOid,
        receiverOid: binding.receiverOid,
        actor: d.actor,
        metadata: {
          secretClass: 'provisioned_tenant_app_verification',
          secretId: secret.id,
          secretVersion: secret.secretVersion,
          provisionedTenantAppId: binding.provisionedTenantAppId
        }
      });
      return { secret, auditCorrelationId, idempotent: false as const };
    });
  },

  async revokeProvisionedTenantAppSecret(d: {
    provisionedTenantAppId: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let binding = await resolveProvisionedTenantAppSecretBinding(
        tx,
        d.provisionedTenantAppId,
        now
      );
      let secret = await tx.slateTriggerReceiverSecret.findFirst({
        where: {
          id: binding.credentialSecretId!,
          secretVersion: binding.credentialVersion,
          tenantOid: binding.tenantOid,
          receiverOid: binding.receiverOid,
          receiverTriggerOid: binding.receiverTriggerOid,
          specHash: binding.triggerSpecHash,
          sourceBindingType: 'provisioned_app',
          sourceBindingId: binding.provisionedTenantAppId,
          name: 'vendor_verification'
        }
      });
      if (!secret) throw new Error('Provisioned tenant app secret was not found');
      if (secret.status === 'revoked') {
        return { secret, auditCorrelationId: null, idempotent: true as const };
      }
      let revoked = await tx.slateTriggerReceiverSecret.update({
        where: { oid: secret.oid },
        data: { status: 'revoked', validUntil: now, revokedAt: now }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_revoked',
        tenantOid: binding.tenantOid,
        receiverOid: binding.receiverOid,
        actor: d.actor,
        metadata: {
          secretClass: 'provisioned_tenant_app_verification',
          secretId: revoked.id,
          secretVersion: revoked.secretVersion,
          provisionedTenantAppId: binding.provisionedTenantAppId
        }
      });
      return { secret: revoked, auditCorrelationId, idempotent: false as const };
    });
  }
};
