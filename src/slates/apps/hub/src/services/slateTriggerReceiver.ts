import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  SlateTriggerReceiverTriggerSource,
  type Slate,
  type SlateAuthConfig,
  type SlateCallbackConfig,
  type SlateInstance,
  type SlateInstanceConfig,
  type Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { slateSessionService } from './slateSession';
import { SlateTriggerReceiverCore } from './slateTriggerReceiverCore';
import { SlateTriggerReceiverRuntime } from './slateTriggerReceiverRuntime';
import { slateTriggerReceiverBootstrapCaptureWriter } from './slateTriggerReceiverSecret';
import {
  provisionInitialCallbackReceiverPathSecretInTransaction,
  slateTriggerReceiverPathSecretMethods
} from './slateTriggerReceiverPathSecret';
import { slateTriggerReceiverProductionSecurity } from './slateTriggerReceiverSecurity';
import {
  beginRegistrationIntentInTransaction,
  initialVerificationPolicy,
  recordRegistrationOutboxInTransaction,
  REGISTRATION_ENQUEUE_DEADLINE_MS
} from './slateTriggerRegistrationLifecycle';
import { enqueuePendingRegistrationOutboxes } from './slateTriggerRegistrationOutbox';
import { createSlateTriggerReceiverProductionSecurityAdapters } from './slateTriggerReceiverProductionSecurityAdapters';
import { normalizeEventTypes, receiverInclude } from './slateTriggerReceiverShared';

export let slateTriggerReceiverProductionSecurityAdapters =
  createSlateTriggerReceiverProductionSecurityAdapters({
    bootstrapCaptureWriter: slateTriggerReceiverBootstrapCaptureWriter,
    webhookAuthorityResolver: slateTriggerReceiverProductionSecurity.webhookAuthorityResolver,
    scopedGrantIssuer: slateTriggerReceiverProductionSecurity.scopedGrantIssuer,
    acceptedVerificationProofs:
      slateTriggerReceiverProductionSecurity.acceptedVerificationProofs
  });

const MIN_POLL_INTERVAL_SECONDS = 10 * 60;

type CallbackOwnerAuthority = {
  callbackId: string;
  callbackInstanceId: string;
  expectedReceiverId: string | null;
  expectedOwnerVersion: number;
  mutationId: string;
  mutationDigest: string;
};

let canonicalJson = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  let record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
};

let callbackOwnerMutationDigest = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');

let callbackOwnerConflict = () =>
  new ServiceError(
    badRequestError({
      code: 'callback_owner_conflict',
      message: 'Callback receiver owner authority is stale or does not match.'
    })
  );

let validateCallbackOwnerAuthority = (authority: CallbackOwnerAuthority) => {
  if (
    !Number.isInteger(authority.expectedOwnerVersion) ||
    authority.expectedOwnerVersion < 0 ||
    authority.mutationId.length < 1 ||
    authority.mutationId.length > 200
  ) {
    throw callbackOwnerConflict();
  }
};

let isIdempotentCallbackOwnerMutation = (
  receiver: {
    id: string;
    callbackOwnerVersion: number;
    callbackOwnerMutationId: string | null;
    callbackOwnerMutationDigest: string | null;
  },
  authority: CallbackOwnerAuthority
) => {
  if (receiver.callbackOwnerMutationId !== authority.mutationId) return false;
  if (receiver.callbackOwnerMutationDigest !== authority.mutationDigest) {
    throw callbackOwnerConflict();
  }
  let exactCurrentOwner =
    receiver.id === authority.expectedReceiverId &&
    receiver.callbackOwnerVersion === authority.expectedOwnerVersion;
  let completedAttempt =
    receiver.callbackOwnerVersion === authority.expectedOwnerVersion + 1 &&
    (receiver.id === authority.expectedReceiverId ||
      (authority.expectedReceiverId === null && authority.expectedOwnerVersion === 0));
  if (!exactCurrentOwner && !completedAttempt) throw callbackOwnerConflict();
  return true;
};

export class slateTriggerReceiverServiceImpl {
  private readonly core: SlateTriggerReceiverCore;
  private readonly runtime: SlateTriggerReceiverRuntime;

  constructor() {
    this.core = new SlateTriggerReceiverCore(slateTriggerReceiverProductionSecurityAdapters);
    this.runtime = new SlateTriggerReceiverRuntime(this.core);
  }

