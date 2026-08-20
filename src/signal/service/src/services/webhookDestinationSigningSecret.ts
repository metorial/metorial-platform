import {
  Encryption,
  parseSupportedEncryptionAadVersions,
  VersionedEncryptionKeyring
} from '@lowerdeck/encryption';
import { Service } from '@lowerdeck/service';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  Prisma,
  Tenant,
  WebhookMethod,
  WebhookDestinationSigningSecret,
  WebhookDestinationWebhook
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';

export let SIGNAL_SIGNING_SECRET_PURPOSE = 'webhook_signing';
export let SIGNAL_SIGNING_SECRET_AAD_VERSION = 1;
export let SIGNAL_SIGNING_SECRET_KEY_VERSION = 1;
export let SIGNAL_SIGNING_SECRET_GRACE_MS = 24 * 60 * 60 * 1000;
export let SIGNAL_SECRET_RECEIPT_TTL_MS = 10 * 60 * 1000;

export let signalSecretMigrationMetrics = {
  legacyFallbacks: 0
};

let getEncryptionKeyring = () => {
  let key = env.encryption.ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV === 'test') key = 'signal-test-encryption-key';
  if (!key) throw new Error('Signal encrypted signing secrets require ENCRYPTION_KEY');
  let keys: Record<number, string> = { 1: key };
  if (env.encryption.ENCRYPTION_KEYRING_JSON) {
    let parsed = JSON.parse(env.encryption.ENCRYPTION_KEYRING_JSON) as Record<string, unknown>;
    for (let [version, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') throw new Error('Signal encryption keyring is invalid');
      keys[Number(version)] = value;
    }
  }
  let activeAadVersion = env.encryption.ENCRYPTION_ACTIVE_AAD_VERSION ?? 1;
  return new VersionedEncryptionKeyring({
    keys,
    activeKeyVersion: env.encryption.ENCRYPTION_ACTIVE_KEY_VERSION ?? 1,
    supportedAadVersions: parseSupportedEncryptionAadVersions({
      configured: env.encryption.ENCRYPTION_SUPPORTED_AAD_VERSIONS,
      activeAadVersion
    })
  });
};

let getReceiptEncryption = () => {
  let key = env.encryption.ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV === 'test') key = 'signal-test-encryption-key';
  if (!key) throw new Error('Signal encrypted signing secrets require ENCRYPTION_KEY');
  return new Encryption(key);
};
let activeEncryptionVersions = () => ({
  encryptionKeyVersion:
    env.encryption.ENCRYPTION_ACTIVE_KEY_VERSION ?? SIGNAL_SIGNING_SECRET_KEY_VERSION,
  aadVersion: env.encryption.ENCRYPTION_ACTIVE_AAD_VERSION ?? SIGNAL_SIGNING_SECRET_AAD_VERSION
});

let closedContext = (kind: string, values: readonly (string | number)[]) =>
  ['metorial', 'signal', 'signing-secret', kind, ...values.map(String)]
    .map(value => `${Buffer.byteLength(value, 'utf8')}:${value}`)
    .join('|');

let signalAadGrammar = {
  1: (values: readonly (string | number)[]) => closedContext('destination/v1', values),
  2: (values: readonly (string | number)[]) =>
    closedContext('destination/v2', ['aad-v2', ...values])
} satisfies Record<number, (values: readonly (string | number)[]) => string>;

/** Closed AAD v1: authoritative tenant ID, webhook entity ID, exact purpose,
 * semantic secret version, encryption-key version, and AAD version. */
export let signalSigningSecretContext = (d: {
  tenantId: string;
  webhookId: string;
  purpose: string;
  secretVersion: number;
  encryptionKeyVersion: number;
  aadVersion: number;
}) => {
  let grammar = signalAadGrammar[d.aadVersion as keyof typeof signalAadGrammar];
  if (!grammar) throw new Error(`Unsupported Signal signing AAD grammar: ${d.aadVersion}`);
  return grammar([
    d.tenantId,
    d.webhookId,
    d.purpose,
    d.secretVersion,
    d.encryptionKeyVersion,
    d.aadVersion
  ]);
};

