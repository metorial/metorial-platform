import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import {
  SlateTriggerDestinationStatus,
  SlateTriggerEventDeliveryStatus,
  type Slate,
  type SlateAction,
  type SlateTriggerInvocationType
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { slateTriggerEventProcessQueue } from '../queues/trigger/eventQueues';
import { getTenantAndSenderForSignal, signal } from '../signal';
import { slateAuthHandlerService } from './slateInstanceAuthHandler';
import { slateInvocationService } from './slateInvocation';
import { slateSessionService } from './slateSession';
import {
  buildInvocationAuth,
  getTriggerSpec,
  receiverTriggerInclude,
  type ReceiverTriggerWithRelations
} from './slateTriggerReceiverShared';

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
  }) {
    await db.slateTriggerInvocation.create({
      data: {
        ...getId('slateTriggerInvocation'),
        type: d.type,
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
    let destinations = d.receiver.destinations
      .map(r => r.destination)
      .filter(dest => dest.status === SlateTriggerDestinationStatus.active);
    let shouldDeliver = destinations.length > 0;

    if (d.receiver.eventTypes.length && !d.receiver.eventTypes.includes(d.eventType)) {
      shouldDeliver = false;
    }

    return {
      destinations,
      shouldDeliver,
      signalDestinationIds: shouldDeliver
        ? destinations.map(dest => dest.signalDestinationId!)
        : []
    };
  }

  async createSignalEvent(d: {
    receiver: ReceiverTriggerWithRelations['receiver'];
    action: SlateAction;
    event: {
      id: string;
      type: string;
      sourceId: string;
      output: Record<string, any>;
      createdAt: Date;
    };
    signalDestinationIds: string[];
  }) {
    let { sender, tenant: signalTenant } = await getTenantAndSenderForSignal(
      d.receiver.tenant
    );

    let payload = {
      object: 'callback.event_payload',

      id: d.event.id,
      type: d.event.type,
      sourceId: d.event.sourceId,

      trigger: d.action.key,

      data: d.event.output,

      createdAt: d.event.createdAt
    };

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
      onlyForDestinations: d.signalDestinationIds
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
          output: d.event.output,
          createdAt: d.event.createdAt
        },
        signalDestinationIds: targets.signalDestinationIds
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

      await prisma.slateTriggerDelivery.createMany({
        data: targets.destinations.map(dest => ({
          ...getId('slateTriggerDelivery'),
          eventOid: d.event.oid,
          destinationOid: dest.oid,
          signalEventId
        })),
        skipDuplicates: true
      });

      await prisma.slateTriggerEvent.update({
        where: { oid: d.event.oid },
        data: {
          deliveryStatus: SlateTriggerEventDeliveryStatus.sent
        }
      });
    });
  }
}