  private normalizePollIntervalOverride(value?: number | null) {
    if (value === undefined || value === null) return value;
    if (!Number.isInteger(value) || value < 1) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_poll_interval_override',
          message: 'pollIntervalSeconds must be a positive integer.'
        })
      );
    }

    return value;
  }

  async processTriggerEventInput(
    d: Parameters<SlateTriggerReceiverRuntime['processTriggerEventInput']>[0]
  ) {
    return this.runtime.processTriggerEventInput(d);
  }

  async sendTriggerEvent(d: Parameters<SlateTriggerReceiverRuntime['sendTriggerEvent']>[0]) {
    return this.runtime.sendTriggerEvent(d);
  }

  async registerWebhookForReceiverTrigger(
    d: Parameters<SlateTriggerReceiverRuntime['registerWebhookForReceiverTrigger']>[0]
  ) {
    return this.runtime.registerWebhookForReceiverTrigger(d);
  }

  async registerWebhookForReceiverTriggerId(
    d: Parameters<SlateTriggerReceiverRuntime['registerWebhookForReceiverTriggerId']>[0]
  ) {
    return this.runtime.registerWebhookForReceiverTriggerId(d);
  }

  async unregisterWebhookForReceiverTrigger(
    d: Parameters<SlateTriggerReceiverRuntime['unregisterWebhookForReceiverTrigger']>[0]
  ) {
    return this.runtime.unregisterWebhookForReceiverTrigger(d);
  }

  async unregisterWebhookForReceiverTriggerId(
    d: Parameters<SlateTriggerReceiverRuntime['unregisterWebhookForReceiverTriggerId']>[0]
  ) {
    return this.runtime.unregisterWebhookForReceiverTriggerId(d);
  }

  async cleanupRetiringWebhookRegistration(
    d: Parameters<SlateTriggerReceiverRuntime['cleanupRetiringWebhookRegistration']>[0]
  ) {
    return this.runtime.cleanupRetiringWebhookRegistration(d);
  }

  async pollTriggerReceiverTrigger(
    d: Parameters<SlateTriggerReceiverRuntime['pollTriggerReceiverTrigger']>[0]
  ) {
    return this.runtime.pollTriggerReceiverTrigger(d);
  }

  async handleTriggerWebhook(
    d: Parameters<SlateTriggerReceiverRuntime['handleTriggerWebhook']>[0]
  ) {
    return this.runtime.handleTriggerWebhook(d);
  }

  async handleReceiverWebhook(
    d: Parameters<SlateTriggerReceiverRuntime['handleReceiverWebhook']>[0]
  ) {
    return this.runtime.handleReceiverWebhook(d);
  }

  async handleCapturedTriggerWebhook(
    d: Parameters<SlateTriggerReceiverRuntime['handleCapturedTriggerWebhook']>[0]
  ) {
    return this.runtime.handleCapturedTriggerWebhook(d);
  }

  async handleCapturedReceiverWebhook(
    d: Parameters<SlateTriggerReceiverRuntime['handleCapturedReceiverWebhook']>[0]
  ) {
    return this.runtime.handleCapturedReceiverWebhook(d);
  }

  async handleCapturedSharedAppWebhook(
    d: Parameters<SlateTriggerReceiverRuntime['handleCapturedSharedAppWebhook']>[0]
  ) {
    return this.runtime.handleCapturedSharedAppWebhook(d);
  }

  private validateAuthConfig(d: {
    tenant: Tenant;
    slate: Slate;
    slateInstance: SlateInstance;
    authConfig: SlateAuthConfig | null;
    hasAuthMethods: boolean;
  }) {
    let hasAuthConfig = d.authConfig != null;
    if (!d.hasAuthMethods && hasAuthConfig) {
      throw new ServiceError(
        badRequestError({
          code: 'authentication_not_supported',
          message: 'Provider does not have any authentication methods configured.'
        })
      );
    }
    if (d.hasAuthMethods && !hasAuthConfig) {
      throw new ServiceError(
        badRequestError({
          code: 'authentication_required',
          message: 'Authentication method is required for this provider.'
        })
      );
    }
    if (
      d.authConfig &&
      (d.authConfig.tenantOid !== d.tenant.oid || d.authConfig.slateOid !== d.slate.oid)
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_auth_config',
          message: 'Authentication configuration is not valid for this tenant or provider.'
        })
      );
    }
    if (d.authConfig?.instanceOid && d.authConfig.instanceOid !== d.slateInstance.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'This authentication configuration is not valid for the selected provider.'
        })
      );
    }

    return d.authConfig;
  }

  async createTriggerReceiver(d: {
    tenant: Tenant;
    slateInstance: SlateInstance & {
      slate: Slate;
      currentConfig: SlateInstanceConfig | null;
    };
    authConfig?: SlateAuthConfig | null;
    callbackConfig?: SlateCallbackConfig | null;
    input: {
      name?: string;
      description?: string;
      eventTypes?: string[];
      callbackId?: string | null;
      callbackInstanceId?: string | null;
      callbackOwnerVersion?: number;
      callbackOwnerMutationId?: string | null;
      callbackOwnerMutationDigest?: string | null;
      triggers: {
        triggerId: string;
        eventTypes?: string[];
        state?: Record<string, any> | null;
        pollIntervalSeconds?: number | null;
      }[];
    };
  }) {
    let slateInstance = d.slateInstance;

    if (!slateInstance.currentConfig) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider instance does not have a current configuration set.'
        })
      );
    }

    let slate = slateInstance.slate;
    let version = await slateSessionService.getSessionVersion({ slate, slateInstance });

    let hasAuthMethods = (version.specification?.authMethods ?? []).length > 0;
    let authConfig = this.validateAuthConfig({
      tenant: d.tenant,
      slate,
      slateInstance,
      authConfig: d.authConfig ?? null,
      hasAuthMethods
    });

    let triggerActions = await this.core.resolveActionsForTriggers({
      slate,
      specificationOid: version.specification!.oid,
      triggers: d.input.triggers.map(trigger => ({
        ...trigger,
        pollIntervalSeconds: this.normalizePollIntervalOverride(trigger.pollIntervalSeconds)
      }))
    });

    let { receiver, outboxIds } = await db.$transaction(async prisma => {
      let now = new Date();
      let receiver = await prisma.slateTriggerReceiver.create({
        data: {
          ...getId('slateTriggerReceiver'),
          tenantOid: d.tenant.oid,
          slateOid: slate.oid,
          slateInstanceOid: slateInstance.oid,
          authConfigOid: authConfig?.oid ?? null,
          callbackConfigOid: d.callbackConfig?.oid ?? null,
          callbackId: d.input.callbackId ?? null,
          callbackInstanceId: d.input.callbackInstanceId ?? null,
          callbackOwnerVersion: d.input.callbackOwnerVersion ?? 0,
          callbackOwnerMutationId: d.input.callbackOwnerMutationId ?? null,
          callbackOwnerMutationDigest: d.input.callbackOwnerMutationDigest ?? null,
          name: d.input.name,
          description: d.input.description,
          eventTypes: normalizeEventTypes(d.input.eventTypes)
        }
      });

      if (
        triggerActions.some(
          trigger => trigger.invocation.type === SlateTriggerReceiverTriggerSource.webhook
        )
      ) {
        await provisionInitialCallbackReceiverPathSecretInTransaction({
          tx: prisma,
          tenant: d.tenant,
          receiverId: receiver.id,
          actor: {
            actorId: 'slates_hub_callback_registration',
            requestId: `receiver:${receiver.id}`
          }
        });
      }

      let outboxIds: string[] = [];
      await Promise.all(
        triggerActions.map(async trigger => {
          let pollIntervalSeconds: number | null = null;
          if (trigger.invocation.type === SlateTriggerReceiverTriggerSource.polling) {
            pollIntervalSeconds = Math.max(
              trigger.pollIntervalSeconds ?? trigger.invocation.intervalSeconds,
              MIN_POLL_INTERVAL_SECONDS
            );
          }

          let triggerId = getId('slateTriggerReceiverTrigger');
          let registrationGeneration = 1;
          let policy = initialVerificationPolicy({
            action: trigger.action,
            receiverTriggerId: triggerId.id,
            registrationGeneration
          });
          let created = await prisma.slateTriggerReceiverTrigger.create({
            data: {
              ...triggerId,
              receiverOid: receiver.oid,
              actionOid: trigger.action.oid,
              source: trigger.invocation.type,
              eventTypes: trigger.eventTypes,
              pollIntervalSeconds,
              nextPollAt: pollIntervalSeconds ? new Date() : null,
              state: trigger.state ?? null,
              registrationGeneration,
              registrationStatus:
                trigger.invocation.type === SlateTriggerReceiverTriggerSource.webhook
                  ? 'pending'
                  : 'unregistered',
              registrationIntentKind: 'register',
              registrationEnqueueDeadlineAt:
                trigger.invocation.type === SlateTriggerReceiverTriggerSource.webhook
                  ? new Date(now.getTime() + REGISTRATION_ENQUEUE_DEADLINE_MS)
                  : null,
              ...policy
            },
            select: {
              oid: true,
              id: true,
              source: true,
              registrationGeneration: true,
              registrationIntentKind: true
            }
          });
          if (created.source === SlateTriggerReceiverTriggerSource.webhook) {
            let outbox = await recordRegistrationOutboxInTransaction({
              tx: prisma,
              receiverTriggerOid: created.oid,
              receiverTriggerId: created.id,
              operation: created.registrationIntentKind,
              registrationGeneration: created.registrationGeneration
            });
            outboxIds.push(outbox.id);
          }
          return created;
        })
      );

      return { receiver, outboxIds };
    });

    await enqueuePendingRegistrationOutboxes({ outboxIds });

    return await this.getTriggerReceiverById({
      tenant: d.tenant,
      id: receiver.id
    });
  }

  async updateTriggerReceiver(d: {
    tenant: Tenant;
    receiverId: string;
    callbackOwnerAuthority?: CallbackOwnerAuthority;
    input: {
      authConfig?: SlateAuthConfig | null;
      callbackConfig?: SlateCallbackConfig | null;
      name?: string | null;
      description?: string | null;
      eventTypes?: string[];
      callbackId?: string | null;
      callbackInstanceId?: string | null;
      triggers?: {
        triggerId: string;
        eventTypes?: string[];
        state?: Record<string, any> | null;
        pollIntervalSeconds?: number | null;
      }[];
    };
  }) {
    if (d.callbackOwnerAuthority) {
      validateCallbackOwnerAuthority(d.callbackOwnerAuthority);
      if (d.callbackOwnerAuthority.expectedReceiverId !== d.receiverId) {
        throw callbackOwnerConflict();
      }
    }
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.receiverId,
        ...(d.callbackOwnerAuthority
          ? {
              callbackId: d.callbackOwnerAuthority.callbackId,
              callbackInstanceId: d.callbackOwnerAuthority.callbackInstanceId
            }
          : {})
      },
      include: receiverInclude
    });
    if (!receiver) {
      if (d.callbackOwnerAuthority) throw callbackOwnerConflict();
      throw new ServiceError(notFoundError('slate.trigger.receiver'));
    }
    if (
      (receiver.callbackId !== null || receiver.callbackInstanceId !== null) &&
      !d.callbackOwnerAuthority
    ) {
      throw callbackOwnerConflict();
    }

    let slate = receiver.slate;
    let version = await slateSessionService.getSessionVersion({
      slate,
      slateInstance: receiver.slateInstance
    });

    let authConfig = receiver.authConfig as SlateAuthConfig | null;
    if (d.input.authConfig !== undefined) {
      authConfig = this.validateAuthConfig({
        tenant: d.tenant,
        slate,
        slateInstance: receiver.slateInstance,
        authConfig: d.input.authConfig ?? null,
        hasAuthMethods: (version.specification?.authMethods ?? []).length > 0
      });
    }

    let triggerActions = d.input.triggers
      ? await this.core.resolveActionsForTriggers({
          slate,
          specificationOid: version.specification!.oid,
          triggers: d.input.triggers.map(trigger => ({
            ...trigger,
            pollIntervalSeconds: this.normalizePollIntervalOverride(
              trigger.pollIntervalSeconds
            )
          }))
        })
      : null;

    let outboxIds = await db.$transaction(async tx => {
      let now = new Date();
      let receiverUpdated = await tx.slateTriggerReceiver.updateMany({
        where: {
          oid: receiver.oid,
          updatedAt: receiver.updatedAt,
          ...(d.callbackOwnerAuthority
            ? {
                tenantOid: d.tenant.oid,
                id: d.callbackOwnerAuthority.expectedReceiverId!,
                callbackId: d.callbackOwnerAuthority.callbackId,
                callbackInstanceId: d.callbackOwnerAuthority.callbackInstanceId,
                callbackOwnerVersion: d.callbackOwnerAuthority.expectedOwnerVersion
              }
            : {})
        },
        data: {
          authConfigOid:
            d.input.authConfig !== undefined ? (authConfig?.oid ?? null) : undefined,
          callbackConfigOid:
            d.input.callbackConfig !== undefined
              ? (d.input.callbackConfig?.oid ?? null)
              : undefined,
          callbackId: d.input.callbackId,
          callbackInstanceId: d.input.callbackInstanceId,
          name: d.input.name === null ? null : d.input.name,
          description: d.input.description === null ? null : d.input.description,
          eventTypes: d.input.eventTypes ? normalizeEventTypes(d.input.eventTypes) : undefined,
          ...(d.callbackOwnerAuthority
            ? {
                status: 'active',
                tombstonedAt: null,
                callbackOwnerVersion: { increment: 1 },
                callbackOwnerMutationId: d.callbackOwnerAuthority.mutationId,
                callbackOwnerMutationDigest: d.callbackOwnerAuthority.mutationDigest
              }
            : {})
        }
      });
      if (receiverUpdated.count !== 1) {
        if (d.callbackOwnerAuthority) throw callbackOwnerConflict();
        throw new Error('Trigger receiver upsert CAS conflict');
      }
      if (!triggerActions) return [];

      let outboxIds: string[] = [];
      let existingByActionOid = new Map(
        receiver.triggers.map(trigger => [trigger.actionOid, trigger] as const)
      );
      let incomingByActionOid = new Map(
        triggerActions.map(trigger => [trigger.action.oid, trigger] as const)
      );

      for (let trigger of receiver.triggers) {
        if (incomingByActionOid.has(trigger.actionOid)) continue;
        if (trigger.tombstonedAt) continue;
        if (trigger.source === SlateTriggerReceiverTriggerSource.webhook) {
          let intent = await beginRegistrationIntentInTransaction({
            tx,
            receiverTriggerId: trigger.id,
            intent: 'unregister',
            tombstone: true,
            now
          });
          outboxIds.push(intent.outboxId);
        } else {
          await tx.slateTriggerReceiverTrigger.update({
            where: { oid: trigger.oid },
            data: {
              tombstonedAt: now,
              ingressDisabledAt: now,
              registrationStatus: 'unregistered',
              registrationIntentKind: 'unregister',
              authoritativeStateVersion: { increment: 1 }
            }
          });
        }
      }

      for (let trigger of triggerActions) {
        if (existingByActionOid.has(trigger.action.oid)) continue;
        let pollIntervalSeconds: number | null = null;
        if (trigger.invocation.type === SlateTriggerReceiverTriggerSource.polling) {
          pollIntervalSeconds = Math.max(
            trigger.pollIntervalSeconds ?? trigger.invocation.intervalSeconds,
            MIN_POLL_INTERVAL_SECONDS
          );
        }
        let triggerId = getId('slateTriggerReceiverTrigger');
        let registrationGeneration = 1;
        let policy = initialVerificationPolicy({
          action: trigger.action,
          receiverTriggerId: triggerId.id,
          registrationGeneration
        });
        let created = await tx.slateTriggerReceiverTrigger.create({
          data: {
            ...triggerId,
            receiverOid: receiver.oid,
            actionOid: trigger.action.oid,
            source: trigger.invocation.type,
            eventTypes: trigger.eventTypes,
            pollIntervalSeconds,
            nextPollAt: pollIntervalSeconds ? now : null,
            state: trigger.state ?? null,
            registrationGeneration,
            registrationStatus:
              trigger.invocation.type === SlateTriggerReceiverTriggerSource.webhook
                ? 'pending'
                : 'unregistered',
            registrationIntentKind: 'register',
            registrationEnqueueDeadlineAt:
              trigger.invocation.type === SlateTriggerReceiverTriggerSource.webhook
                ? new Date(now.getTime() + REGISTRATION_ENQUEUE_DEADLINE_MS)
                : null,
            ...policy
          },
          select: { oid: true, id: true, source: true }
        });
        if (created.source === SlateTriggerReceiverTriggerSource.webhook) {
          let outbox = await recordRegistrationOutboxInTransaction({
            tx,
            receiverTriggerOid: created.oid,
            receiverTriggerId: created.id,
            operation: 'register',
            registrationGeneration
          });
          outboxIds.push(outbox.id);
        }
      }

      let receiverAuthChanged =
        d.input.authConfig !== undefined &&
        receiver.authConfigOid !== (authConfig?.oid ?? null);
      let receiverCallbackConfigChanged =
        d.input.callbackConfig !== undefined &&
        receiver.callbackConfigOid !== (d.input.callbackConfig?.oid ?? null);
      for (let trigger of receiver.triggers) {
        let incoming = incomingByActionOid.get(trigger.actionOid);
        if (!incoming) continue;
        let nextState = incoming.state === undefined ? trigger.state : incoming.state;
        let nextPollIntervalSeconds = trigger.pollIntervalSeconds;
        if (
          incoming.pollIntervalSeconds !== undefined &&
          trigger.source === SlateTriggerReceiverTriggerSource.polling
        ) {
          nextPollIntervalSeconds = Math.max(
            incoming.pollIntervalSeconds ?? MIN_POLL_INTERVAL_SECONDS,
            MIN_POLL_INTERVAL_SECONDS
          );
        }
        let stateChanged = !isDeepStrictEqual(nextState, trigger.state);
        let pollChanged = nextPollIntervalSeconds !== trigger.pollIntervalSeconds;
        let eventTypesChanged = !isDeepStrictEqual(incoming.eventTypes, trigger.eventTypes);
        if (stateChanged || pollChanged || eventTypesChanged || trigger.tombstonedAt) {
          await tx.slateTriggerReceiverTrigger.update({
            where: { oid: trigger.oid },
            data: {
              state: nextState,
              eventTypes: incoming.eventTypes,
              pollIntervalSeconds: nextPollIntervalSeconds,
              ...(trigger.tombstonedAt
                ? {
                    tombstonedAt: null,
                    ingressDisabledAt: null,
                    ...(trigger.source === SlateTriggerReceiverTriggerSource.polling
                      ? {
                          registrationStatus: 'unregistered' as const,
                          registrationIntentKind: 'register' as const,
                          authoritativeStateVersion: { increment: 1 }
                        }
                      : {})
                  }
                : {})
            }
          });
        }
        if (
          trigger.source === SlateTriggerReceiverTriggerSource.webhook &&
          (stateChanged ||
            receiverAuthChanged ||
            receiverCallbackConfigChanged ||
            trigger.tombstonedAt)
        ) {
          let intent = await beginRegistrationIntentInTransaction({
            tx,
            receiverTriggerId: trigger.id,
            intent: 'reregister',
            now
          });
          outboxIds.push(intent.outboxId);
        }
      }
      return outboxIds;
    });

    await enqueuePendingRegistrationOutboxes({ outboxIds });

    return await this.getTriggerReceiverById({
      tenant: d.tenant,
      id: receiver.id
    });
  }

  async upsertTriggerReceiverForCallback(d: {
    tenant: Tenant;
    slateInstance: SlateInstance & {
      slate: Slate;
      currentConfig: SlateInstanceConfig | null;
    };
    authConfig?: SlateAuthConfig | null;
    callbackConfig?: SlateCallbackConfig | null;
    input: {
      callbackId: string;
      callbackInstanceId: string;
      expectedSlateTriggerReceiverId: string | null;
      expectedOwnerVersion: number;
      ownerMutationId: string;
      name?: string | null;
      description?: string | null;
      triggers: {
        triggerId: string;
        eventTypes?: string[];
        state?: Record<string, any> | null;
        pollIntervalSeconds?: number | null;
      }[];
    };
  }) {
    if (d.callbackConfig && d.callbackConfig.slateOid !== d.slateInstance.slateOid) {
      throw new ServiceError(notFoundError('slate.callback_config'));
    }

    let triggers = d.input.triggers.map(trigger => ({
      ...trigger,
      eventTypes: normalizeEventTypes(trigger.eventTypes)
    }));
    let mutationDigest = callbackOwnerMutationDigest({
      operation: 'upsert',
      callbackId: d.input.callbackId,
      callbackInstanceId: d.input.callbackInstanceId,
      slateInstanceId: d.slateInstance.id,
      authConfigId: d.authConfig?.id ?? null,
      callbackConfigId: d.callbackConfig?.id ?? null,
      name: d.input.name ?? null,
      description: d.input.description ?? null,
      triggers
    });
    let authority: CallbackOwnerAuthority = {
      callbackId: d.input.callbackId,
      callbackInstanceId: d.input.callbackInstanceId,
      expectedReceiverId: d.input.expectedSlateTriggerReceiverId,
      expectedOwnerVersion: d.input.expectedOwnerVersion,
      mutationId: d.input.ownerMutationId,
      mutationDigest
    };
    validateCallbackOwnerAuthority(authority);

    let existing = await db.slateTriggerReceiver.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        callbackId: d.input.callbackId,
        callbackInstanceId: d.input.callbackInstanceId
      }
    });

    if (existing && existing.slateInstanceOid !== d.slateInstance.oid) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_receiver_instance_mismatch',
          message: 'A callback receiver cannot be moved to a different provider instance.'
        })
      );
    }

    if (existing && isIdempotentCallbackOwnerMutation(existing, authority)) {
      return await this.getTriggerReceiverById({ tenant: d.tenant, id: existing.id });
    }

    if (
      existing &&
      (authority.expectedReceiverId !== existing.id ||
        authority.expectedOwnerVersion !== existing.callbackOwnerVersion)
    ) {
      throw callbackOwnerConflict();
    }
    if (
      !existing &&
      (authority.expectedReceiverId !== null || authority.expectedOwnerVersion !== 0)
    ) {
      throw callbackOwnerConflict();
    }

    let receiver = existing
      ? await this.updateTriggerReceiver({
          tenant: d.tenant,
          receiverId: existing.id,
          callbackOwnerAuthority: authority,
          input: {
            authConfig: d.authConfig,
            callbackConfig: d.callbackConfig,
            callbackId: d.input.callbackId,
            callbackInstanceId: d.input.callbackInstanceId,
            name: d.input.name,
            description: d.input.description,
            triggers
          }
        })
      : await this.createTriggerReceiver({
          tenant: d.tenant,
          slateInstance: d.slateInstance,
          authConfig: d.authConfig ?? null,
          callbackConfig: d.callbackConfig ?? null,
          input: {
            callbackId: d.input.callbackId,
            callbackInstanceId: d.input.callbackInstanceId,
            callbackOwnerVersion: 1,
            callbackOwnerMutationId: authority.mutationId,
            callbackOwnerMutationDigest: authority.mutationDigest,
            name: d.input.name ?? undefined,
            description: d.input.description ?? undefined,
            triggers
          }
        });

    return await this.getTriggerReceiverById({
      tenant: d.tenant,
      id: receiver.id
    });
  }

  async deleteTriggerReceiver(d: {
    tenant: Tenant;
    receiverId: string;
    callbackOwner?: {
      callbackId: string;
      callbackInstanceId: string;
      expectedOwnerVersion: number;
      ownerMutationId: string;
    };
  }) {
    let authority: CallbackOwnerAuthority | undefined = d.callbackOwner
      ? {
          callbackId: d.callbackOwner.callbackId,
          callbackInstanceId: d.callbackOwner.callbackInstanceId,
          expectedReceiverId: d.receiverId,
          expectedOwnerVersion: d.callbackOwner.expectedOwnerVersion,
          mutationId: d.callbackOwner.ownerMutationId,
          mutationDigest: callbackOwnerMutationDigest({
            operation: 'delete',
            callbackId: d.callbackOwner.callbackId,
            callbackInstanceId: d.callbackOwner.callbackInstanceId,
            receiverId: d.receiverId
          })
        }
      : undefined;
    if (authority) validateCallbackOwnerAuthority(authority);
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: authority
        ? {
            tenantOid: d.tenant.oid,
            OR: [
              {
                callbackId: authority.callbackId,
                callbackInstanceId: authority.callbackInstanceId
              },
              {
                id: d.receiverId,
                callbackOwnerMutationId: authority.mutationId
              }
            ]
          }
        : {
            tenantOid: d.tenant.oid,
            id: d.receiverId
          },
      include: receiverInclude
    });
    if (!receiver) {
      if (authority) throw callbackOwnerConflict();
      throw new ServiceError(notFoundError('slate.trigger.receiver'));
    }
    if ((receiver.callbackId !== null || receiver.callbackInstanceId !== null) && !authority) {
      throw callbackOwnerConflict();
    }
    if (authority && isIdempotentCallbackOwnerMutation(receiver, authority)) {
      return receiver;
    }
    if (
      authority &&
      (receiver.id !== authority.expectedReceiverId ||
        receiver.callbackOwnerVersion !== authority.expectedOwnerVersion)
    ) {
      throw callbackOwnerConflict();
    }

    let intents = await db.$transaction(async tx => {
      let now = new Date();
      let ownerUpdated = await tx.slateTriggerReceiver.updateMany({
        where: {
          oid: receiver.oid,
          ...(authority
            ? {
                tenantOid: d.tenant.oid,
                id: authority.expectedReceiverId!,
                callbackId: authority.callbackId,
                callbackInstanceId: authority.callbackInstanceId,
                callbackOwnerVersion: authority.expectedOwnerVersion
              }
            : {})
        },
        data: {
          status: 'paused',
          tombstonedAt: now,
          ...(authority
            ? {
                callbackId: null,
                callbackInstanceId: null,
                callbackOwnerVersion: { increment: 1 },
                callbackOwnerMutationId: authority.mutationId,
                callbackOwnerMutationDigest: authority.mutationDigest
              }
            : {})
        }
      });
      if (ownerUpdated.count !== 1) {
        if (authority) throw callbackOwnerConflict();
        throw new Error('Trigger receiver delete CAS conflict');
      }
      return await Promise.all(
        receiver.triggers.map(async trigger => {
          if (trigger.source !== SlateTriggerReceiverTriggerSource.webhook) {
            await tx.slateTriggerReceiverTrigger.update({
              where: { oid: trigger.oid },
              data: {
                tombstonedAt: now,
                ingressDisabledAt: now,
                registrationStatus: 'unregistered',
                registrationIntentKind: 'delete',
                authoritativeStateVersion: { increment: 1 }
              }
            });
            return null;
          }
          return await beginRegistrationIntentInTransaction({
            tx,
            receiverTriggerId: trigger.id,
            intent: 'delete',
            tombstone: true,
            now
          });
        })
      );
    });
    await enqueuePendingRegistrationOutboxes({
      outboxIds: intents.filter(intent => intent !== null).map(intent => intent!.outboxId)
    });
    await slateTriggerReceiverPathSecretMethods.revokeAllPathSecrets({
      tenant: d.tenant,
      receiverId: receiver.id
    });
    return await this.getTriggerReceiverById({ tenant: d.tenant, id: receiver.id });
  }

  async renewWebhookRegistration(d: { tenant: Tenant; receiverTriggerId: string }) {
    let trigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: { id: d.receiverTriggerId, receiver: { tenantOid: d.tenant.oid } },
      select: {
        id: true,
        receiver: {
          select: {
            callbackId: true,
            callbackInstanceId: true
          }
        }
      }
    });
    if (!trigger) throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));
    if (trigger.receiver.callbackId !== null || trigger.receiver.callbackInstanceId !== null) {
      throw callbackOwnerConflict();
    }
    let intent = await db.$transaction(
      async tx =>
        await beginRegistrationIntentInTransaction({
          tx,
          receiverTriggerId: trigger.id,
          intent: 'renew'
        })
    );
    await enqueuePendingRegistrationOutboxes({ outboxIds: [intent.outboxId] });
    return intent;
  }

  async getTriggerReceiverById(d: { tenant: Tenant; id: string }) {
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include: receiverInclude
    });
    if (!receiver) throw new ServiceError(notFoundError('slate.trigger.receiver'));
    return receiver;
  }

  async getTriggerReceiverForCallback(d: {
    tenant: Tenant;
    receiverId: string;
    callbackId: string;
    callbackInstanceId: string;
    expectedOwnerVersion: number;
  }) {
    if (!Number.isInteger(d.expectedOwnerVersion) || d.expectedOwnerVersion < 1) {
      throw callbackOwnerConflict();
    }
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.receiverId,
        callbackId: d.callbackId,
        callbackInstanceId: d.callbackInstanceId,
        callbackOwnerVersion: d.expectedOwnerVersion
      },
      include: receiverInclude
    });
    if (!receiver) throw callbackOwnerConflict();
    return receiver;
  }

  async listTriggerReceivers(d: {
    tenant: Tenant;
    slateIds?: string[];
    slateInstanceIds?: string[];
  }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: {
            id: { in: d.slateInstanceIds },
            tenantOid: d.tenant.oid
          }
        })
      : undefined;

    let slates = d.slateIds
      ? await db.slate.findMany({
          where: {
            id: { in: d.slateIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateTriggerReceiver.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              slateInstanceOid: slateInstances
                ? { in: slateInstances.map(instance => instance.oid) }
                : undefined,
              slateOid: slates ? { in: slates.map(slate => slate.oid) } : undefined
            },
            include: receiverInclude
          })
      )
    );
  }
}

export let slateTriggerReceiverService = Service.create(
  'slateTriggerReceiverService',
  () => new slateTriggerReceiverServiceImpl()
).build();
