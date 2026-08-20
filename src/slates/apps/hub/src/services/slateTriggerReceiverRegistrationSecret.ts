import { Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import type { AcceptedWebhookVerificationBindings } from '../lib/invocation/types';
import type {
  AcceptedWebhookBootstrapCaptureOutput,
  AuthoritativeWebhookRegistration,
  AuthoritativeWebhookResolution
} from './slateTriggerReceiverCore';
import {
  appendAudit,
  commitHubSecretReencryptionInTransaction,
  type TrustedSecretActor
} from './slateTriggerSecretAudit';
import {
  findDeclaredRegistrationSecret,
  isRecord,
  type HubTransaction
} from './slateTriggerSecretBinding';
import {
  activeWebhookEncryptionVersions,
  getWebhookSecretEncryption,
  WEBHOOK_SECRET_GRACE_MS,
  webhookSecretContexts
} from './slateTriggerSecretCrypto';

let persistCapturedRegistrationSecretsInTransaction = async (d: {
  tx: HubTransaction;
  authority: AuthoritativeWebhookRegistration | AuthoritativeWebhookResolution;
  capturedSecrets: Record<string, { value: string; version: number }>;
  actor: TrustedSecretActor;
  now: Date;
}) => {
  let trigger = await d.tx.slateTriggerReceiverTrigger.findUnique({
    where: { id: d.authority.receiverTrigger.id },
    include: {
      action: true,
      receiver: { include: { tenant: true, slateInstance: true } }
    }
  });
  let publishedSpec = trigger?.action.spec as unknown;
  if (
    !trigger ||
    trigger.receiver.id !== d.authority.receiverTrigger.receiver.id ||
    trigger.receiver.tenant.id !== d.authority.receiverTrigger.receiver.tenant.id ||
    trigger.receiver.slateInstance.id !==
      d.authority.receiverTrigger.receiver.slateInstance.id ||
    trigger.action.key !== d.authority.actionId ||
    trigger.registrationGeneration !== d.authority.registrationGeneration ||
    trigger.registrationVersion !== d.authority.registrationVersion ||
    !isRecord(publishedSpec) ||
    publishedSpec.specHash !== d.authority.specHash
  ) {
    throw new Error('Webhook capture owner binding is stale');
  }
  let declaredNames = (
    'capturedSecretVersions' in d.authority
      ? Object.keys(d.authority.capturedSecretVersions)
      : (d.authority.rule.verify.allowedBootstrapCaptureRefs ?? [])
  ).sort();
  let capturedNames = Object.keys(d.capturedSecrets).sort();
  if (
    declaredNames.length !== capturedNames.length ||
    declaredNames.some((name, index) => name !== capturedNames[index])
  ) {
    throw new Error('Webhook capture set does not exactly match the action declaration');
  }
  await d.tx.slateTriggerReceiverSecret.updateMany({
    where: {
      receiverTriggerOid: trigger.oid,
      status: 'retiring',
      validUntil: { lte: d.now }
    },
    data: { status: 'revoked', revokedAt: d.now }
  });
  for (let [name, captured] of Object.entries(d.capturedSecrets)) {
    let declared = findDeclaredRegistrationSecret(d.authority.actionContract, name);
    if (!declared) throw new Error('Webhook capture secret is not declared by the action');
    let expectedVersion =
      'capturedSecretVersions' in d.authority
        ? d.authority.capturedSecretVersions[name]
        : d.authority.projectedSecretVersions[name];
    if (expectedVersion !== captured.version) {
      throw new Error('Webhook capture secret version is stale');
    }
    let current = await d.tx.slateTriggerReceiverSecret.findFirst({
      where: {
        receiverTriggerOid: trigger.oid,
        specHash: d.authority.specHash,
        name,
        status: 'active'
      },
      orderBy: { secretVersion: 'desc' }
    });
    if (current && current.secretVersion === captured.version) {
      let currentPlaintext = await getWebhookSecretEncryption().decrypt({
        entityId: webhookSecretContexts.trigger({
          tenantId: trigger.receiver.tenant.id,
          slateInstanceId: trigger.receiver.slateInstance.id,
          receiverId: trigger.receiver.id,
          receiverTriggerId: trigger.id,
          specHash: d.authority.specHash,
          sourceBindingType: current.sourceBindingType,
          sourceBindingId: current.sourceBindingId,
          name: current.name,
          kind: current.kind,
          encoding: current.encoding,
          secretVersion: current.secretVersion,
          encryptionKeyVersion: current.encryptionKeyVersion,
          aadVersion: current.aadVersion
        }),
        encrypted: current.encryptedValue,
        encryptionKeyVersion: current.encryptionKeyVersion,
        aadVersion: current.aadVersion
      });
      if (currentPlaintext !== captured.value) {
        throw new Error('Webhook capture cannot overwrite an equal secret version');
      }
      continue;
    }
    if (current && current.secretVersion > captured.version) {
      throw new Error('Webhook capture cannot overwrite an equal or newer secret version');
    }
    if (current) {
      let retired = await d.tx.slateTriggerReceiverSecret.updateMany({
        where: { oid: current.oid, status: 'active' },
        data: {
          status: 'retiring',
          validUntil: new Date(d.now.getTime() + WEBHOOK_SECRET_GRACE_MS),
          rotatedAt: d.now
        }
      });
      if (retired.count !== 1) throw new Error('Webhook capture secret CAS conflict');
    }
    let id = getId('secret');
    let sourceBindingId = `${trigger.id}:${d.authority.registrationGeneration}`;
    let versions = activeWebhookEncryptionVersions();
    let encryptedValue = await getWebhookSecretEncryption().encrypt({
      entityId: webhookSecretContexts.trigger({
        tenantId: trigger.receiver.tenant.id,
        slateInstanceId: trigger.receiver.slateInstance.id,
        receiverId: trigger.receiver.id,
        receiverTriggerId: trigger.id,
        specHash: d.authority.specHash,
        sourceBindingType: 'registration',
        sourceBindingId,
        name,
        kind: 'registration',
        encoding: declared.encoding,
        secretVersion: captured.version,
        ...versions
      }),
      secret: captured.value,
      ...versions
    });
    let secret = await d.tx.slateTriggerReceiverSecret.create({
      data: {
        ...id,
        tenantOid: trigger.receiver.tenantOid,
        slateInstanceOid: trigger.receiver.slateInstanceOid,
        receiverOid: trigger.receiver.oid,
        receiverTriggerOid: trigger.oid,
        specHash: d.authority.specHash,
        sourceBindingType: 'registration',
        sourceBindingId,
        name,
        kind: 'registration',
        encoding: declared.encoding,
        encryptedValue,
        secretVersion: captured.version,
        ...versions,
        status: 'active',
        validFrom: d.now
      }
    });
    await appendAudit(d.tx, {
      action: current ? 'secret_rotated' : 'secret_imported',
      tenantOid: trigger.receiver.tenantOid,
      receiverOid: trigger.receiver.oid,
      actor: d.actor,
      metadata: {
        secretClass: 'trigger_verification',
        secretId: secret.id,
        secretVersion: secret.secretVersion,
        name
      }
    });
  }
  return trigger;
};

export let slateTriggerReceiverRegistrationSecretMethods = {
  async dualWriteRegistrationDetailsInTransaction(d: {
    tx: HubTransaction;
    receiverTriggerId: string;
    registrationDetails: unknown;
    state?: unknown;
    claim?: {
      registrationGeneration: number;
      registrationTransitionVersion: number;
      registrationLeaseToken: string;
      status: 'registering' | 'renewing' | 'unregistering';
    };
    expectedAuthority?: {
      registrationGeneration: number;
      registrationVersion: number;
      registrationStatuses: readonly ('registered' | 'renewing')[];
    };
    now?: Date;
    failureInjection?: { afterEncryptedWrite?: () => Promise<void> };
  }) {
    let now = d.now ?? new Date();
    let ownershipWhere = d.claim
      ? {
          registrationGeneration: d.claim.registrationGeneration,
          registrationTransitionVersion: d.claim.registrationTransitionVersion,
          registrationStatus: d.claim.status,
          registrationLeaseToken: d.claim.registrationLeaseToken,
          registrationLeaseExpiresAt: { gt: now }
        }
      : d.expectedAuthority
        ? {
            registrationGeneration: d.expectedAuthority.registrationGeneration,
            registrationVersion: d.expectedAuthority.registrationVersion,
            registrationStatus: { in: [...d.expectedAuthority.registrationStatuses] }
          }
        : {};
    let trigger = await d.tx.slateTriggerReceiverTrigger.findFirstOrThrow({
      where: { id: d.receiverTriggerId, ...ownershipWhere },
      include: { receiver: { include: { tenant: true, slateInstance: true } } }
    });
    let versions = activeWebhookEncryptionVersions();
    let encryptedRegistrationDetails = await getWebhookSecretEncryption().encrypt({
      entityId: webhookSecretContexts.registration({
        tenantId: trigger.receiver.tenant.id,
        slateInstanceId: trigger.receiver.slateInstance.id,
        receiverId: trigger.receiver.id,
        receiverTriggerId: trigger.id,
        registrationGeneration: trigger.registrationGeneration,
        ...versions
      }),
      secret: JSON.stringify(d.registrationDetails ?? null),
      ...versions
    });
    let encryptedWrite = await d.tx.slateTriggerReceiverTrigger.updateMany({
      where: { oid: trigger.oid, ...ownershipWhere },
      data: {
        encryptedRegistrationDetails,
        registrationDetailsEncryptionKeyVersion: versions.encryptionKeyVersion,
        registrationDetailsAadVersion: versions.aadVersion,
        registrationDetailsGeneration: trigger.registrationGeneration
      }
    });
    if (encryptedWrite.count !== 1) throw new Error('Registration details CAS conflict');
    await d.failureInjection?.afterEncryptedWrite?.();
    let legacyWrite = await d.tx.slateTriggerReceiverTrigger.updateMany({
      where: { oid: trigger.oid, ...ownershipWhere },
      data: {
        registrationDetails: (d.registrationDetails ?? null) as Prisma.InputJsonValue,
        ...(d.state !== undefined ? { state: d.state as Prisma.InputJsonValue } : {})
      }
    });
    if (legacyWrite.count !== 1) throw new Error('Registration details CAS conflict');
    return trigger;
  },

  async commitRegistrationResult(d: {
    claim: {
      receiverTriggerId: string;
      registrationGeneration: number;
      registrationTransitionVersion: number;
      registrationLeaseToken: string;
      status: 'registering' | 'renewing' | 'unregistering';
    };
    authority?: AuthoritativeWebhookRegistration;
    registrationDetails: unknown;
    remoteRegistrationKnown: boolean;
    state?: unknown;
    capturedSecrets?: Record<string, { value: string; version: number }>;
    telegramAuthority?: {
      receiverOid: bigint;
      token: string;
      mutationVersion: number;
      generation: number;
      refCount: number;
      allowedUpdates: string[];
      webhookUrl: string;
      secretFingerprint: string;
    };
    now?: Date;
  }): Promise<'committed' | 'stale'> {
    let now = d.now ?? new Date();
    if (d.claim.status === 'unregistering') {
      throw new Error('Unregister claims cannot commit registration results');
    }
    return await db.$transaction(async tx => {
      let owned = await tx.slateTriggerReceiverTrigger.findFirst({
        where: {
          id: d.claim.receiverTriggerId,
          registrationGeneration: d.claim.registrationGeneration,
          registrationTransitionVersion: d.claim.registrationTransitionVersion,
          registrationStatus: d.claim.status,
          registrationLeaseToken: d.claim.registrationLeaseToken,
          registrationLeaseExpiresAt: { gt: now }
        }
      });
      if (!owned) return 'stale' as const;
      if (d.telegramAuthority) {
        let telegramCommitted = await tx.slateTriggerReceiver.updateMany({
          where: {
            oid: d.telegramAuthority.receiverOid,
            telegramWebhookLeaseToken: d.telegramAuthority.token,
            telegramWebhookMutationVersion: d.telegramAuthority.mutationVersion
          },
          data: {
            telegramWebhookGeneration: d.telegramAuthority.generation,
            telegramWebhookRemoteKnown: d.remoteRegistrationKnown,
            telegramWebhookRefCount: d.telegramAuthority.refCount,
            telegramWebhookAllowedUpdates: d.telegramAuthority.allowedUpdates,
            telegramWebhookUrl: d.telegramAuthority.webhookUrl,
            telegramWebhookSecretFingerprint: d.telegramAuthority.secretFingerprint,
            telegramWebhookLeaseToken: null,
            telegramWebhookLeaseExpiresAt: null
          }
        });
        if (telegramCommitted.count !== 1) return 'stale' as const;
      }
      if (d.telegramAuthority) {
        if (!d.authority || !d.capturedSecrets) {
          throw new Error('Telegram registration requires captured secret authority');
        }
        let telegramSecret = d.capturedSecrets.telegram_secret_token;
        if (
          Object.keys(d.capturedSecrets).length !== 1 ||
          !telegramSecret ||
          telegramSecret.version !== d.telegramAuthority.generation
        ) {
          throw new Error('Telegram registration secret generation is invalid');
        }
        let siblings = await tx.slateTriggerReceiverTrigger.findMany({
          where: {
            receiverOid: d.telegramAuthority.receiverOid,
            source: 'webhook',
            tombstonedAt: null,
            registrationStatus: { notIn: ['unregistering', 'unregistered'] }
          },
          include: { action: true },
          orderBy: { id: 'asc' }
        });
        if (!siblings.some(trigger => trigger.id === d.claim.receiverTriggerId)) {
          throw new Error('Telegram registration owner is not an active receiver trigger');
        }
        for (let sibling of siblings) {
          let actionContract = sibling.action.spec as unknown;
          if (!isRecord(actionContract) || typeof actionContract.specHash !== 'string') {
            throw new Error('Telegram sibling action spec hash is invalid');
          }
          let siblingAuthority = {
            ...d.authority,
            receiverTrigger: {
              ...d.authority.receiverTrigger,
              ...sibling,
              receiver: d.authority.receiverTrigger.receiver
            },
            actionId: sibling.action.key,
            actionContract,
            specHash: actionContract.specHash,
            registrationStatus: sibling.registrationStatus,
            registrationGeneration: sibling.registrationGeneration,
            registrationVersion: sibling.registrationVersion,
            capturedSecretVersions: {
              telegram_secret_token: d.telegramAuthority.generation
            }
          } as AuthoritativeWebhookRegistration;
          await persistCapturedRegistrationSecretsInTransaction({
            tx,
            authority: siblingAuthority,
            capturedSecrets: d.capturedSecrets,
            actor: {
              actorId: 'provider_webhook_registration',
              requestId: `telegram-registration:${d.telegramAuthority.receiverOid}:${d.telegramAuthority.generation}`
            },
            now
          });
          let versions = activeWebhookEncryptionVersions();
          let encryptedRegistrationDetails = await getWebhookSecretEncryption().encrypt({
            entityId: webhookSecretContexts.registration({
              tenantId: d.authority.receiverTrigger.receiver.tenant.id,
              slateInstanceId: d.authority.receiverTrigger.receiver.slateInstance.id,
              receiverId: d.authority.receiverTrigger.receiver.id,
              receiverTriggerId: sibling.id,
              registrationGeneration: sibling.registrationGeneration,
              ...versions
            }),
            secret: JSON.stringify(d.registrationDetails ?? null),
            ...versions
          });
          let projected = await tx.slateTriggerReceiverTrigger.updateMany({
            where: {
              oid: sibling.oid,
              registrationGeneration: sibling.registrationGeneration,
              registrationVersion: sibling.registrationVersion,
              tombstonedAt: null,
              registrationStatus: { notIn: ['unregistering', 'unregistered'] }
            },
            data: {
              encryptedRegistrationDetails,
              registrationDetailsEncryptionKeyVersion: versions.encryptionKeyVersion,
              registrationDetailsAadVersion: versions.aadVersion,
              registrationDetailsGeneration: sibling.registrationGeneration,
              registrationDetails: (d.registrationDetails ?? null) as Prisma.InputJsonValue,
              ...(sibling.id === d.claim.receiverTriggerId && d.state !== undefined
                ? { state: d.state as Prisma.InputJsonValue }
                : {}),
              remoteRegistrationKnown: d.remoteRegistrationKnown,
              authoritativeStateVersion: { increment: 1 }
            }
          });
          if (projected.count !== 1) {
            throw new Error('Telegram sibling registration projection CAS conflict');
          }
        }
      } else if (d.capturedSecrets && Object.keys(d.capturedSecrets).length > 0) {
        if (!d.authority) throw new Error('Captured registration secrets require authority');
        await persistCapturedRegistrationSecretsInTransaction({
          tx,
          authority: d.authority,
          capturedSecrets: d.capturedSecrets,
          actor: {
            actorId: 'provider_webhook_registration',
            requestId: `registration:${d.claim.receiverTriggerId}:${d.claim.registrationGeneration}`
          },
          now
        });
      }
      if (!d.telegramAuthority) {
        await this.dualWriteRegistrationDetailsInTransaction({
          tx,
          receiverTriggerId: d.claim.receiverTriggerId,
          registrationDetails: d.registrationDetails,
          state: d.state,
          claim: d.claim,
          now
        });
      }
      let completed = await tx.slateTriggerReceiverTrigger.updateMany({
        where: {
          id: d.claim.receiverTriggerId,
          registrationGeneration: d.claim.registrationGeneration,
          registrationTransitionVersion: d.claim.registrationTransitionVersion,
          registrationStatus: d.claim.status,
          registrationLeaseToken: d.claim.registrationLeaseToken,
          registrationLeaseExpiresAt: { gt: now }
        },
        data: {
          registrationStatus: 'registered',
          remoteRegistrationKnown: d.remoteRegistrationKnown,
          registrationLeaseToken: null,
          registrationLeaseExpiresAt: null,
          registrationEnqueueDeadlineAt: null,
          registrationErrorCode: null,
          registrationErrorMessage: null,
          registrationErrorMetadata: Prisma.DbNull,
          registrationErrorAt: null,
          authoritativeStateVersion: { increment: 1 }
        }
      });
      if (completed.count !== 1) {
        throw new Error('Registration success CAS invariant failed');
      }
      return 'committed' as const;
    });
  },

  async persistRegistrationCapture(d: {
    authority: AuthoritativeWebhookRegistration;
    registrationDetails: unknown;
    state: unknown;
    capturedSecrets: Record<string, { value: string; version: number }>;
  }): Promise<'committed' | 'conflict'> {
    try {
      return await db.$transaction(async tx => {
        let claimed = await tx.slateTriggerReceiverTrigger.updateMany({
          where: {
            oid: d.authority.receiverTrigger.oid,
            id: d.authority.receiverTrigger.id,
            updatedAt: d.authority.receiverTrigger.updatedAt
          },
          data: { updatedAt: new Date() }
        });
        if (claimed.count !== 1) return 'conflict' as const;
        await persistCapturedRegistrationSecretsInTransaction({
          tx,
          authority: d.authority,
          capturedSecrets: d.capturedSecrets,
          actor: {
            actorId: 'provider_webhook_registration',
            requestId: `registration:${d.authority.receiverTrigger.id}`
          },
          now: new Date()
        });
        await this.dualWriteRegistrationDetailsInTransaction({
          tx,
          receiverTriggerId: d.authority.receiverTrigger.id,
          registrationDetails: d.registrationDetails,
          state: d.state
        });
        return 'committed' as const;
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('CAS conflict')) return 'conflict';
      throw error;
    }
  },

  async compareAndSetBootstrapCapture(d: {
    authority: AuthoritativeWebhookResolution;
    proof: AcceptedWebhookVerificationBindings;
    output: AcceptedWebhookBootstrapCaptureOutput;
  }) {
    return await db.$transaction(async tx => {
      let current = await tx.slateTriggerReceiverTrigger.findUnique({
        where: { id: d.authority.receiverTrigger.id },
        include: { receiver: { include: { tenant: true, slateInstance: true } } }
      });
      if (!current) return { status: 'conflict' as const };
      let state = isRecord(current.state) ? current.state : {};
      let prior = state.__metorialWebhookBootstrapV1;
      if (isRecord(prior)) {
        if (
          prior.originalRequestHash !== d.proof.originalRequestHash ||
          prior.registrationVersion !== d.authority.registrationVersion
        ) {
          return { status: 'conflict' as const };
        }
        return {
          status: 'duplicate' as const,
          committed: {
            response: prior.response,
            registrationVersion: prior.registrationVersion as number,
            ...(prior.replayClaim !== undefined
              ? {
                  replayClaim:
                    prior.replayClaim as AcceptedWebhookBootstrapCaptureOutput['replayClaim']
                }
              : {})
          }
        };
      }
      let claimed = await tx.slateTriggerReceiverTrigger.updateMany({
        where: {
          oid: d.authority.receiverTrigger.oid,
          updatedAt: d.authority.receiverTrigger.updatedAt
        },
        data: { updatedAt: new Date() }
      });
      if (claimed.count !== 1) return { status: 'conflict' as const };
      await persistCapturedRegistrationSecretsInTransaction({
        tx,
        authority: d.authority,
        capturedSecrets: d.output.capturedSecrets,
        actor: {
          actorId: 'provider_webhook_bootstrap',
          requestId: d.proof.requestId
        },
        now: new Date()
      });
      await tx.slateTriggerReceiverTrigger.update({
        where: { oid: current.oid },
        data: {
          state: {
            ...state,
            __metorialWebhookBootstrapV1: {
              originalRequestHash: d.proof.originalRequestHash,
              registrationVersion: d.authority.registrationVersion,
              response: d.output.response,
              ...(d.output.replayClaim ? { replayClaim: d.output.replayClaim } : {})
            }
          } as Prisma.InputJsonValue,
          ...(isRecord(d.authority.actionContract.invocation) &&
          isRecord(d.authority.actionContract.invocation.http) &&
          isRecord(d.authority.actionContract.invocation.http.registration) &&
          d.authority.actionContract.invocation.http.registration.mode === 'manual_bootstrap'
            ? {
                registrationStatus: 'registered' as const,
                remoteRegistrationKnown: false,
                registrationLeaseToken: null,
                registrationLeaseExpiresAt: null,
                registrationEnqueueDeadlineAt: null,
                registrationErrorCode: null,
                registrationErrorMessage: null,
                registrationErrorMetadata: Prisma.DbNull,
                registrationErrorAt: null,
                authoritativeStateVersion: { increment: 1 }
              }
            : {})
        }
      });
      return {
        status: 'committed' as const,
        committed: {
          response: d.output.response,
          registrationVersion: d.authority.registrationVersion,
          ...(d.output.replayClaim ? { replayClaim: d.output.replayClaim } : {})
        }
      };
    });
  },

  async resolveRegistrationDetails(d: { receiverTriggerId: string }) {
    return await this.resolveRegistrationDetailsInTransaction({
      tx: db as unknown as HubTransaction,
      ...d
    });
  },

  async cleanupRetiringRegistrationDetails(d: {
    receiverTriggerId: string;
    registrationGeneration: number;
    registrationVersion: number;
    registrationDetails: unknown;
    now?: Date;
  }): Promise<'committed' | 'stale'> {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let expectedAuthority = {
        registrationGeneration: d.registrationGeneration,
        registrationVersion: d.registrationVersion,
        registrationStatuses: ['registered', 'renewing'] as const
      };
      let current = await tx.slateTriggerReceiverTrigger.findFirst({
        where: {
          id: d.receiverTriggerId,
          tombstonedAt: null,
          remoteRegistrationKnown: true,
          registrationGeneration: d.registrationGeneration,
          registrationVersion: d.registrationVersion,
          registrationStatus: { in: [...expectedAuthority.registrationStatuses] }
        }
      });
      if (!current) return 'stale' as const;
      await this.dualWriteRegistrationDetailsInTransaction({
        tx,
        receiverTriggerId: d.receiverTriggerId,
        registrationDetails: d.registrationDetails,
        expectedAuthority,
        now
      });
      let committed = await tx.slateTriggerReceiverTrigger.updateMany({
        where: {
          oid: current.oid,
          registrationGeneration: d.registrationGeneration,
          registrationVersion: d.registrationVersion,
          registrationStatus: { in: [...expectedAuthority.registrationStatuses] }
        },
        data: { authoritativeStateVersion: { increment: 1 } }
      });
      if (committed.count !== 1) throw new Error('Retiring registration cleanup CAS conflict');
      return 'committed' as const;
    });
  },

  async resolveRegistrationDetailsInTransaction(d: {
    tx: HubTransaction;
    receiverTriggerId: string;
  }) {
    let trigger = await d.tx.slateTriggerReceiverTrigger.findUniqueOrThrow({
      where: { id: d.receiverTriggerId },
      include: { receiver: { include: { tenant: true, slateInstance: true } } }
    });
    if (
      trigger.encryptedRegistrationDetails &&
      trigger.registrationDetailsEncryptionKeyVersion !== null &&
      trigger.registrationDetailsAadVersion !== null
    ) {
      let plaintext = await getWebhookSecretEncryption().decrypt({
        entityId: webhookSecretContexts.registration({
          tenantId: trigger.receiver.tenant.id,
          slateInstanceId: trigger.receiver.slateInstance.id,
          receiverId: trigger.receiver.id,
          receiverTriggerId: trigger.id,
          registrationGeneration:
            trigger.registrationDetailsGeneration ?? trigger.registrationGeneration,
          encryptionKeyVersion: trigger.registrationDetailsEncryptionKeyVersion,
          aadVersion: trigger.registrationDetailsAadVersion
        }),
        encrypted: trigger.encryptedRegistrationDetails,
        encryptionKeyVersion: trigger.registrationDetailsEncryptionKeyVersion,
        aadVersion: trigger.registrationDetailsAadVersion
      });
      return JSON.parse(plaintext);
    }
    throw new Error('Encrypted registration details are unavailable');
  },

  async revokeRegistrationSecrets(d: { receiverTriggerId: string; now?: Date }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let trigger = await tx.slateTriggerReceiverTrigger.findUniqueOrThrow({
        where: { id: d.receiverTriggerId }
      });
      return await tx.slateTriggerReceiverSecret.updateMany({
        where: {
          receiverTriggerOid: trigger.oid,
          sourceBindingType: 'registration',
          status: { in: ['active', 'retiring'] }
        },
        data: { status: 'revoked', revokedAt: now, validUntil: now }
      });
    });
  },

  async cleanupExpiredRegistrationSecrets(d: { now?: Date } = {}) {
    let now = d.now ?? new Date();
    return await db.slateTriggerReceiverSecret.updateMany({
      where: {
        sourceBindingType: 'registration',
        status: 'retiring',
        validUntil: { lte: now }
      },
      data: { status: 'revoked', revokedAt: now }
    });
  },

  async reencryptRegistrationDetails(d: {
    receiverTriggerId: string;
    actor: TrustedSecretActor;
  }) {
    return await db.$transaction(async tx => {
      let trigger = await tx.slateTriggerReceiverTrigger.findUniqueOrThrow({
        where: { id: d.receiverTriggerId },
        include: { receiver: { include: { tenant: true, slateInstance: true } } }
      });
      if (
        !trigger.encryptedRegistrationDetails ||
        trigger.registrationDetailsEncryptionKeyVersion === null ||
        trigger.registrationDetailsAadVersion === null
      ) {
        throw new Error('Encrypted registration details are unavailable');
      }
      let plaintext = await getWebhookSecretEncryption().decrypt({
        entityId: webhookSecretContexts.registration({
          tenantId: trigger.receiver.tenant.id,
          slateInstanceId: trigger.receiver.slateInstance.id,
          receiverId: trigger.receiver.id,
          receiverTriggerId: trigger.id,
          registrationGeneration:
            trigger.registrationDetailsGeneration ?? trigger.registrationGeneration,
          encryptionKeyVersion: trigger.registrationDetailsEncryptionKeyVersion,
          aadVersion: trigger.registrationDetailsAadVersion
        }),
        encrypted: trigger.encryptedRegistrationDetails,
        encryptionKeyVersion: trigger.registrationDetailsEncryptionKeyVersion,
        aadVersion: trigger.registrationDetailsAadVersion
      });
      let nextVersions = activeWebhookEncryptionVersions();
      let encryptedRegistrationDetails = await getWebhookSecretEncryption().encrypt({
        entityId: webhookSecretContexts.registration({
          tenantId: trigger.receiver.tenant.id,
          slateInstanceId: trigger.receiver.slateInstance.id,
          receiverId: trigger.receiver.id,
          receiverTriggerId: trigger.id,
          registrationGeneration: trigger.registrationGeneration,
          ...nextVersions
        }),
        secret: plaintext,
        ...nextVersions
      });
      return await commitHubSecretReencryptionInTransaction({
        tx,
        actor: d.actor,
        tenantOid: trigger.receiver.tenant.oid,
        receiverOid: trigger.receiver.oid,
        metadata: {
          secretClass: 'registration_details',
          secretId: trigger.id,
          registrationGeneration: trigger.registrationGeneration
        },
        mutate: async () =>
          await tx.slateTriggerReceiverTrigger.update({
            where: { oid: trigger.oid },
            data: {
              encryptedRegistrationDetails,
              registrationDetailsEncryptionKeyVersion: nextVersions.encryptionKeyVersion,
              registrationDetailsAadVersion: nextVersions.aadVersion,
              registrationDetailsGeneration: trigger.registrationGeneration
            }
          })
      });
    });
  }
};
