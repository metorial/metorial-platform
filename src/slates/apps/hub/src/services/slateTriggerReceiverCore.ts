import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import {
  SlateTriggerEventDeliveryStatus,
  SlateTriggerReceiverDeliveryMode,
  type Slate,
  type SlateAction,
  type SlateInvocation,
  type SlateTriggerInvocationType
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { slateTriggerEventProcessQueue } from '../queues/trigger/eventQueues';
import { getTenantAndSenderForSignal, getTenantForSignal, signal } from '../signal';
import { slateAuthHandlerService } from './slateInstanceAuthHandler';
import { slateInvocationService } from './slateInvocation';
import { slateSessionService } from './slateSession';
import {
  buildInvocationAuth,
  getTriggerSpec,
  receiverTriggerInclude,
  type ReceiverTriggerWithRelations
} from './slateTriggerReceiverShared';

let getCallbackEventOutput = (output: Record<string, any>) => {
  let { url, method, headers, receivedAt, ...semanticOutput } = output;
  return semanticOutput;
};

export class SlateTriggerReceiverCore {
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

      let authRes = await slateAuthHandlerService.getSlateInstanceAuth({
        tenant: receiver.tenant,
        slateInstance: receiver.slateInstance,
        authConfigId: receiver.authConfig!.id,
        minExpirationBuffer: 30 * 1000
      });

      auth = buildInvocationAuth(authRes);
    }

    return {
      version,
      config: receiver.slateInstance.currentConfig.value ?? {},
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

    if (
      d.receiverTrigger.receiver.deliveryMode ===
        SlateTriggerReceiverDeliveryMode.callback_v2 &&
      d.receiverTrigger.receiver.callbackId
    ) {
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
    eventType: string;
  }) {
    let shouldDeliver =
      d.receiver.deliveryMode === SlateTriggerReceiverDeliveryMode.callback_v2;

    if (d.receiver.eventTypes.length && !d.receiver.eventTypes.includes(d.eventType)) {
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
    if (
      d.receiver.deliveryMode !== SlateTriggerReceiverDeliveryMode.callback_v2 ||
      !d.receiver.callbackId
    ) {
      return null;
    }

    let signalTenant = await getTenantForSignal(d.receiver.tenant);
    let idempotencyKey = await Hash.sha256(
      canonicalize(['callback-event', d.receiver.callbackId, d.event.id])
    );
    let eventType = d.event.type ?? d.action.key;
    let deliveryPayloadJson: string | undefined;

    if (d.event.status === 'succeeded' && d.event.output) {
      let payload = {
        object: 'callback.event_payload',

        id: d.event.id,
        type: eventType,
        trigger: d.action.key,
        idempotencyKey,
        data: d.event.output
      };

      deliveryPayloadJson = JSON.stringify(payload);
    }

    return await signal.callback.recordEvent({
      tenantId: signalTenant.id,
      callbackId: d.receiver.callbackId,
      eventId: d.event.id,
      status: d.event.status,
      callbackInstanceId: d.receiver.callbackInstanceId,
      sourceId: d.event.sourceId,
      triggerId: d.action.id,
      triggerKey: d.action.key,
      eventType,
      deliveryPayloadJson,
      inputJson: d.event.input === undefined ? undefined : JSON.stringify(d.event.input),
      outputJson:
        d.event.output === undefined
          ? undefined
          : JSON.stringify(d.event.output ? getCallbackEventOutput(d.event.output) : null),
      errorCode: d.event.errorCode,
      errorMessage: d.event.errorMessage
    });
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
    if (
      d.receiver.deliveryMode === SlateTriggerReceiverDeliveryMode.callback_v2 &&
      d.receiver.callbackId
    ) {
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

    let signalTenant = await getTenantForSignal(d.receiver.tenant);
    let idempotencyKey = await Hash.sha256(
      canonicalize(['callback-event', d.receiver.callbackId, d.event.id])
    );

    let payload = {
      object: 'callback.event_payload',

      id: d.event.id,
      type: d.event.type,
      trigger: d.action.key,
      idempotencyKey,
      data: d.event.output
    };

    let { sender } = await getTenantAndSenderForSignal(d.receiver.tenant);
    let signalEvent = await signal.event.create({
      tenantId: signalTenant.id,
      senderId: sender.id,
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
      onlyForDestinations: []
    });

    return signalEvent.id;
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
      eventType: d.event.type
    });
    if (
      receiver.deliveryMode === SlateTriggerReceiverDeliveryMode.callback_v2 &&
      (!receiver.eventTypes.length || receiver.eventTypes.includes(d.event.type))
    ) {
      targets.shouldDeliver = true;
      targets.signalDestinationIds = [];
    }

    if (!targets.shouldDeliver) {
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
