import { Prisma, type Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import {
  appendAudit,
  commitHubSecretReencryptionInTransaction,
  hubSecretMigrationMetrics,
  type TrustedSecretActor
} from './slateTriggerSecretAudit';
import {
  collectDeclaredConfigSecretRefs,
  isRecord,
  type HubTransaction
} from './slateTriggerSecretBinding';
import {
  activeWebhookEncryptionVersions,
  getWebhookSecretEncryption,
  WEBHOOK_SECRET_GRACE_MS,
  webhookSecretContexts
} from './slateTriggerSecretCrypto';
import {
  cloneConfigValue,
  collectInstanceConfigSecretPaths,
  extractInstanceConfigSecretEntries,
  getConfigPathValue,
  instanceConfigSecretMarker,
  isInstanceConfigSecretMarker,
  prepareDeclaredInstanceConfigSecretImport,
  setConfigPathValue
} from './slateInstanceConfigSecretSchema';

let upsertInstanceConfigSecretInTransaction = async (d: {
  tx: HubTransaction;
  tenant: Tenant;
  config: { oid: bigint; id: string; value: Prisma.JsonValue };
  key: string;
  plaintext: string;
  actor: TrustedSecretActor;
  now: Date;
}) => {
  let current = await d.tx.slateInstanceConfigSecret.findFirst({
    where: { instanceConfigOid: d.config.oid, key: d.key, status: 'active' },
    orderBy: { secretVersion: 'desc' }
  });
  if (current) {
    let currentPlaintext = await getWebhookSecretEncryption().decrypt({
      entityId: webhookSecretContexts.config({
        tenantId: d.tenant.id,
        instanceConfigId: d.config.id,
        key: current.key,
        secretVersion: current.secretVersion,
        encryptionKeyVersion: current.encryptionKeyVersion,
        aadVersion: current.aadVersion
      }),
      encrypted: current.encryptedValue,
      encryptionKeyVersion: current.encryptionKeyVersion,
      aadVersion: current.aadVersion
    });
    if (currentPlaintext === d.plaintext) {
      return { secret: current, auditCorrelationId: null };
    }
  }
  if (current) {
    let retired = await d.tx.slateInstanceConfigSecret.updateMany({
      where: { oid: current.oid, status: 'active' },
      data: {
        status: 'retiring',
        validUntil: new Date(d.now.getTime() + WEBHOOK_SECRET_GRACE_MS),
        rotatedAt: d.now
      }
    });
    if (retired.count !== 1) throw new Error('Instance config secret rotation conflict');
  }
  let secretVersion = (current?.secretVersion ?? 0) + 1;
  let id = getId('secret');
  let versions = activeWebhookEncryptionVersions();
  let encryptedValue = await getWebhookSecretEncryption().encrypt({
    entityId: webhookSecretContexts.config({
      tenantId: d.tenant.id,
      instanceConfigId: d.config.id,
      key: d.key,
      secretVersion,
      ...versions
    }),
    secret: d.plaintext,
    ...versions
  });
  let secret = await d.tx.slateInstanceConfigSecret.create({
    data: {
      ...id,
      instanceConfigOid: d.config.oid,
      tenantOid: d.tenant.oid,
      key: d.key,
      encryptedValue,
      secretVersion,
      ...versions,
      status: 'active',
      validFrom: d.now
    }
  });
  let auditCorrelationId = await appendAudit(d.tx, {
    action: current ? 'secret_rotated' : 'secret_imported',
    tenantOid: d.tenant.oid,
    actor: d.actor,
    metadata: {
      secretClass: 'instance_config',
      secretId: secret.id,
      secretVersion,
      key: d.key
    }
  });
  return { secret, auditCorrelationId };
};

export let slateInstanceConfigSecretMethods = {
  async dualWriteInstanceConfigSecretsInTransaction(d: {
    tx: HubTransaction;
    tenant: Tenant;
    instanceConfigId: string;
    schema: unknown;
    actor: TrustedSecretActor;
    now?: Date;
    forceMarkerCutover?: boolean;
  }) {
    let config = await d.tx.slateInstanceConfig.findFirst({
      where: { id: d.instanceConfigId, tenantOid: d.tenant.oid },
      include: { instance: true }
    });
    if (!config || config.instance.tenantOid !== d.tenant.oid || !isRecord(config.value)) {
      throw new Error('Instance config secret owner binding is invalid');
    }
    let entries = extractInstanceConfigSecretEntries({
      schema: d.schema,
      value: config.value as Record<string, unknown>
    });
    let nextValue = cloneConfigValue(config.value) as Record<string, Prisma.JsonValue>;
    let markerCutover =
      d.forceMarkerCutover === true ||
      env.slates.SLATES_CONFIG_SECRET_MIGRATION_MODE === 'marker_cutover';
    for (let entry of entries) {
      await upsertInstanceConfigSecretInTransaction({
        tx: d.tx,
        tenant: d.tenant,
        config,
        key: entry.key,
        plaintext: entry.plaintext,
        actor: d.actor,
        now: d.now ?? new Date()
      });
      if (markerCutover) {
        setConfigPathValue(nextValue, entry.path, instanceConfigSecretMarker(entry.key));
      }
    }
    if (entries.length > 0 && markerCutover) {
      await d.tx.slateInstanceConfig.update({
        where: { oid: config.oid },
        data: { value: nextValue }
      });
    }
    return { secretCount: entries.length, value: nextValue };
  },

  async applyV2ConfigSecretPatchInTransaction(d: {
    tx: HubTransaction;
    tenant: Tenant;
    config: { oid: bigint; id: string; tenantOid: bigint; value: Prisma.JsonValue };
    fields: Record<
      string,
      {
        visibility: 'plain' | 'secret';
        lifecycle: 'none' | 'projection' | 'reregister' | 'renew';
      }
    >;
    set: Record<string, unknown>;
    remove: readonly string[];
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    if (d.config.tenantOid !== d.tenant.oid || !isRecord(d.config.value)) {
      throw new Error('Instance config secret owner binding is invalid');
    }
    let now = d.now ?? new Date();
    let value = cloneConfigValue(d.config.value) as Record<string, Prisma.JsonValue>;
    for (let [key, plaintext] of Object.entries(d.set)) {
      if (d.fields[key]?.visibility !== 'secret') continue;
      if (typeof plaintext !== 'string' || plaintext.length === 0) {
        throw new Error(`Secret config field ${key} must be a non-empty string`);
      }
      await upsertInstanceConfigSecretInTransaction({
        tx: d.tx,
        tenant: d.tenant,
        config: d.config,
        key,
        plaintext,
        actor: d.actor,
        now
      });
      value[key] = instanceConfigSecretMarker(key);
    }
    for (let key of d.remove) {
      if (d.fields[key]?.visibility !== 'secret') continue;
      await d.tx.slateInstanceConfigSecret.updateMany({
        where: {
          instanceConfigOid: d.config.oid,
          tenantOid: d.tenant.oid,
          key,
          status: { in: ['active', 'retiring'] }
        },
        data: { status: 'revoked', revokedAt: now, validUntil: now }
      });
      delete value[key];
    }
    let active = await d.tx.slateInstanceConfigSecret.findMany({
      where: {
        instanceConfigOid: d.config.oid,
        tenantOid: d.tenant.oid,
        status: 'active'
      },
      select: { key: true, secretVersion: true }
    });
    return {
      value,
      secretVersionBindings: Object.fromEntries(
        active.map(secret => [secret.key, secret.secretVersion])
      ) as Record<string, number>
    };
  },

  async projectInstanceConfigSecretsToReceiversInTransaction(d: {
    tx: HubTransaction;
    tenant: Tenant;
    instanceOid: bigint;
    config: { oid: bigint; id: string; tenantOid: bigint; generation: number };
    expectedGeneration: number;
    configKeys: readonly string[];
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    if (d.config.tenantOid !== d.tenant.oid) {
      throw new Error('Instance config projection owner binding is invalid');
    }
    let owner = await d.tx.slateInstanceConfig.findFirst({
      where: {
        oid: d.config.oid,
        tenantOid: d.tenant.oid,
        instanceOid: d.instanceOid,
        generation: d.expectedGeneration
      },
      select: { id: true }
    });
    if (!owner) throw new Error('Instance config projection generation CAS conflict');
    let keys = new Set(d.configKeys);
    if (keys.size === 0) return { projected: 0, revoked: 0 };
    let triggers = await d.tx.slateTriggerReceiverTrigger.findMany({
      where: { receiver: { slateInstanceOid: d.instanceOid, tenantOid: d.tenant.oid } },
      include: {
        action: true,
        receiver: {
          select: {
            oid: true,
            id: true,
            slateInstanceOid: true,
            slateInstance: { select: { id: true } }
          }
        }
      }
    });
    let now = d.now ?? new Date();
    let projected = 0;
    let revoked = 0;
    for (let trigger of triggers) {
      let actionContract = trigger.action.spec as Record<string, unknown>;
      let specHash = actionContract.specHash;
      if (typeof specHash !== 'string' || !/^[a-f0-9]{64}$/.test(specHash)) {
        throw new Error('Published trigger action spec hash is missing or invalid');
      }
      for (let ref of collectDeclaredConfigSecretRefs(actionContract)) {
        if (!ref.configKey || !keys.has(ref.configKey)) continue;
        let sourceBindingId = `${d.config.id}:${ref.configKey}`;
        let current = await d.tx.slateTriggerReceiverSecret.findFirst({
          where: {
            receiverTriggerOid: trigger.oid,
            specHash,
            name: ref.name,
            status: 'active'
          },
          orderBy: { secretVersion: 'desc' }
        });
        if (
          current &&
          (current.sourceBindingType !== 'provider_config' ||
            current.sourceBindingId !== sourceBindingId)
        ) {
          throw new Error('Cross-binding trigger secret projection denied');
        }
        let source = await this.resolveInstanceConfigSecretRecordInTransaction({
          tx: d.tx,
          tenant: d.tenant,
          config: d.config,
          key: ref.configKey,
          now
        });
        let active = source.find(item => item.secret.status === 'active');
        if (!active) {
          if (current) {
            let result = await d.tx.slateTriggerReceiverSecret.updateMany({
              where: { oid: current.oid, status: 'active' },
              data: { status: 'revoked', revokedAt: now, validUntil: now }
            });
            if (result.count !== 1) throw new Error('Trigger projection revoke CAS conflict');
            await appendAudit(d.tx, {
              action: 'secret_revoked',
              tenantOid: d.tenant.oid,
              receiverOid: trigger.receiver.oid,
              actor: d.actor,
              metadata: {
                secretClass: 'trigger_verification',
                secretId: current.id,
                secretVersion: current.secretVersion
              }
            });
            revoked += 1;
          }
          continue;
        }
        if (current) {
          let result = await d.tx.slateTriggerReceiverSecret.updateMany({
            where: { oid: current.oid, status: 'active' },
            data: {
              status: 'retiring',
              rotatedAt: now,
              validUntil: new Date(now.getTime() + WEBHOOK_SECRET_GRACE_MS)
            }
          });
          if (result.count !== 1) throw new Error('Trigger projection rotate CAS conflict');
        }
        let secretVersion = (current?.secretVersion ?? 0) + 1;
        let versions = activeWebhookEncryptionVersions();
        let encryptedValue = await getWebhookSecretEncryption().encrypt({
          entityId: webhookSecretContexts.trigger({
            tenantId: d.tenant.id,
            slateInstanceId: trigger.receiver.slateInstance.id,
            receiverId: trigger.receiver.id,
            receiverTriggerId: trigger.id,
            specHash,
            sourceBindingType: 'provider_config',
            sourceBindingId,
            name: ref.name,
            kind: 'config',
            encoding: ref.encoding,
            secretVersion,
            ...versions
          }),
          secret: active.plaintext,
          ...versions
        });
        let created = await d.tx.slateTriggerReceiverSecret.create({
          data: {
            ...getId('secret'),
            tenantOid: d.tenant.oid,
            slateInstanceOid: d.instanceOid,
            receiverOid: trigger.receiver.oid,
            receiverTriggerOid: trigger.oid,
            specHash,
            sourceBindingType: 'provider_config',
            sourceBindingId,
            name: ref.name,
            kind: 'config',
            encoding: ref.encoding,
            encryptedValue,
            secretVersion,
            ...versions,
            status: 'active',
            validFrom: now
          }
        });
        await appendAudit(d.tx, {
          action: current ? 'secret_rotated' : 'secret_projected',
          tenantOid: d.tenant.oid,
          receiverOid: trigger.receiver.oid,
          actor: d.actor,
          metadata: {
            secretClass: 'trigger_verification',
            secretId: created.id,
            secretVersion
          }
        });
        projected += 1;
      }
    }
    return { projected, revoked };
  },

  async importDeclaredInstanceConfigSecret(d: {
    tenant: Tenant;
    instanceConfigId: string;
    key: string;
    plaintext: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let config = await tx.slateInstanceConfig.findFirst({
        where: { id: d.instanceConfigId, tenantOid: d.tenant.oid },
        include: { instance: true, schema: true }
      });
      if (!config || config.instance.tenantOid !== d.tenant.oid) {
        throw new Error('Instance config secret owner binding is invalid');
      }
      let prepared = prepareDeclaredInstanceConfigSecretImport({
        schema: config.schema.schema,
        value: config.value,
        key: d.key,
        plaintext: d.plaintext,
        markerCutover: env.slates.SLATES_CONFIG_SECRET_MIGRATION_MODE === 'marker_cutover'
      });
      let result = await upsertInstanceConfigSecretInTransaction({
        tx,
        tenant: d.tenant,
        config,
        key: prepared.key,
        plaintext: d.plaintext,
        actor: d.actor,
        now
      });
      await tx.slateInstanceConfig.update({
        where: { oid: config.oid },
        data: { value: prepared.value }
      });
      return {
        secret: result.secret,
        marker: prepared.marker,
        auditCorrelationId: result.auditCorrelationId
      };
    });
  },

  async upsertInstanceConfigSecret(d: {
    tenant: Tenant;
    instanceConfigId: string;
    key: string;
    plaintext: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let config = await tx.slateInstanceConfig.findFirst({
        where: { id: d.instanceConfigId, tenantOid: d.tenant.oid },
        include: { instance: true }
      });
      if (!config || config.instance.tenantOid !== d.tenant.oid) {
        throw new Error('Instance config secret owner binding is invalid');
      }
      let result = await upsertInstanceConfigSecretInTransaction({
        tx,
        tenant: d.tenant,
        config,
        key: d.key,
        plaintext: d.plaintext,
        actor: d.actor,
        now
      });
      if (env.slates.SLATES_CONFIG_SECRET_MIGRATION_MODE === 'marker_cutover') {
        let value =
          typeof config.value === 'object' &&
          config.value !== null &&
          !Array.isArray(config.value)
            ? (cloneConfigValue(config.value) as Record<string, Prisma.JsonValue>)
            : {};
        value[d.key] = instanceConfigSecretMarker(d.key);
        await tx.slateInstanceConfig.update({
          where: { oid: config.oid },
          data: { value }
        });
      }
      return {
        secret: result.secret,
        marker: instanceConfigSecretMarker(d.key),
        auditCorrelationId: result.auditCorrelationId
      };
    });
  },

  async materializeInstanceConfig(d: {
    tenant: Tenant;
    instanceConfigId: string;
    value: unknown;
    now?: Date;
  }) {
    if (typeof d.value !== 'object' || d.value === null || Array.isArray(d.value)) return {};
    let config = await db.slateInstanceConfig.findFirst({
      where: { id: d.instanceConfigId, tenantOid: d.tenant.oid },
      include: { schema: true, secrets: true }
    });
    if (!config) throw new Error('Instance config secret owner not found');
    return await this.materializeInstanceConfigRecordInTransaction({
      tx: db,
      tenant: d.tenant,
      config,
      schema: config.schema.schema,
      value: d.value,
      now: d.now
    });
  },

  async materializeInstanceConfigRecordInTransaction(d: {
    tx: HubTransaction;
    tenant: Tenant;
    config: {
      oid: bigint;
      id: string;
      tenantOid: bigint;
      secrets: {
        oid: bigint;
        id: string;
        instanceConfigOid: bigint;
        tenantOid: bigint;
        key: string;
        encryptedValue: string;
        secretVersion: number;
        encryptionKeyVersion: number;
        aadVersion: number;
        status: string;
        validFrom: Date;
        validUntil: Date | null;
        createdAt: Date;
        rotatedAt: Date | null;
        revokedAt: Date | null;
      }[];
    };
    schema: unknown;
    value: unknown;
    now?: Date;
  }) {
    if (typeof d.value !== 'object' || d.value === null || Array.isArray(d.value)) return {};
    if (d.config.tenantOid !== d.tenant.oid) {
      throw new Error('Instance config secret owner binding is invalid');
    }
    let materialized = cloneConfigValue(d.value) as Record<string, unknown>;
    for (let [key, path] of collectInstanceConfigSecretPaths(d.schema, materialized)) {
      let value = getConfigPathValue(materialized, path);
      if (isInstanceConfigSecretMarker(value) && value.key !== key) {
        throw new Error('Instance config secret marker binding mismatch');
      }
      let encryptedRows = d.config.secrets.filter(secret => secret.key === key);
      if (encryptedRows.length === 0) {
        if (isInstanceConfigSecretMarker(value)) {
          throw new Error('Instance config marker has no encrypted secret row');
        }
        hubSecretMigrationMetrics.instanceConfigLegacyFallbacks += 1;
        continue;
      }
      let resolved = await this.resolveInstanceConfigSecretRecordInTransaction({
        tx: d.tx,
        tenant: d.tenant,
        config: d.config,
        key,
        now: d.now
      });
      let active = resolved.find(item => item.secret.status === 'active');
      if (!active) throw new Error('Instance config encrypted secret state is not readable');
      setConfigPathValue(materialized, path, active.plaintext);
    }
    return materialized;
  },

  async resolveInstanceConfigSecret(d: {
    tenant: Tenant;
    instanceConfigId: string;
    key: string;
    now?: Date;
  }) {
    let config = await db.slateInstanceConfig.findFirst({
      where: { id: d.instanceConfigId, tenantOid: d.tenant.oid }
    });
    if (!config) throw new Error('Instance config secret owner not found');
    return await this.resolveInstanceConfigSecretRecordInTransaction({
      tx: db,
      tenant: d.tenant,
      config,
      key: d.key,
      now: d.now
    });
  },

  async resolveInstanceConfigSecretRecordInTransaction(d: {
    tx: HubTransaction;
    tenant: Tenant;
    config: { oid: bigint; id: string; tenantOid: bigint };
    key: string;
    now?: Date;
  }) {
    if (d.config.tenantOid !== d.tenant.oid) {
      throw new Error('Instance config secret owner binding is invalid');
    }
    let now = d.now ?? new Date();
    let rows = await d.tx.slateInstanceConfigSecret.findMany({
      where: {
        instanceConfigOid: d.config.oid,
        tenantOid: d.tenant.oid,
        key: d.key,
        status: { in: ['active', 'retiring'] },
        validFrom: { lte: now },
        OR: [{ status: 'active' }, { status: 'retiring', validUntil: { gt: now } }]
      },
      orderBy: { secretVersion: 'desc' }
    });
    return await Promise.all(
      rows.map(async secret => ({
        secret,
        plaintext: await getWebhookSecretEncryption().decrypt({
          entityId: webhookSecretContexts.config({
            tenantId: d.tenant.id,
            instanceConfigId: d.config.id,
            key: secret.key,
            secretVersion: secret.secretVersion,
            encryptionKeyVersion: secret.encryptionKeyVersion,
            aadVersion: secret.aadVersion
          }),
          encrypted: secret.encryptedValue,
          encryptionKeyVersion: secret.encryptionKeyVersion,
          aadVersion: secret.aadVersion
        })
      }))
    );
  },

  async revokeInstanceConfigSecret(d: {
    tenant: Tenant;
    instanceConfigId: string;
    key: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    return await db.$transaction(async tx => {
      let config = await tx.slateInstanceConfig.findFirst({
        where: { id: d.instanceConfigId, tenantOid: d.tenant.oid }
      });
      if (!config) throw new Error('Instance config secret owner not found');
      let revoked = await tx.slateInstanceConfigSecret.updateMany({
        where: {
          instanceConfigOid: config.oid,
          tenantOid: d.tenant.oid,
          key: d.key,
          status: { in: ['active', 'retiring'] }
        },
        data: { status: 'revoked', revokedAt: d.now ?? new Date() }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_revoked',
        tenantOid: d.tenant.oid,
        actor: d.actor,
        metadata: {
          secretClass: 'instance_config',
          secretId: config.id,
          key: d.key,
          revokedCount: revoked.count
        }
      });
      return { revokedCount: revoked.count, auditCorrelationId };
    });
  },

  async reencryptInstanceConfigSecret(d: {
    tenant: Tenant;
    instanceConfigId: string;
    secretId: string;
    actor: TrustedSecretActor;
  }) {
    return await db.$transaction(async tx => {
      let config = await tx.slateInstanceConfig.findFirst({
        where: { id: d.instanceConfigId, tenantOid: d.tenant.oid }
      });
      if (!config) throw new Error('Instance config secret owner not found');
      let secret = await tx.slateInstanceConfigSecret.findFirst({
        where: { id: d.secretId, instanceConfigOid: config.oid, tenantOid: d.tenant.oid }
      });
      if (!secret) throw new Error('Instance config secret not found');
      let context = (encryptionKeyVersion: number, aadVersion: number) =>
        webhookSecretContexts.config({
          tenantId: d.tenant.id,
          instanceConfigId: config.id,
          key: secret.key,
          secretVersion: secret.secretVersion,
          encryptionKeyVersion,
          aadVersion
        });
      let plaintext = await getWebhookSecretEncryption().decrypt({
        entityId: context(secret.encryptionKeyVersion, secret.aadVersion),
        encrypted: secret.encryptedValue,
        encryptionKeyVersion: secret.encryptionKeyVersion,
        aadVersion: secret.aadVersion
      });
      let nextVersions = activeWebhookEncryptionVersions();
      let encryptedValue = await getWebhookSecretEncryption().encrypt({
        entityId: context(nextVersions.encryptionKeyVersion, nextVersions.aadVersion),
        secret: plaintext,
        ...nextVersions
      });
      return await commitHubSecretReencryptionInTransaction({
        tx,
        actor: d.actor,
        tenantOid: d.tenant.oid,
        metadata: {
          secretClass: 'instance_config',
          secretId: secret.id,
          secretVersion: secret.secretVersion,
          key: secret.key
        },
        mutate: async () =>
          await tx.slateInstanceConfigSecret.update({
            where: { oid: secret.oid },
            data: { encryptedValue, ...nextVersions }
          })
      });
    });
  }
};