let receiptContext = (receiptId: string, secretId: string) =>
  closedContext('receipt/v1', [receiptId, secretId]);
let sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
type SignalTransaction = Prisma.TransactionClient;

let encryptSecret = async (
  plaintext: string,
  d: {
    tenantId: string;
    webhookId: string;
    purpose: string;
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }
) =>
  await getEncryptionKeyring().encrypt({
    entityId: signalSigningSecretContext(d),
    secret: plaintext,
    encryptionKeyVersion: d.encryptionKeyVersion,
    aadVersion: d.aadVersion
  });

let decryptSecret = async (
  secret: WebhookDestinationSigningSecret,
  d: { tenantId: string; webhookId: string }
) =>
  await getEncryptionKeyring().decrypt({
    entityId: signalSigningSecretContext({
      ...d,
      purpose: secret.purpose,
      secretVersion: secret.secretVersion,
      encryptionKeyVersion: secret.encryptionKeyVersion,
      aadVersion: secret.aadVersion
    }),
    encrypted: secret.encryptedValue,
    encryptionKeyVersion: secret.encryptionKeyVersion,
    aadVersion: secret.aadVersion
  });

let appendAudit = async (
  tx: SignalTransaction,
  d: {
    tenantOid: bigint;
    webhookOid: bigint;
    action:
      | 'secret_created'
      | 'secret_imported'
      | 'secret_rotated'
      | 'secret_revoked'
      | 'secret_issuance_receipt_issued'
      | 'secret_issuance_receipt_consumed'
      | 'secret_issuance_receipt_denied';
    metadata: Record<string, string | number | null>;
    auditCorrelationId?: string;
  }
) => {
  let id = getId('eventDestinationWebhook');
  let auditCorrelationId = d.auditCorrelationId ?? randomUUID();
  await tx.webhookSecretAuditRecord.create({
    data: {
      ...id,
      auditCorrelationId,
      tenantOid: d.tenantOid,
      webhookDestinationWebhookOid: d.webhookOid,
      action: d.action,
      metadata: d.metadata
    }
  });
  return auditCorrelationId;
};

let issueReceipt = async (
  tx: SignalTransaction,
  d: {
    tenantOid: bigint;
    webhookOid: bigint;
    secretId: string;
    plaintext: string;
    auditCorrelationId: string;
    now: Date;
  }
) => {
  let id = getId('eventDestinationWebhook');
  let token = `sgrcpt_${randomBytes(32).toString('base64url')}`;
  let encryptedMaterial = await getReceiptEncryption().encrypt({
    entityId: receiptContext(id.id, d.secretId),
    secret: d.plaintext
  });
  let expiresAt = new Date(d.now.getTime() + SIGNAL_SECRET_RECEIPT_TTL_MS);
  await tx.webhookSecretIssuanceReceipt.create({
    data: {
      ...id,
      tokenHash: sha256(token),
      tenantOid: d.tenantOid,
      webhookDestinationWebhookOid: d.webhookOid,
      secretId: d.secretId,
      encryptedMaterial,
      expiresAt
    }
  });
  await appendAudit(tx, {
    tenantOid: d.tenantOid,
    webhookOid: d.webhookOid,
    action: 'secret_issuance_receipt_issued',
    auditCorrelationId: d.auditCorrelationId,
    metadata: { secretClass: 'signal_signing', secretId: d.secretId }
  });
  return { id: id.id, token, expiresAt };
};

class webhookDestinationSigningSecretServiceImpl {
  private generate() {
    return `metorial_whsec_${randomBytes(38).toString('base64url')}`;
  }

