import { randomBytes } from 'node:crypto';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import {
  appendAudit,
  commitHubSecretReencryptionInTransaction,
  type TrustedSecretActor
} from './slateTriggerSecretAudit';
import {
  findDeclaredTriggerSecretRef,
  receiverBinding,
  type HubTransaction
} from './slateTriggerSecretBinding';
import {
  activeWebhookEncryptionVersions,
  assertReadable,
  getWebhookSecretEncryption,
  WEBHOOK_SECRET_GRACE_MS,
  webhookSecretContexts
} from './slateTriggerSecretCrypto';

let resolveDeclaredTriggerSecretBinding = async (d: {
  receiverTriggerId: string;
  name: string;
}) => {
  let trigger = await db.slateTriggerReceiverTrigger.findUnique({
    where: { id: d.receiverTriggerId },
    include: {
      action: true,
      receiver: {
        include: {
          tenant: true,
          slateInstance: { include: { currentConfig: true } },
          authConfig: true
        }
      }
    }
  });
  if (!trigger) throw new Error('Receiver trigger secret binding was not found');
  let actionContract = trigger.action.spec as Record<string, unknown>;
  let specHash = actionContract.specHash;
  if (typeof specHash !== 'string' || !/^[a-f0-9]{64}$/.test(specHash)) {
    throw new Error('Published trigger action spec hash is missing or invalid');
  }
  let declared = findDeclaredTriggerSecretRef(actionContract, d.name);
  if (!declared) throw new Error('Trigger secret ref is not declared by the published action');
  let sourceBindingType: 'registration' | 'provider_config' | 'provisioned_app' | 'generated';
  let sourceBindingId: string;
  if (declared.source === 'registration') {
    if (!declared.registrationKey) throw new Error('Registration secret ref is incomplete');
    sourceBindingType = 'registration';
    sourceBindingId = `${trigger.id}:${trigger.registrationGeneration}`;
  } else if (declared.source === 'config') {
    if (!declared.configKey || !trigger.receiver.slateInstance.currentConfig) {
      throw new Error('Config secret ref has no authoritative current config binding');
    }
    sourceBindingType = 'provider_config';
    sourceBindingId = `${trigger.receiver.slateInstance.currentConfig.id}:${declared.configKey}`;
  } else if (declared.source === 'platform') {
    if (!declared.credentialKey || !trigger.receiver.authConfig) {
      throw new Error('Platform secret ref has no authorized credential binding');
    }
    sourceBindingType = 'provisioned_app';
    sourceBindingId = `${trigger.receiver.authConfig.id}:${declared.credentialKey}`;
  } else {
    sourceBindingType = 'generated';
    sourceBindingId = trigger.id;
  }
  return {
    trigger,
    declared,
    specHash,
    sourceBindingType,
    sourceBindingId
  };
};

