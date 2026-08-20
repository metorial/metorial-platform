import { randomBytes } from 'node:crypto';
import { db } from '../db';
import { encryption } from '../encryption';
import { getId } from '../id';
import {
  appendAudit,
  commitHubSecretReencryptionInTransaction,
  issueReceipt,
  type TrustedSecretActor
} from './slateTriggerSecretAudit';
import {
  activeWebhookEncryptionVersions,
  getWebhookSecretEncryption,
  sha256,
  WEBHOOK_SECRET_GRACE_MS,
  webhookSecretContexts
} from './slateTriggerSecretCrypto';
import { resolveProvisionedRouteAuthority } from './slateTriggerProvisionedRouteAuthority';

export let slateTriggerAppRouteSecretMethods = {
  async createOrRotateAppRouteSecret(d: {
    provisionedRouteId: string;
    routeGeneration: number;
    vendor: string;
    credentialOwnerRef: string;
    purpose: 'app_route_path' | 'vendor_verification';
    importedValue?: string;
    actor: TrustedSecretActor;
    graceMs?: number;
    now?: Date;
  }) {
    if (
      !d.provisionedRouteId ||
      !d.vendor ||
      !d.credentialOwnerRef ||
      !Number.isInteger(d.routeGeneration) ||
      d.routeGeneration < 1
    ) {
      throw new Error('App route secret owner binding is invalid');
    }
    if (d.purpose === 'vendor_verification' && !d.importedValue) {
      throw new Error('Vendor verification material must be imported from its bound source');
    }
    if (d.purpose === 'app_route_path' && d.importedValue !== undefined) {
      throw new Error('App route path material must be generated');
    }
    let now = d.now ?? new Date();
    let authority = await resolveProvisionedRouteAuthority({
      provisionedRouteId: d.provisionedRouteId,
      purpose: d.purpose,
      now
    });
    if (
      authority.routeGeneration !== d.routeGeneration ||
      authority.vendor !== d.vendor ||
      authority.credentialOwnerRef !== d.credentialOwnerRef
    ) {
      throw new Error('Caller route binding does not match authoritative route generation');
    }
    let plaintext =
      d.purpose === 'app_route_path'
        ? `metorial_approute_${randomBytes(32).toString('base64url')}`
        : d.importedValue!;
    return await db.$transaction(async tx => {
      let current = await tx.slateProvisionedAppRouteSecret.findFirst({
        where: {
          provisionedRouteId: d.provisionedRouteId,
          routeGeneration: d.routeGeneration,
          purpose: d.purpose,
          status: 'active'
        },
        orderBy: { secretVersion: 'desc' }
      });
      if (
        current &&
        (current.vendor !== d.vendor || current.credentialOwnerRef !== d.credentialOwnerRef)
      ) {
        throw new Error('Cross-binding app route secret update denied');
      }
      if (current) {
        let retired = await tx.slateProvisionedAppRouteSecret.updateMany({
          where: { oid: current.oid, status: 'active' },
          data: {
            status: 'retiring',
            validUntil: new Date(now.getTime() + (d.graceMs ?? WEBHOOK_SECRET_GRACE_MS)),
            rotatedAt: now
          }
        });
        if (retired.count !== 1) throw new Error('App route secret rotation conflict');
      }
      let secretVersion = (current?.secretVersion ?? 0) + 1;
      if (secretVersion !== authority.secretVersion) {
        throw new Error('Projected app route secret version is not the next semantic version');
      }
      let id = { ...getId('secret'), id: authority.secretId };
      let versions = activeWebhookEncryptionVersions();
      let encryptedValue = await getWebhookSecretEncryption().encrypt({
        entityId: webhookSecretContexts.appRoute({
          provisionedRouteId: d.provisionedRouteId,
          routeGeneration: d.routeGeneration,
          vendor: d.vendor,
          credentialOwnerRef: d.credentialOwnerRef,
          purpose: d.purpose,
          secretVersion,
          ...versions
        }),
        secret: plaintext,
        ...versions
      });
      let secret = await tx.slateProvisionedAppRouteSecret.create({
        data: {
          ...id,
          provisionedRouteId: d.provisionedRouteId,
          routeGeneration: d.routeGeneration,
          vendor: d.vendor,
          credentialOwnerRef: d.credentialOwnerRef,
          purpose: d.purpose,
          encryptedValue,
          secretVersion,
          ...versions,
          status: 'active',
          validFrom: now
        }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: current
          ? 'secret_rotated'
          : d.purpose === 'app_route_path'
            ? 'secret_created'
            : 'secret_imported',
        provisionedRouteId: d.provisionedRouteId,
        actor: d.actor,
        metadata: { secretClass: d.purpose, secretId: secret.id, secretVersion }
      });
      let receipt =
        d.purpose === 'app_route_path'
          ? await issueReceipt(tx, {
              provisionedRouteId: d.provisionedRouteId,
              secretClass: 'app_route_path',
              secretId: secret.id,
              plaintext,
              actor: d.actor,
              auditCorrelationId,
              now
            })
          : undefined;
      return { secret, receipt, auditCorrelationId };
    });
  },

  async resolveAppRouteSecret(d: {
    provisionedRouteId: string;
    routeGeneration: number;
    purpose: 'app_route_path' | 'vendor_verification';
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    let authority = await resolveProvisionedRouteAuthority({
      provisionedRouteId: d.provisionedRouteId,
      purpose: d.purpose,
      now
    });
    if (authority.routeGeneration !== d.routeGeneration) {
      throw new Error('Requested route generation is not authoritative');
    }
    let rows = await db.slateProvisionedAppRouteSecret.findMany({
      where: {
        provisionedRouteId: d.provisionedRouteId,
        routeGeneration: d.routeGeneration,
        purpose: d.purpose,
        vendor: authority.vendor,
        credentialOwnerRef: authority.credentialOwnerRef,
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
          entityId: webhookSecretContexts.appRoute({
            provisionedRouteId: secret.provisionedRouteId,
            routeGeneration: secret.routeGeneration,
            vendor: secret.vendor,
            credentialOwnerRef: secret.credentialOwnerRef,
            purpose: secret.purpose as 'app_route_path' | 'vendor_verification',
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

  async revokeAppRouteSecret(d: {
    provisionedRouteId: string;
    routeGeneration: number;
    purpose: 'app_route_path' | 'vendor_verification';
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    let authority = await resolveProvisionedRouteAuthority({
      provisionedRouteId: d.provisionedRouteId,
      purpose: d.purpose,
      now
    });
    if (authority.routeGeneration !== d.routeGeneration) {
      throw new Error('Requested route generation is not authoritative');
    }
    return await db.$transaction(async tx => {
      let rows = await tx.slateProvisionedAppRouteSecret.findMany({
        where: {
          provisionedRouteId: d.provisionedRouteId,
          routeGeneration: d.routeGeneration,
          purpose: d.purpose,
          vendor: authority.vendor,
          credentialOwnerRef: authority.credentialOwnerRef,
          status: { in: ['active', 'retiring'] }
        }
      });
      if (!rows.length) throw new Error('App route secret not found');
      await tx.slateProvisionedAppRouteSecret.updateMany({
        where: { oid: { in: rows.map(row => row.oid) } },
        data: { status: 'revoked', revokedAt: now }
      });
      let auditCorrelationId = await appendAudit(tx, {
        action: 'secret_revoked',
        provisionedRouteId: d.provisionedRouteId,
        actor: d.actor,
        metadata: { secretClass: d.purpose, secretId: rows[0]!.id }
      });
      return { auditCorrelationId };
    });
  },

  async reencryptAppRouteSecret(d: {
    provisionedRouteId: string;
    purpose: 'app_route_path' | 'vendor_verification';
    secretId: string;
    actor: TrustedSecretActor;
  }) {
    let now = new Date();
    let authority = await resolveProvisionedRouteAuthority({
      provisionedRouteId: d.provisionedRouteId,
      purpose: d.purpose,
      now
    });
    return await db.$transaction(async tx => {
      let secret = await tx.slateProvisionedAppRouteSecret.findFirst({
        where: {
          id: d.secretId,
          provisionedRouteId: authority.provisionedRouteId,
          routeGeneration: authority.routeGeneration,
          vendor: authority.vendor,
          credentialOwnerRef: authority.credentialOwnerRef,
          purpose: authority.purpose
        }
      });
      if (!secret) throw new Error('Authoritative app route secret not found');
      let context = (encryptionKeyVersion: number, aadVersion: number) =>
        webhookSecretContexts.appRoute({
          provisionedRouteId: secret.provisionedRouteId,
          routeGeneration: secret.routeGeneration,
          vendor: secret.vendor,
          credentialOwnerRef: secret.credentialOwnerRef,
          purpose: secret.purpose as 'app_route_path' | 'vendor_verification',
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
        provisionedRouteId: authority.provisionedRouteId,
        metadata: {
          secretClass: secret.purpose,
          secretId: secret.id,
          secretVersion: secret.secretVersion
        },
        mutate: async () =>
          await tx.slateProvisionedAppRouteSecret.update({
            where: { oid: secret.oid },
            data: { encryptedValue, ...nextVersions }
          })
      });
    });
  },

  async consumeAppRouteReceipt(d: {
    provisionedRouteId: string;
    receiptId: string;
    token: string;
    actor: TrustedSecretActor;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    try {
      return await db.$transaction(async tx => {
        let receipt = await tx.secretIssuanceReceipt.findFirst({
          where: {
            id: d.receiptId,
            tokenHash: sha256(d.token),
            provisionedRouteId: d.provisionedRouteId,
            secretClass: 'app_route_path'
          }
        });
        if (!receipt || receipt.status !== 'issued' || receipt.expiresAt <= now) {
          throw new Error('Secret issuance receipt is invalid, expired, or consumed');
        }
        let referencedSecret = await tx.slateProvisionedAppRouteSecret.findFirst({
          where: {
            id: receipt.secretId,
            provisionedRouteId: d.provisionedRouteId,
            purpose: 'app_route_path',
            status: 'active',
            validFrom: { lte: now }
          }
        });
        if (referencedSecret) {
          let authority = await resolveProvisionedRouteAuthority({
            provisionedRouteId: referencedSecret.provisionedRouteId,
            purpose: 'app_route_path',
            now
          });
          if (
            authority.routeGeneration !== referencedSecret.routeGeneration ||
            authority.vendor !== referencedSecret.vendor ||
            authority.credentialOwnerRef !== referencedSecret.credentialOwnerRef
          ) {
            throw new Error('Receipt route binding is no longer authoritative');
          }
        }
        let current = await tx.slateProvisionedAppRouteSecret.findFirst({
          where: {
            provisionedRouteId: d.provisionedRouteId,
            purpose: 'app_route_path',
            status: 'active',
            validFrom: { lte: now }
          },
          orderBy: [{ routeGeneration: 'desc' }, { secretVersion: 'desc' }]
        });
        if (!referencedSecret || current?.oid !== referencedSecret.oid) {
          throw new Error('Receipt no longer references the current active route secret');
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
          provisionedRouteId: d.provisionedRouteId,
          actor: d.actor,
          metadata: { secretClass: receipt.secretClass, secretId: receipt.secretId }
        });
        return { plaintext, auditCorrelationId };
      });
    } catch (error) {
      await db.$transaction(async tx => {
        await appendAudit(tx, {
          action: 'secret_issuance_receipt_denied',
          provisionedRouteId: d.provisionedRouteId,
          actor: d.actor,
          metadata: { secretClass: 'app_route_path', secretId: d.receiptId }
        });
      });
      throw error;
    }
  }
};