  private async createInitialInTransaction(d: {
    tx: SignalTransaction;
    tenant: Tenant;
    webhook: WebhookDestinationWebhook;
    plaintext: string;
    provenance: 'generated' | 'imported';
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    let existing = await d.tx.webhookDestinationSigningSecret.findFirst({
      where: {
        webhookDestinationWebhookOid: d.webhook.oid,
        purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
        status: 'active'
      }
    });
    if (existing) throw new Error('Webhook already has an active signing secret');
    if (d.webhook.tenantOid !== d.tenant.oid)
      throw new Error('Signing secret tenant mismatch');
    let id = getId('eventDestinationWebhook');
    let versions = activeEncryptionVersions();
    let encryptedValue = await encryptSecret(d.plaintext, {
      tenantId: d.tenant.id,
      webhookId: d.webhook.id,
      purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
      secretVersion: 1,
      ...versions
    });
    let secret = await d.tx.webhookDestinationSigningSecret.create({
      data: {
        ...id,
        webhookDestinationWebhookOid: d.webhook.oid,
        tenantOid: d.tenant.oid,
        purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
        encryptedValue,
        secretVersion: 1,
        ...versions,
        status: 'active',
        validFrom: now
      }
    });
    let auditCorrelationId = await appendAudit(d.tx, {
      tenantOid: d.tenant.oid,
      webhookOid: d.webhook.oid,
      action: d.provenance === 'imported' ? 'secret_imported' : 'secret_created',
      metadata: { secretClass: 'signal_signing', secretId: secret.id, secretVersion: 1 }
    });
    let receipt =
      d.provenance === 'generated'
        ? await issueReceipt(d.tx, {
            tenantOid: d.tenant.oid,
            webhookOid: d.webhook.oid,
            secretId: secret.id,
            plaintext: d.plaintext,
            auditCorrelationId,
            now
          })
        : undefined;
    return { secret, receipt, auditCorrelationId };
  }

  async createGeneratedWebhookInTransaction(d: {
    tx: SignalTransaction;
    tenant: Tenant;
    url: string;
    method: WebhookMethod;
    now?: Date;
    failureInjection?: { afterLegacyWrite?: () => Promise<void> };
  }) {
    let plaintext = this.generate();
    let webhook = await d.tx.webhookDestinationWebhook.create({
      data: {
        ...getId('eventDestinationWebhook'),
        url: d.url,
        method: d.method,
        signingSecret: plaintext,
        tenantOid: d.tenant.oid
      }
    });
    await d.failureInjection?.afterLegacyWrite?.();
    let result = await this.createInitialInTransaction({
      tx: d.tx,
      tenant: d.tenant,
      webhook,
      plaintext,
      provenance: 'generated',
      now: d.now
    });
    return { webhook, ...result };
  }

  async createImportedInitialInTransaction(d: {
    tx: SignalTransaction;
    tenant: Tenant;
    webhook: WebhookDestinationWebhook;
    plaintext: string;
    now?: Date;
  }) {
    return await this.createInitialInTransaction({ ...d, provenance: 'imported' });
  }

  async reconcileImportedLegacyInTransaction(d: {
    tx: SignalTransaction;
    tenant: Tenant;
    webhook: WebhookDestinationWebhook;
    plaintext: string;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    if (d.webhook.tenantOid !== d.tenant.oid) {
      throw new Error('Signing secret tenant mismatch');
    }
    let current = await d.tx.webhookDestinationSigningSecret.findFirst({
      where: {
        webhookDestinationWebhookOid: d.webhook.oid,
        purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
        status: 'active'
      },
      orderBy: { secretVersion: 'desc' }
    });
    if (!current) return await this.createImportedInitialInTransaction(d);
    let currentPlaintext = await decryptSecret(current, {
      tenantId: d.tenant.id,
      webhookId: d.webhook.id
    });
    if (currentPlaintext === d.plaintext) return { secret: current, auditCorrelationId: null };
    let retired = await d.tx.webhookDestinationSigningSecret.updateMany({
      where: { oid: current.oid, status: 'active' },
      data: {
        status: 'retiring',
        validUntil: new Date(now.getTime() + SIGNAL_SIGNING_SECRET_GRACE_MS),
        rotatedAt: now
      }
    });
    if (retired.count !== 1) throw new Error('Webhook signing secret reconciliation conflict');
    let secretVersion = current.secretVersion + 1;
    let versions = activeEncryptionVersions();
    let id = getId('eventDestinationWebhook');
    let encryptedValue = await encryptSecret(d.plaintext, {
      tenantId: d.tenant.id,
      webhookId: d.webhook.id,
      purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
      secretVersion,
      ...versions
    });
    let secret = await d.tx.webhookDestinationSigningSecret.create({
      data: {
        ...id,
        webhookDestinationWebhookOid: d.webhook.oid,
        tenantOid: d.tenant.oid,
        purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
        encryptedValue,
        secretVersion,
        ...versions,
        status: 'active',
        validFrom: now
      }
    });
    let auditCorrelationId = await appendAudit(d.tx, {
      tenantOid: d.tenant.oid,
      webhookOid: d.webhook.oid,
      action: 'secret_rotated',
      metadata: { secretClass: 'signal_signing', secretId: secret.id, secretVersion }
    });
    return { secret, auditCorrelationId };
  }

  async resolveActiveAndRetiring(d: {
    tenantOid: bigint;
    webhookOid: bigint;
    signingTimestampSeconds?: number;
  }) {
    return await this.resolveActiveAndRetiringInTransaction({
      tx: db as unknown as SignalTransaction,
      ...d
    });
  }

  async resolveActiveAndRetiringInTransaction(d: {
    tx: SignalTransaction;
    tenantOid: bigint;
    webhookOid: bigint;
    signingTimestampSeconds?: number;
  }) {
    let signingTimestampSeconds = d.signingTimestampSeconds ?? Math.floor(Date.now() / 1000);
    let at = new Date(signingTimestampSeconds * 1000);
    let webhook = await d.tx.webhookDestinationWebhook.findFirst({
      where: { oid: d.webhookOid, tenantOid: d.tenantOid },
      include: { tenant: true }
    });
    if (!webhook) throw new Error('Webhook signing secret owner not found');
    let allRows = await d.tx.webhookDestinationSigningSecret.findMany({
      where: {
        webhookDestinationWebhookOid: webhook.oid,
        tenantOid: webhook.tenantOid,
        purpose: SIGNAL_SIGNING_SECRET_PURPOSE
      },
      orderBy: { secretVersion: 'desc' }
    });
    if (allRows.length === 0) {
      signalSecretMigrationMetrics.legacyFallbacks += 1;
      return [
        {
          secret: null,
          plaintext: webhook.signingSecret,
          status: 'active' as const,
          secretVersion: 0,
          legacyFallback: true
        }
      ];
    }
    let rows = allRows.filter(
      secret =>
        secret.validFrom <= at &&
        (secret.status === 'active' ||
          (secret.status === 'retiring' &&
            secret.validUntil !== null &&
            secret.validUntil > at))
    );
    if (!rows.some(secret => secret.status === 'active')) {
      throw new Error('Webhook encrypted signing secret state is not readable');
    }
    let resolved = await Promise.all(
      rows.map(async secret => {
        if (secret.status === 'revoked') throw new Error('Revoked signing secret selected');
        if (secret.status === 'retiring' && (!secret.validUntil || secret.validUntil <= at)) {
          throw new Error('Expired retiring signing secret selected');
        }
        return {
          secret,
          plaintext: await decryptSecret(secret, {
            tenantId: webhook.tenant.id,
            webhookId: webhook.id
          }),
          status: secret.status as 'active' | 'retiring',
          secretVersion: secret.secretVersion,
          legacyFallback: false
        };
      })
    );
    return resolved.sort((a, b) => {
      if (a.status === b.status) return b.secretVersion - a.secretVersion;
      return a.status === 'active' ? -1 : 1;
    });
  }

  async rotate(d: { tenant: Tenant; webhookId: string; graceMs?: number; now?: Date }) {
    let now = d.now ?? new Date();
    let plaintext = this.generate();
    return await db.$transaction(async tx => {
      let webhook = await tx.webhookDestinationWebhook.findFirst({
        where: { id: d.webhookId, tenantOid: d.tenant.oid }
      });
      if (!webhook) throw new Error('Webhook signing secret owner not found');
      let current = await tx.webhookDestinationSigningSecret.findFirst({
        where: {
          webhookDestinationWebhookOid: webhook.oid,
          purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
          status: 'active'
        },
        orderBy: { secretVersion: 'desc' }
      });
      if (!current) {
        let anyEncrypted = await tx.webhookDestinationSigningSecret.findFirst({
          where: {
            webhookDestinationWebhookOid: webhook.oid,
            purpose: SIGNAL_SIGNING_SECRET_PURPOSE
          }
        });
        if (anyEncrypted) throw new Error('Webhook active signing secret not found');
        await this.createInitialInTransaction({
          tx,
          tenant: d.tenant,
          webhook,
          plaintext: webhook.signingSecret,
          provenance: 'imported',
          now
        });
        current = await tx.webhookDestinationSigningSecret.findFirstOrThrow({
          where: {
            webhookDestinationWebhookOid: webhook.oid,
            purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
            status: 'active'
          }
        });
      }
      let validUntil = new Date(now.getTime() + (d.graceMs ?? SIGNAL_SIGNING_SECRET_GRACE_MS));
      let retired = await tx.webhookDestinationSigningSecret.updateMany({
        where: { oid: current.oid, status: 'active' },
        data: { status: 'retiring', validUntil, rotatedAt: now }
      });
      if (retired.count !== 1) throw new Error('Signing secret rotation conflict');
      let secretVersion = current.secretVersion + 1;
      let id = getId('eventDestinationWebhook');
      let versions = activeEncryptionVersions();
      let encryptedValue = await encryptSecret(plaintext, {
        tenantId: d.tenant.id,
        webhookId: webhook.id,
        purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
        secretVersion,
        ...versions
      });
      let secret = await tx.webhookDestinationSigningSecret.create({
        data: {
          ...id,
          webhookDestinationWebhookOid: webhook.oid,
          tenantOid: d.tenant.oid,
          purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
          encryptedValue,
          secretVersion,
          ...versions,
          status: 'active',
          validFrom: now
        }
      });
      await tx.webhookDestinationWebhook.update({
        where: { oid: webhook.oid },
        data: { signingSecret: plaintext }
      });
      let auditCorrelationId = await appendAudit(tx, {
        tenantOid: d.tenant.oid,
        webhookOid: webhook.oid,
        action: 'secret_rotated',
        metadata: { secretClass: 'signal_signing', secretId: secret.id, secretVersion }
      });
      let receipt = await issueReceipt(tx, {
        tenantOid: d.tenant.oid,
        webhookOid: webhook.oid,
        secretId: secret.id,
        plaintext,
        auditCorrelationId,
        now
      });
      return {
        secret,
        receipt,
        graceExpiresAt: validUntil,
        auditCorrelationId
      };
    });
  }

  async revoke(d: { tenant: Tenant; webhookId: string; secretId: string; now?: Date }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let webhook = await tx.webhookDestinationWebhook.findFirst({
        where: { id: d.webhookId, tenantOid: d.tenant.oid }
      });
      if (!webhook) throw new Error('Webhook signing secret owner not found');
      let secret = await tx.webhookDestinationSigningSecret.findFirst({
        where: {
          id: d.secretId,
          webhookDestinationWebhookOid: webhook.oid,
          tenantOid: d.tenant.oid
        }
      });
      if (!secret) throw new Error('Webhook signing secret not found');
      let updated = await tx.webhookDestinationSigningSecret.update({
        where: { oid: secret.oid },
        data: { status: 'revoked', revokedAt: now }
      });
      let auditCorrelationId = await appendAudit(tx, {
        tenantOid: d.tenant.oid,
        webhookOid: webhook.oid,
        action: 'secret_revoked',
        metadata: {
          secretClass: 'signal_signing',
          secretId: secret.id,
          secretVersion: secret.secretVersion
        }
      });
      return { secret: updated, auditCorrelationId };
    });
  }

