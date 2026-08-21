import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import {
  SlateTriggerEventDeliveryStatus,
  type Slate,
  type SlateAction,
  type SlateInvocation,
  type SlateTriggerInvocationType
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { assertScopedInvocationIsolation } from '../lib/invocation/types';
import type {
  AcceptedWebhookVerificationBindings,
  AcceptedWebhookVerificationProof,
  ScopedInvocationAuthorityHandle,
  ScopedInvocationExecutionControl,
  ScopedInvocationGrantOperation,
  ScopedWebhookCandidateBinding,
  SlatesScopedInvocationGrantEnvelope
} from '../lib/invocation/types';
import { slateTriggerEventProcessQueue } from '../queues/trigger/eventQueues';
import { getTenantAndSenderForSignal, getTenantForSignal, signal } from '../signal';
import { slateInvocationService } from './slateInvocation';
import { slateSessionService } from './slateSession';
import {
  getTriggerSpec,
  normalizeEventTypes,
  receiverTriggerInclude,
  type ReceiverTriggerWithRelations
} from './slateTriggerReceiverShared';
import { requireScopedInvocationExecutionControl } from './slateTriggerReceiverProductionSecurityAdapters';
import { recordCallbackEventLifecycle } from './callbackEventLifecycle';

export interface SlateTriggerScopedGrantIssuer {
  issue(d: {
    authorityHandle: ScopedInvocationAuthorityHandle;
    receiverTriggerId: string;
    hubInvocationId: string;
    requestId: string;
    operation: Exclude<ScopedInvocationGrantOperation, 'tool_invoke'>;
    acceptedVerificationProofId?: string;
  }): Promise<SlatesScopedInvocationGrantEnvelope>;
  revoke(envelope: SlatesScopedInvocationGrantEnvelope): Promise<void>;
}

export interface AuthoritativeWebhookRule {
  id: string;
  phase: 'bootstrap' | 'delivery' | 'lifecycle';
  when: {
    methods: string[];
    registrationStatuses?: string[];
    matcher?: Record<string, unknown>;
  };
  result:
    | { type: 'sync_only' }
    | { type: 'dispatch'; scope: 'receiver_trigger' | 'verified_items' };
  verify: {
    type: string;
    allowedSecretRefs?: string[];
    allowedBootstrapCaptureRefs?: string[];
  };
}

export interface AuthoritativeWebhookResolution {
  receiverTrigger: ReceiverTriggerWithRelations;
  version: Awaited<ReturnType<typeof slateSessionService.getSessionVersion>>;
  actionId: string;
  hubInvocationId: string;
  actionContract: Record<string, unknown>;
  specHash: string;
  rule: AuthoritativeWebhookRule;
  registrationStatus: string;
  registrationGeneration: number;
  registrationVersion: number;
  itemAdapterId?: 'graph.body_value.v1';
  authConfigId: string | null;
  callbackSecretIds: readonly string[];
  candidateBindings: readonly Readonly<ScopedWebhookCandidateBinding>[];
  redactionSentinels: readonly string[];
}

export interface ResolvedAuthoritativeWebhook {
  authority: AuthoritativeWebhookResolution;
  authorityHandle: ScopedInvocationAuthorityHandle;
}

export interface AuthoritativeWebhookRegistration {
  receiverTrigger: ReceiverTriggerWithRelations;
  version: Awaited<ReturnType<typeof slateSessionService.getSessionVersion>>;
  actionId: string;
  actionContract: Record<string, unknown>;
  specHash: string;
  registrationStatus: string;
  registrationGeneration: number;
  registrationVersion: number;
  authConfigId: string | null;
  callbackSecretIds: readonly string[];
}

export interface SlateTriggerWebhookAuthorityResolver {
  resolve(d: {
    receiverTriggerId: string;
    ruleId: string;
    request: unknown;
    hubInvocationId: string;
    requestId: string;
    operation: 'webhook_verify';
    itemAdapterId?: 'graph.body_value.v1';
    candidateBindings?: readonly ScopedWebhookCandidateBinding[];
  }): Promise<ResolvedAuthoritativeWebhook>;
  resolveMapping?(d: {
    receiverTriggerId: string;
    ruleId: string;
    originalRequest: unknown;
    dispatchRequest: unknown;
    originalRequestHash: string;
    dispatchRequestHash: string;
    hubInvocationId: string;
    requestId: string;
    operation: 'webhook_handle';
    itemAdapterId?: 'graph.body_value.v1';
    candidateBindings: readonly ScopedWebhookCandidateBinding[];
  }): Promise<ResolvedAuthoritativeWebhook>;
  resolveAcceptedProof(d: {
    proof: AcceptedWebhookVerificationBindings;
    request: unknown;
    hubInvocationId: string;
    requestId: string;
    operation: 'webhook_bootstrap_capture';
  }): Promise<ResolvedAuthoritativeWebhook>;
  release(d: {
    authorityHandle: ScopedInvocationAuthorityHandle;
    receiverTriggerId: string;
    hubInvocationId: string;
    requestId: string;
    operation: 'webhook_verify' | 'webhook_bootstrap_capture' | 'webhook_handle';
    acceptedVerificationProofId?: string;
  }): Promise<void>;
  resolveRegistration(d: {
    receiverTriggerId: string;
  }): Promise<AuthoritativeWebhookRegistration>;
}

export type WebhookCapabilityDecision =
  | { status: 'v1' }
  | { status: 'legacy'; code: 'capability_absent' }
  | {
      status: 'fail_closed';
      code:
        | 'provider_identification_failed'
        | 'webhook_registration_capabilities_inconsistent'
        | 'webhook_verification_capabilities_inconsistent'
        | 'webhook_bootstrap_capabilities_inconsistent';
    };

export type WebhookBootstrapCapabilityDecision =
  | { status: 'v1' }
  | { status: 'unavailable'; code: 'capability_absent' }
  | Extract<WebhookCapabilityDecision, { status: 'fail_closed' }>;

export interface WebhookCapabilityNegotiation {
  registration: WebhookCapabilityDecision;
  verification: WebhookCapabilityDecision;
  bootstrapCapture: WebhookBootstrapCapabilityDecision;
}

export let negotiateWebhookCapabilityAdvertisement = (d: {
  providerAvailable: boolean;
  provider: Record<string, unknown>;
  action: Record<string, unknown>;
}): WebhookCapabilityNegotiation => {
  if (!d.providerAvailable) {
    let failed = {
      status: 'fail_closed' as const,
      code: 'provider_identification_failed' as const
    };
    return { registration: failed, verification: failed, bootstrapCapture: failed };
  }
  let scoped = d.provider.scopedInvocationGrantV1 === true;
  let providerRegistration = d.provider.webhookSecretNegotiationV1 === true;
  let actionRegistration = d.action.webhookSecretNegotiationV1 === true;
  let providerVerification = d.provider.webhookInboundVerificationV1 === true;
  let actionVerification = d.action.webhookInboundVerificationV1 === true;
  let providerBootstrap = d.provider.webhookInboundBootstrapCaptureV1 === true;
  let actionBootstrap = d.action.webhookInboundBootstrapCaptureV1 === true;
  let registration: WebhookCapabilityDecision =
    !providerRegistration && !actionRegistration
      ? { status: 'legacy', code: 'capability_absent' }
      : providerRegistration && actionRegistration && scoped
        ? { status: 'v1' }
        : {
            status: 'fail_closed',
            code: 'webhook_registration_capabilities_inconsistent'
          };
  let verification: WebhookCapabilityDecision =
    !providerVerification && !actionVerification
      ? { status: 'legacy', code: 'capability_absent' }
      : providerVerification && actionVerification && scoped
        ? { status: 'v1' }
        : {
            status: 'fail_closed',
            code: 'webhook_verification_capabilities_inconsistent'
          };
  let bootstrapCapture: WebhookBootstrapCapabilityDecision =
    !providerBootstrap && !actionBootstrap
      ? { status: 'unavailable', code: 'capability_absent' }
      : providerBootstrap &&
          actionBootstrap &&
          scoped &&
          providerVerification &&
          actionVerification
        ? { status: 'v1' }
        : {
            status: 'fail_closed',
            code: 'webhook_bootstrap_capabilities_inconsistent'
          };
  return { registration, verification, bootstrapCapture };
};

export interface SlateTriggerAcceptedVerificationProofs {
  issue(d: {
    bindings: Omit<
      AcceptedWebhookVerificationBindings,
      'proofId' | 'issuedAtMs' | 'expiresAtMs'
    >;
    ttlMs: number;
  }): AcceptedWebhookVerificationProof;
  consume(d: {
    proof: AcceptedWebhookVerificationProof;
    receiverTriggerId: string;
  }): AcceptedWebhookVerificationBindings;
  revoke(proof: AcceptedWebhookVerificationProof): void;
}

export type AcceptedWebhookBootstrapCaptureOutput = {
  status: 'accepted';
  capturedSecrets: Record<string, string>;
  response: unknown;
  replayClaim?: { deliveryIds: string[]; freshnessTimestampMs?: number };
};

export interface SlateTriggerBootstrapCaptureWriter {
  persistRegistrationCapture(d: {
    authority: AuthoritativeWebhookRegistration;
    registrationDetails: unknown;
    state: unknown;
    capturedSecrets: Record<string, string>;
  }): Promise<'committed' | 'conflict'>;
  compareAndSet(d: {
    authority: AuthoritativeWebhookResolution;
    proof: AcceptedWebhookVerificationBindings;
    output: AcceptedWebhookBootstrapCaptureOutput;
  }): Promise<
    | { status: 'conflict' }
    | {
        status: 'committed' | 'duplicate';
        committed: {
          response: unknown;
          registrationVersion: number;
          replayClaim?: { deliveryIds: string[]; freshnessTimestampMs?: number };
        };
      }
  >;
}

export interface SlateTriggerReceiverSecurityAdapters {
  scopedGrantIssuer?: SlateTriggerScopedGrantIssuer;
  webhookAuthorityResolver?: SlateTriggerWebhookAuthorityResolver;
  acceptedVerificationProofs?: SlateTriggerAcceptedVerificationProofs;
  bootstrapCaptureWriter?: SlateTriggerBootstrapCaptureWriter;
  scopedInvocationExecutionControl?: ScopedInvocationExecutionControl;
}

export class SlateTriggerReceiverCore {
  constructor(readonly security: SlateTriggerReceiverSecurityAdapters = {}) {}

  async getReceiverTriggerWithRelations(id: string) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: { id },
      include: receiverTriggerInclude
    });
    if (!receiverTrigger)
      throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));
    return receiverTrigger as ReceiverTriggerWithRelations;
  }

  async resolveActionsForTriggers(d: {
    slate: Slate;
    specificationOid: bigint;
    triggers: {
      triggerId: string;
      eventTypes?: string[];
      state?: Record<string, any> | null;
      pollIntervalSeconds?: number | null;
    }[];
  }) {
    let triggerIds = d.triggers.map(t => t.triggerId);

    let actions = await db.slateAction.findMany({
      where: {
        type: 'trigger',
        slateOid: d.slate.oid,
        slateSpecifications: {
          some: {
            specificationOid: d.specificationOid
          }
        },
        OR: [
          { id: { in: triggerIds } },
          { key: { in: triggerIds } },
          { identifier: { in: triggerIds } }
        ]
      }
    });

    let actionById = new Map(actions.map(action => [action.id, action] as const));
    let actionByKey = new Map(actions.map(action => [action.key, action] as const));
    let actionByIdentifier = new Map(
      actions.map(action => [action.identifier, action] as const)
    );

    let seenActionIds = new Set<string>();

    return d.triggers.map(trigger => {
      let action =
        actionById.get(trigger.triggerId) ||
        actionByKey.get(trigger.triggerId) ||
        actionByIdentifier.get(trigger.triggerId);

      if (!action) {
        throw new ServiceError(
          badRequestError({
            code: 'invalid_trigger_action',
            message: `Trigger action not found: ${trigger.triggerId}`
          })
        );
      }

      let spec = getTriggerSpec(action);
      if (seenActionIds.has(action.id)) {
        throw new ServiceError(
          badRequestError({
            code: 'duplicate_trigger_action',
            message: `Trigger action specified multiple times: ${action.id}`
          })
        );
      }

      seenActionIds.add(action.id);

      return {
        action,
        eventTypes: normalizeEventTypes(trigger.eventTypes),
        state: trigger.state ?? null,
        pollIntervalSeconds: trigger.pollIntervalSeconds ?? null,
        invocation: spec.invocation
      };
    });
  }

  async getInvocationContext(d: { receiverTrigger: ReceiverTriggerWithRelations }) {
    let { receiver, action } = d.receiverTrigger;

    if (!receiver.slateInstance.currentConfig) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider instance does not have a current configuration set.'
        })
      );
    }

    let version = await slateSessionService.getSessionVersion({
      slate: receiver.slate,
      slateInstance: receiver.slateInstance
    });

    let auth = null as {
      authenticationMethodId: string;
      data: Record<string, any>;
    } | null;

    let hasAuthMethods = (version.specification?.authMethods ?? []).length > 0;
    if (hasAuthMethods) {
      if (!receiver.authConfigOid) {
        throw new ServiceError(
          badRequestError({
            code: 'authentication_required',
            message: 'Authentication method is required for this provider.'
          })
        );
      }

      throw new ServiceError(
        badRequestError({
          code: 'scoped_invocation_grant_required',
          message:
            'Classified registration, polling and legacy webhook callbacks require a scoped invocation grant.'
        })
      );
    }

    return {
      version,
      config: receiver.slateInstance.currentConfig.value,
      auth,
      action
    };
  }

  async createInvocationStack(d: {
    receiver: ReceiverTriggerWithRelations['receiver'];
    receiverTrigger: ReceiverTriggerWithRelations;
    version: Awaited<ReturnType<typeof slateSessionService.getSessionVersion>>;
    config: Record<string, any>;
    auth: { authenticationMethodId: string; data: Record<string, any> } | null;
  }) {
    return await slateInvocationService.createInvocationWithState({
      participants: [],
      slateVersion: d.version,
      config: d.config,
      session: { id: d.receiver.id, state: d.receiverTrigger.state ?? {} },
      auth: d.auth
    });
  }

  async createRestrictedInvocationStack(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    version: Awaited<ReturnType<typeof slateSessionService.getSessionVersion>>;
    hubInvocationId: string;
    redactionSentinels: readonly string[];
    forbiddenValues: readonly string[];
  }) {
    let executionControl = requireScopedInvocationExecutionControl(
      this.security.scopedInvocationExecutionControl
    );
    await assertScopedInvocationIsolation({
      hubInvocationId: d.hubInvocationId,
      control: executionControl
    });
    return await slateInvocationService.createInvocation({
      tenant: d.receiverTrigger.receiver.tenant,
      participants: [],
      slateVersion: d.version,
      egressPolicy: { direction: 'egress', entries: [] },
      invocationId: d.hubInvocationId,
      scopedSecurity: {
        redactionSentinels: d.redactionSentinels,
        forbiddenValues: d.forbiddenValues,
        executionControl
      }
    });
  }

  async negotiateWebhookCapabilities(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    version: Awaited<ReturnType<typeof slateSessionService.getSessionVersion>>;
  }) {
    let stack = await slateInvocationService.createInvocation({
      tenant: d.receiverTrigger.receiver.tenant,
      participants: [],
      slateVersion: d.version
    });
    let provider = await slateInvocationService.getProviderInfo({ stack });
    let providerCapabilities =
      provider.status === 'success'
        ? ((provider.data as { capabilities?: Record<string, unknown> }).capabilities ?? {})
        : {};
    let actionSpec = d.receiverTrigger.action.spec as {
      capabilities?: Record<string, unknown>;
    };
    let actionCapabilities = actionSpec.capabilities ?? {};

    return negotiateWebhookCapabilityAdvertisement({
      providerAvailable: provider.status === 'success',
      provider: providerCapabilities,
      action: actionCapabilities
    });
  }

  async recordTriggerInvocation(d: {
    receiver: ReceiverTriggerWithRelations['receiver'];
    receiverTrigger?: ReceiverTriggerWithRelations;
    eventOid?: bigint;
    type: SlateTriggerInvocationType;
    invocation: { oid: bigint };
    hasResponse?: boolean;
  }) {
    await db.slateTriggerInvocation.create({
      data: {
        ...getId('slateTriggerInvocation'),
        type: d.type,
        hasResponse: d.hasResponse ?? false,
        receiverOid: d.receiver.oid,
        receiverTriggerOid: d.receiverTrigger?.oid,
        eventOid: d.eventOid,
        invocationOid: d.invocation.oid
      }
    });
  }

  async enqueueTriggerEventInputs(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    inputs: Record<string, any>[];
  }) {
    if (d.inputs.length === 0) return;

    let rows = d.inputs.map(input => ({
      ...getId('slateTriggerEventInput'),
      receiverOid: d.receiverTrigger.receiver.oid,
      receiverTriggerOid: d.receiverTrigger.oid,
      actionOid: d.receiverTrigger.actionOid,
      slateOid: d.receiverTrigger.receiver.slate.oid,
      slateInstanceOid: d.receiverTrigger.receiver.slateInstance.oid,
      input
    }));

    await db.slateTriggerEventInput.createMany({
      data: rows
    });

    if (d.receiverTrigger.receiver.callbackId) {
      await Promise.all(
        rows.map(row =>
          this.recordCallbackEventLifecycle({
            receiver: d.receiverTrigger.receiver,
            action: d.receiverTrigger.action,
            event: {
              id: row.id,
              status: 'pending',
              type: d.receiverTrigger.action.key,
              input: row.input
            }
          })
        )
      );
    }

    await slateTriggerEventProcessQueue.addManyWithOps(
      rows.map(row => ({
        data: { eventInputId: row.id },
        opts: { id: row.id }
      }))
    );
  }

  resolveTriggerDestinations(d: {
    receiver: ReceiverTriggerWithRelations['receiver'];
    receiverTrigger: Pick<ReceiverTriggerWithRelations, 'eventTypes'>;
    eventType: string;
  }) {
    let shouldDeliver = Boolean(d.receiver.callbackId);
    let eventTypes = d.receiverTrigger.eventTypes;

    if (eventTypes.length && !eventTypes.includes(d.eventType)) {
      shouldDeliver = false;
    }

    return {
      shouldDeliver,
      signalDestinationIds: []
    };
  }

  async recordCallbackEventLifecycle(d: {
    receiver: ReceiverTriggerWithRelations['receiver'];
    action: SlateAction;
    event: {
      id: string;
      status: 'pending' | 'processing' | 'retrying' | 'succeeded' | 'failed' | 'skipped';
      type?: string | null;
      sourceId?: string | null;
      input?: Record<string, any> | null;
      output?: Record<string, any> | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      providerInvocation?: Pick<SlateInvocation, 'id'> | null;
    };
  }) {
    return await recordCallbackEventLifecycle(d);
  }

  async createSignalEvent(d: {
    receiver: ReceiverTriggerWithRelations['receiver'];
    action: SlateAction;
    event: {
      id: string;
      type: string;
      sourceId: string;
      input: Record<string, any> | null;
      output: Record<string, any>;
      createdAt: Date;
      providerInvocation?: Pick<SlateInvocation, 'id'> | null;
    };
  }) {
    if (d.receiver.callbackId) {
      let callbackEvent = await this.recordCallbackEventLifecycle({
        receiver: d.receiver,
        action: d.action,
        event: {
          id: d.event.id,
          status: 'succeeded',
          type: d.event.type,
          sourceId: d.event.sourceId,
          input: d.event.input,
          output: d.event.output,
          providerInvocation: d.event.providerInvocation
        }
      });

      return callbackEvent!.eventId ?? callbackEvent!.id;
    }

    throw new Error('Callback receiver is missing callback ownership');
  }

  async buildIdempotentSignalEventRequest(d: {
    receiver: ReceiverTriggerWithRelations['receiver'];
    action: SlateAction;
    idempotencyKey: string;
    event: {
      id: string;
      type: string;
      sourceId: string;
      output: Record<string, any>;
    };
  }) {
    let { tenant, sender } = await getTenantAndSenderForSignal(d.receiver.tenant);
    let payload = {
      object: 'callback.event_payload',
      id: d.event.id,
      type: d.event.type,
      trigger: d.action.key,
      idempotencyKey: d.idempotencyKey,
      data: d.event.output
    };
    return {
      tenantId: tenant.id,
      senderId: sender.id,
      idempotencyKey: d.idempotencyKey,
      topics: [
        `slate:${d.receiver.slate.id}`,
        `slate_instance:${d.receiver.slateInstance.id}`,
        `trigger:${d.action.key}`,
        `trigger_receiver:${d.receiver.id}`
      ],
      eventType: d.event.type,
      payloadJson: JSON.stringify(payload),
      headers: {
        'metorial-trigger-event-id': d.event.id,
        'metorial-trigger-event-type': d.event.type,
        'metorial-slate-id': d.receiver.slate.id,
        'metorial-slate-instance-id': d.receiver.slateInstance.id,
        'metorial-trigger-receiver-id': d.receiver.id,
        'metorial-trigger-id': d.action.id
      },
      onlyForDestinations: [],
      ...(d.receiver.callbackId ? { callbackId: d.receiver.callbackId } : {}),
      ...(d.receiver.callbackInstanceId
        ? { callbackInstanceId: d.receiver.callbackInstanceId }
        : {}),
      callbackSourceId: d.event.sourceId,
      callbackTriggerId: d.action.id
    };
  }

  async dispatchTriggerEvent(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    action: SlateAction;
    event: {
      oid: bigint;
      id: string;
      type: string;
      sourceId: string;
      input: Record<string, any> | null;
      output: Record<string, any>;
      createdAt: Date;
      signalEventId: string;
    };
  }) {
    let receiver = d.receiverTrigger.receiver;
    let targets = this.resolveTriggerDestinations({
      receiver,
      receiverTrigger: d.receiverTrigger,
      eventType: d.event.type
    });

    if (!targets.shouldDeliver) {
      await this.recordCallbackEventLifecycle({
        receiver,
        action: d.action,
        event: {
          id: d.event.id,
          status: 'skipped',
          type: d.event.type,
          sourceId: d.event.sourceId,
          input: d.event.input,
          output: d.event.output
        }
      });
      await db.slateTriggerEvent.update({
        where: { oid: d.event.oid },
        data: { deliveryStatus: SlateTriggerEventDeliveryStatus.skipped }
      });
      return;
    }

    let signalEventId = d.event.signalEventId;

    if (!signalEventId) {
      signalEventId = await this.createSignalEvent({
        receiver,
        action: d.action,
        event: {
          id: d.event.id,
          type: d.event.type,
          sourceId: d.event.sourceId,
          input: d.event.input,
          output: d.event.output,
          createdAt: d.event.createdAt
        }
      });
    }

    await db.$transaction(async prisma => {
      if (!d.event.signalEventId) {
        await prisma.slateTriggerEvent.update({
          where: { oid: d.event.oid },
          data: {
            signalEventId: signalEventId
          }
        });
      }

      await prisma.slateTriggerEvent.update({
        where: { oid: d.event.oid },
        data: {
          deliveryStatus: SlateTriggerEventDeliveryStatus.sent
        }
      });
    });
  }
}