let upsertBoundVendorSecret = async (d: {
  tenant: Tenant;
  receiverId: string;
  receiverTriggerId: string;
  specHash: string;
  sourceBindingType: 'registration' | 'provider_config' | 'provisioned_app' | 'generated';
  sourceBindingId: string;
  name: string;
  kind: string;
  encoding: string;
  plaintext: string;
  actor: TrustedSecretActor;
  graceMs?: number;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  return await db.$transaction(async tx => {
    let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
    let trigger = await tx.slateTriggerReceiverTrigger.findFirst({
      where: { id: d.receiverTriggerId, receiverOid: receiver.oid }
    });
    if (!trigger) throw new Error('Receiver trigger secret binding is invalid');
    let current = await tx.slateTriggerReceiverSecret.findFirst({
      where: {
        receiverTriggerOid: trigger.oid,
        specHash: d.specHash,
        name: d.name,
        status: 'active'
      },
      orderBy: { secretVersion: 'desc' }
    });
    if (
      current &&
      (current.sourceBindingType !== d.sourceBindingType ||
        current.sourceBindingId !== d.sourceBindingId)
    ) {
      throw new Error('Cross-binding trigger secret update denied');
    }
    let secretVersion = (current?.secretVersion ?? 0) + 1;
    if (current) {
      let validUntil = new Date(now.getTime() + (d.graceMs ?? WEBHOOK_SECRET_GRACE_MS));
      let updated = await tx.slateTriggerReceiverSecret.updateMany({
        where: { oid: current.oid, status: 'active' },
        data: { status: 'retiring', validUntil, rotatedAt: now }
      });
      if (updated.count !== 1) throw new Error('Trigger secret rotation conflict');
    }
    let id = getId('secret');
    let versions = activeWebhookEncryptionVersions();
    let context = webhookSecretContexts.trigger({
      tenantId: d.tenant.id,
      slateInstanceId: receiver.slateInstance.id,
      receiverId: receiver.id,
      receiverTriggerId: trigger.id,
      specHash: d.specHash,
      sourceBindingType: d.sourceBindingType,
      sourceBindingId: d.sourceBindingId,
      name: d.name,
      kind: d.kind,
      encoding: d.encoding,
      secretVersion,
      ...versions
    });
    let encryptedValue = await getWebhookSecretEncryption().encrypt({
      entityId: context,
      secret: d.plaintext,
      ...versions
    });
    let secret = await tx.slateTriggerReceiverSecret.create({
      data: {
        ...id,
        tenantOid: d.tenant.oid,
        slateInstanceOid: receiver.slateInstanceOid,
        receiverOid: receiver.oid,
        receiverTriggerOid: trigger.oid,
        specHash: d.specHash,
        sourceBindingType: d.sourceBindingType,
        sourceBindingId: d.sourceBindingId,
        name: d.name,
        kind: d.kind,
        encoding: d.encoding,
        encryptedValue,
        secretVersion,
        ...versions,
        status: 'active',
        validFrom: now
      }
    });
    let auditCorrelationId = await appendAudit(tx, {
      action: current ? 'secret_rotated' : 'secret_imported',
      tenantOid: d.tenant.oid,
      receiverOid: receiver.oid,
      actor: d.actor,
      metadata: { secretClass: 'trigger_verification', secretId: secret.id, secretVersion }
    });
    return { secret, auditCorrelationId };
  });
};

export let slateTriggerReceiverDeclaredSecretMethods = {
  async generateDeclaredTriggerSecret(d: {
    receiverTriggerId: string;
    name: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let binding = await resolveDeclaredTriggerSecretBinding(d);
    if (binding.declared.source !== 'generated') {
      throw new Error('Only generated secret refs are eligible for internal generation');
    }
    return await upsertBoundVendorSecret({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      receiverTriggerId: binding.trigger.id,
      specHash: binding.specHash,
      sourceBindingType: binding.sourceBindingType,
      sourceBindingId: binding.sourceBindingId,
      name: binding.declared.name,
      kind: binding.declared.source,
      encoding: binding.declared.encoding,
      plaintext: `metorial_whverify_${randomBytes(32).toString('base64url')}`,
      actor: d.actor,
      now: d.now
    });
  },

  async importDeclaredTriggerSecret(d: {
    receiverTriggerId: string;
    name: string;
    plaintext: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let binding = await resolveDeclaredTriggerSecretBinding(d);
    if (binding.declared.source === 'generated') {
      throw new Error('Generated secret refs cannot import caller material');
    }
    return await upsertBoundVendorSecret({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      receiverTriggerId: binding.trigger.id,
      specHash: binding.specHash,
      sourceBindingType: binding.sourceBindingType,
      sourceBindingId: binding.sourceBindingId,
      name: binding.declared.name,
      kind: binding.declared.source,
      encoding: binding.declared.encoding,
      plaintext: d.plaintext,
      actor: d.actor,
      now: d.now
    });
  },

  async rotateImportedDeclaredTriggerSecret(d: {
    receiverTriggerId: string;
    name: string;
    plaintext: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    return await this.importDeclaredTriggerSecret(d);
  },

  async resolveDeclaredTriggerSecretMetadata(d: {
    receiverTriggerId: string;
    name: string;
    now?: Date;
  }) {
    let binding = await resolveDeclaredTriggerSecretBinding(d);
    let resolved = await this.resolveBoundVendorSecrets({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      receiverTriggerId: binding.trigger.id,
      specHash: binding.specHash,
      sourceBindingType: binding.sourceBindingType,
      sourceBindingId: binding.sourceBindingId,
      name: binding.declared.name,
      now: d.now
    });
    return resolved.map(({ secret }) => ({
      id: secret.id,
      status: secret.status,
      secretVersion: secret.secretVersion,
      encryptionKeyVersion: secret.encryptionKeyVersion,
      aadVersion: secret.aadVersion,
      validFrom: secret.validFrom,
      validUntil: secret.validUntil,
      specHash: secret.specHash,
      sourceBindingType: secret.sourceBindingType,
      sourceBindingId: secret.sourceBindingId,
      name: secret.name,
      kind: secret.kind,
      encoding: secret.encoding
    }));
  },

  async resolveDeclaredTriggerSecretsForVerification(d: {
    receiverTriggerId: string;
    name: string;
    now?: Date;
  }) {
    let binding = await resolveDeclaredTriggerSecretBinding(d);
    let resolved = await this.resolveBoundVendorSecrets({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      receiverTriggerId: binding.trigger.id,
      specHash: binding.specHash,
      sourceBindingType: binding.sourceBindingType,
      sourceBindingId: binding.sourceBindingId,
      name: binding.declared.name,
      now: d.now
    });
    return resolved.map(({ secret, plaintext }) => ({
      name: secret.name,
      value: plaintext,
      encoding: secret.encoding as 'utf8' | 'hex' | 'base64' | 'base64url',
      version: secret.secretVersion,
      status: secret.status as 'active' | 'retiring',
      validUntil: secret.validUntil
    }));
  },

  async revokeDeclaredTriggerSecret(d: {
    receiverTriggerId: string;
    name: string;
    secretId: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let binding = await resolveDeclaredTriggerSecretBinding(d);
    let current = await this.resolveBoundVendorSecrets({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      receiverTriggerId: binding.trigger.id,
      specHash: binding.specHash,
      sourceBindingType: binding.sourceBindingType,
      sourceBindingId: binding.sourceBindingId,
      name: binding.declared.name,
      now: d.now
    });
    if (!current.some(({ secret }) => secret.id === d.secretId)) {
      throw new Error('Declared trigger secret is not active in the authoritative binding');
    }
    return await this.revokeBoundVendorSecret({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      secretId: d.secretId,
      actor: d.actor,
      now: d.now
    });
  },

  async reencryptDeclaredTriggerSecret(d: {
    receiverTriggerId: string;
    name: string;
    secretId: string;
    actor: TrustedSecretActor;
  }) {
    let binding = await resolveDeclaredTriggerSecretBinding(d);
    let current = await this.resolveBoundVendorSecrets({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      receiverTriggerId: binding.trigger.id,
      specHash: binding.specHash,
      sourceBindingType: binding.sourceBindingType,
      sourceBindingId: binding.sourceBindingId,
      name: binding.declared.name
    });
    if (!current.some(({ secret }) => secret.id === d.secretId)) {
      throw new Error('Declared trigger secret is not active in the authoritative binding');
    }
    return await this.reencryptBoundVendorSecret({
      tenant: binding.trigger.receiver.tenant,
      receiverId: binding.trigger.receiver.id,
      secretId: d.secretId,
      actor: d.actor
    });
  },

  async resolveBoundVendorSecrets(d: {
    tenant: Tenant;
    receiverId: string;
    receiverTriggerId: string;
    specHash: string;
    sourceBindingType: string;
    sourceBindingId: string;
    name: string;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    let receiver = await receiverBinding(
      db as unknown as HubTransaction,
      d.tenant,
      d.receiverId
    );
    let trigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: { id: d.receiverTriggerId, receiverOid: receiver.oid }
    });
    if (!trigger) throw new Error('Receiver trigger secret binding is invalid');
    let rows = await db.slateTriggerReceiverSecret.findMany({
      where: {
        tenantOid: d.tenant.oid,
        slateInstanceOid: receiver.slateInstanceOid,
        receiverOid: receiver.oid,
        receiverTriggerOid: trigger.oid,
        specHash: d.specHash,
        sourceBindingType: d.sourceBindingType,
        name: d.name,
        status: { in: ['active', 'retiring'] },
        validFrom: { lte: now },
        OR:
          d.sourceBindingType === 'registration'
            ? [
                { status: 'active', sourceBindingId: d.sourceBindingId },
                {
                  status: 'retiring',
                  sourceBindingId: { startsWith: `${trigger.id}:` },
                  validUntil: { gt: now }
                }
              ]
            : [
                { status: 'active', sourceBindingId: d.sourceBindingId },
                {
                  status: 'retiring',
                  sourceBindingId: d.sourceBindingId,
                  validUntil: { gt: now }
                }
              ]
      },
      orderBy: { secretVersion: 'desc' }
    });
    if (d.sourceBindingType === 'registration') {
      let prefix = `${trigger.id}:`;
      rows = rows.filter(secret => {
        if (secret.status === 'active') return secret.sourceBindingId === d.sourceBindingId;
        let generationText = secret.sourceBindingId.slice(prefix.length);
        let generation = Number(generationText);
        return (
          secret.sourceBindingId.startsWith(prefix) &&
          /^[1-9]\d*$/.test(generationText) &&
          generation <= trigger.registrationGeneration
        );
      });
    }
    return await Promise.all(
      rows.map(async secret => {
        assertReadable(secret, now);
        let context = webhookSecretContexts.trigger({
          tenantId: d.tenant.id,
          slateInstanceId: receiver.slateInstance.id,
          receiverId: receiver.id,
          receiverTriggerId: trigger.id,
          specHash: secret.specHash,
          sourceBindingType: secret.sourceBindingType,
          sourceBindingId: secret.sourceBindingId,
          name: secret.name,
          kind: secret.kind,
          encoding: secret.encoding,
          secretVersion: secret.secretVersion,
          encryptionKeyVersion: secret.encryptionKeyVersion,
          aadVersion: secret.aadVersion
        });
        return {
          secret,
          plaintext: await getWebhookSecretEncryption().decrypt({
            entityId: context,
            encrypted: secret.encryptedValue,
            encryptionKeyVersion: secret.encryptionKeyVersion,
            aadVersion: secret.aadVersion
          })
        };
      })
    );
  },

  async revokeBoundVendorSecret(d: {
    tenant: Tenant;
    receiverId: string;
    secretId: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
      let secret = await tx.slateTriggerReceiverSecret.findFirst({
        where: { id: d.secretId, receiverOid: receiver.oid, tenantOid: d.tenant.oid }
      });
      if (!secret) throw new Error('Bound trigger secret not found');
      let updated = await tx.slateTriggerReceiverSecret.update({
        where: { oid: secret.oid },
        data: { status: 'revoked', revokedAt: now }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_revoked',
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        actor: d.actor,
        metadata: {
          secretClass: 'trigger_verification',
          secretId: secret.id,
          secretVersion: secret.secretVersion
        }
      });
      return { secret: updated, auditCorrelationId };
    });
  },

  async reencryptBoundVendorSecret(d: {
    tenant: Tenant;
    receiverId: string;
    secretId: string;
    actor: TrustedSecretActor;
  }) {
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId);
      let secret = await tx.slateTriggerReceiverSecret.findFirst({
        where: { id: d.secretId, receiverOid: receiver.oid, tenantOid: d.tenant.oid }
      });
      if (!secret) throw new Error('Bound trigger secret not found');
      let trigger = await tx.slateTriggerReceiverTrigger.findUniqueOrThrow({
        where: { oid: secret.receiverTriggerOid }
      });
      let oldContext = webhookSecretContexts.trigger({
        tenantId: d.tenant.id,
        slateInstanceId: receiver.slateInstance.id,
        receiverId: receiver.id,
        receiverTriggerId: trigger.id,
        specHash: secret.specHash,
        sourceBindingType: secret.sourceBindingType,
        sourceBindingId: secret.sourceBindingId,
        name: secret.name,
        kind: secret.kind,
        encoding: secret.encoding,
        secretVersion: secret.secretVersion,
        encryptionKeyVersion: secret.encryptionKeyVersion,
        aadVersion: secret.aadVersion
      });
      let plaintext = await getWebhookSecretEncryption().decrypt({
        entityId: oldContext,
        encrypted: secret.encryptedValue,
        encryptionKeyVersion: secret.encryptionKeyVersion,
        aadVersion: secret.aadVersion
      });
      let nextVersions = activeWebhookEncryptionVersions();
      let nextContext = webhookSecretContexts.trigger({
        tenantId: d.tenant.id,
        slateInstanceId: receiver.slateInstance.id,
        receiverId: receiver.id,
        receiverTriggerId: trigger.id,
        specHash: secret.specHash,
        sourceBindingType: secret.sourceBindingType,
        sourceBindingId: secret.sourceBindingId,
        name: secret.name,
        kind: secret.kind,
        encoding: secret.encoding,
        secretVersion: secret.secretVersion,
        ...nextVersions
      });
      let encryptedValue = await getWebhookSecretEncryption().encrypt({
        entityId: nextContext,
        secret: plaintext,
        ...nextVersions
      });
      return await commitHubSecretReencryptionInTransaction({
        tx,
        actor: d.actor,
        tenantOid: d.tenant.oid,
        receiverOid: receiver.oid,
        metadata: {
          secretClass: 'bound_trigger',
          secretId: secret.id,
          secretVersion: secret.secretVersion
        },
        mutate: async () =>
          await tx.slateTriggerReceiverSecret.update({
            where: { oid: secret.oid },
            data: { encryptedValue, ...nextVersions }
          })
      });
    });
  }
};