  async reencrypt(d: { tenant: Tenant; webhookId: string; secretId: string }) {
    return await db.$transaction(async tx => {
      let webhook = await tx.webhookDestinationWebhook.findFirst({
        where: { id: d.webhookId, tenantOid: d.tenant.oid }
      });
      if (!webhook) throw new Error('Webhook signing secret owner not found');
      let secret = await tx.webhookDestinationSigningSecret.findFirstOrThrow({
        where: {
          id: d.secretId,
          webhookDestinationWebhookOid: webhook.oid,
          tenantOid: d.tenant.oid
        }
      });
      let plaintext = await decryptSecret(secret, {
        tenantId: d.tenant.id,
        webhookId: webhook.id
      });
      let nextVersions = activeEncryptionVersions();
      let encryptedValue = await encryptSecret(plaintext, {
        tenantId: d.tenant.id,
        webhookId: webhook.id,
        purpose: secret.purpose,
        secretVersion: secret.secretVersion,
        ...nextVersions
      });
      return await tx.webhookDestinationSigningSecret.update({
        where: { oid: secret.oid },
        data: {
          encryptedValue,
          ...nextVersions
        }
      });
    });
  }

  async consumeReceipt(d: {
    tenant: Tenant;
    webhookId: string;
    receiptId: string;
    token: string;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    try {
      return await db.$transaction(async tx => {
        let webhook = await tx.webhookDestinationWebhook.findFirst({
          where: { id: d.webhookId, tenantOid: d.tenant.oid }
        });
        if (!webhook) throw new Error('Webhook signing secret owner not found');
        let receipt = await tx.webhookSecretIssuanceReceipt.findFirst({
          where: {
            id: d.receiptId,
            tokenHash: sha256(d.token),
            tenantOid: d.tenant.oid,
            webhookDestinationWebhookOid: webhook.oid
          }
        });
        if (!receipt || receipt.status !== 'issued' || receipt.expiresAt <= now)
          throw new Error('Secret receipt is invalid, expired, or consumed');
        let referencedSecret = await tx.webhookDestinationSigningSecret.findFirst({
          where: {
            id: receipt.secretId,
            webhookDestinationWebhookOid: webhook.oid,
            tenantOid: d.tenant.oid,
            purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
            status: 'active',
            validFrom: { lte: now }
          }
        });
        let current = await tx.webhookDestinationSigningSecret.findFirst({
          where: {
            webhookDestinationWebhookOid: webhook.oid,
            tenantOid: d.tenant.oid,
            purpose: SIGNAL_SIGNING_SECRET_PURPOSE,
            status: 'active',
            validFrom: { lte: now }
          },
          orderBy: { secretVersion: 'desc' }
        });
        if (!referencedSecret || current?.oid !== referencedSecret.oid) {
          throw new Error('Secret receipt no longer references the current active secret');
        }
        let consumed = await tx.webhookSecretIssuanceReceipt.updateMany({
          where: { oid: receipt.oid, status: 'issued', expiresAt: { gt: now } },
          data: { status: 'consumed', consumedAt: now }
        });
        if (consumed.count !== 1) throw new Error('Secret receipt already consumed');
        let plaintext = await getReceiptEncryption().decrypt({
          entityId: receiptContext(receipt.id, receipt.secretId),
          encrypted: receipt.encryptedMaterial
        });
        let auditCorrelationId = await appendAudit(tx, {
          tenantOid: d.tenant.oid,
          webhookOid: webhook.oid,
          action: 'secret_issuance_receipt_consumed',
          metadata: { secretClass: 'signal_signing', secretId: receipt.secretId }
        });
        return { plaintext, auditCorrelationId };
      });
    } catch (error) {
      let webhook = await db.webhookDestinationWebhook.findFirst({
        where: { id: d.webhookId, tenantOid: d.tenant.oid }
      });
      if (webhook)
        await db.$transaction(async tx => {
          await appendAudit(tx, {
            tenantOid: d.tenant.oid,
            webhookOid: webhook.oid,
            action: 'secret_issuance_receipt_denied',
            metadata: { secretClass: 'signal_signing', secretId: d.receiptId }
          });
        });
      throw error;
    }
  }
}

export let webhookDestinationSigningSecretService = Service.create(
  'webhookDestinationSigningSecretService',
  () => new webhookDestinationSigningSecretServiceImpl()
).build();
