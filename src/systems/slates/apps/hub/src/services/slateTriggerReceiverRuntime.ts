import { notFoundError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import {
  SlateTriggerEventDeliveryStatus,
  SlateTriggerEventInputStatus,
  SlateTriggerInvocationType,
  SlateTriggerReceiverStatus,
  SlateTriggerReceiverTriggerSource,
  type SlateTriggerReceiverTrigger
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import {
  getTriggerWebhookBaseUrl,
  type TriggerWebhookRequestPayload
} from '../lib/triggerWebhook';
import {
  slateTriggerEventInputArchiveQueue,
  slateTriggerEventProcessQueue,
  slateTriggerEventSendQueue
} from '../queues/trigger/eventQueues';
import { slateErrorService } from './slateError';
import { slateInvocationService } from './slateInvocation';
import type { SlateTriggerReceiverCore } from './slateTriggerReceiverCore';
import {
  getTriggerSpec,
  receiverTriggerInclude,
  type ReceiverTriggerWithRelations
} from './slateTriggerReceiverShared';

let Sentry = getSentry();

const MAX_TRIGGER_EVENT_INPUT_ATTEMPTS = 5;
const ARCHIVE_INPUT_STATUSES = new Set<SlateTriggerEventInputStatus>([
  SlateTriggerEventInputStatus.succeeded,
  SlateTriggerEventInputStatus.failed,
  SlateTriggerEventInputStatus.skipped
]);

export class SlateTriggerReceiverRuntime {
  private readonly core: SlateTriggerReceiverCore;

  constructor(core: SlateTriggerReceiverCore) {
    this.core = core;
  }

  async processTriggerEventInput(d: { eventInputId: string }) {
    let eventInput = await db.slateTriggerEventInput.findFirst({
      where: { id: d.eventInputId },
      include: {
        receiverTrigger: {
          include: receiverTriggerInclude
        }
      }
    });
    if (!eventInput) throw new ServiceError(notFoundError('slate.trigger.event_input'));

    let validStatuses: SlateTriggerEventInputStatus[] = [
      SlateTriggerEventInputStatus.pending,
      SlateTriggerEventInputStatus.retrying
    ];
    if (!validStatuses.includes(eventInput.status)) return;
    if (eventInput.input == null) {
      await this.updateEventInputStatus({
        eventInput,
        data: {
          status: SlateTriggerEventInputStatus.failed,
          errorCode: 'missing_input',
          errorMessage: 'Event input payload is missing.'
        }
      });
      await db.slateTriggerReceiver.update({
        where: { oid: eventInput.receiverTrigger.receiver.oid },
        data: { consecutiveEventFailures: { increment: 1 } }
      });
      slateErrorService
        .recordSlateError({
          type: 'trigger_event_input_failed',
          errorCode: 'missing_input',
          errorMessage: 'Event input payload is missing.',
          tenantOid: eventInput.receiverTrigger.receiver.tenantOid,
          slateOid: eventInput.receiverTrigger.receiver.slateOid,
          slateInstanceOid: eventInput.receiverTrigger.receiver.slateInstanceOid,
          triggerReceiverOid: eventInput.receiverTrigger.receiver.oid,
          triggerEventInputOid: eventInput.oid
        })
        .catch(() => {});
      return;
    }
    if (eventInput.receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) {
      await this.updateEventInputStatus({
        eventInput,
        data: { status: SlateTriggerEventInputStatus.skipped }
      });
      return;
    }

    let attemptCount = eventInput.attemptCount + 1;
    await db.slateTriggerEventInput.update({
      where: { oid: eventInput.oid },
      data: {
        status: SlateTriggerEventInputStatus.processing,
        attemptCount,
        errorCode: null,
        errorMessage: null
      }
    });

    try {
      let context = await this.core.getInvocationContext({
        receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations
      });

      let stack = await this.core.createInvocationStack({
        receiver: eventInput.receiverTrigger.receiver,
        receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
        version: context.version,
        config: context.config,
        auth: context.auth
      });

      let mapRes = await slateInvocationService.invokeTriggerMapper({
        stack,
        actionId: context.action.key,
        input: eventInput.input as Record<string, any>
      });

      if (mapRes.status === 'error') {
        await this.core.recordTriggerInvocation({
          receiver: eventInput.receiverTrigger.receiver,
          receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
          type: SlateTriggerInvocationType.map_event,
          invocation: mapRes.invocation
        });

        let status =
          attemptCount >= MAX_TRIGGER_EVENT_INPUT_ATTEMPTS
            ? SlateTriggerEventInputStatus.failed
            : SlateTriggerEventInputStatus.retrying;
        await this.updateEventInputStatus({
          eventInput,
          data: {
            status,
            errorCode: mapRes.error.code,
            errorMessage: mapRes.error.message
          }
        });
        await db.slateTriggerReceiver.update({
          where: { oid: eventInput.receiverTrigger.receiver.oid },
          data: { consecutiveEventFailures: { increment: 1 } }
        });
        slateErrorService
          .recordSlateError({
            type: 'trigger_event_input_failed',
            errorCode: mapRes.error.code,
            errorMessage: mapRes.error.message,
            tenantOid: eventInput.receiverTrigger.receiver.tenantOid,
            slateOid: eventInput.receiverTrigger.receiver.slateOid,
            slateInstanceOid: eventInput.receiverTrigger.receiver.slateInstanceOid,
            invocationOid: mapRes.invocation.oid,
            triggerReceiverOid: eventInput.receiverTrigger.receiver.oid,
            triggerEventInputOid: eventInput.oid
          })
          .catch(() => {});

        if (status === SlateTriggerEventInputStatus.retrying) {
          await slateTriggerEventProcessQueue.add(
            { eventInputId: eventInput.id },
            { delay: Math.min(30_000, 1000 * 2 ** attemptCount) }
          );
        }

        return;
      }
      await db.slateTriggerReceiver.update({
        where: { oid: eventInput.receiverTrigger.receiver.oid },
        data: { consecutiveEventFailures: 0 }
      });

      let existing = await db.slateTriggerEvent.findFirst({
        where: {
          receiverTriggerOid: eventInput.receiverTrigger.oid,
          sourceId: mapRes.data.id
        }
      });

      if (existing) {
        if (existing.deliveryStatus === SlateTriggerEventDeliveryStatus.pending) {
          await slateTriggerEventSendQueue.add({ eventId: existing.id }, { id: existing.id });
        }

        await this.core.recordTriggerInvocation({
          receiver: eventInput.receiverTrigger.receiver,
          receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
          eventOid: existing.oid,
          type: SlateTriggerInvocationType.map_event,
          invocation: mapRes.invocation
        });

        await this.updateEventInputStatus({
          eventInput,
          data: {
            status: SlateTriggerEventInputStatus.skipped,
            eventOid: existing.oid
          }
        });

        return;
      }

      let createdAt = new Date();
      let eventRecord = getId('slateTriggerEvent');
      let receiver = eventInput.receiverTrigger.receiver;
      let targets = this.core.resolveTriggerDestinations({
        receiver,
        eventType: mapRes.data.type
      });

      let signalEventId = await this.core.createSignalEvent({
        receiver,
        action: context.action,
        event: {
          id: eventRecord.id,
          type: mapRes.data.type,
          sourceId: mapRes.data.id,
          output: mapRes.data.output,
          createdAt
        },
        signalDestinationIds: targets.signalDestinationIds
      });

      let event = await db.slateTriggerEvent.create({
        data: {
          ...eventRecord,
          receiverOid: receiver.oid,
          receiverTriggerOid: eventInput.receiverTrigger.oid,
          actionOid: eventInput.receiverTrigger.actionOid,
          slateOid: receiver.slate.oid,
          slateInstanceOid: receiver.slateInstance.oid,
          type: mapRes.data.type,
          sourceId: mapRes.data.id,
          input: eventInput.input,
          output: mapRes.data.output,
          deliveryStatus: targets.shouldDeliver
            ? SlateTriggerEventDeliveryStatus.pending
            : SlateTriggerEventDeliveryStatus.skipped,
          signalEventId,
          invocationOid: mapRes.invocation.oid,
          createdAt
        }
      });

      await this.core.recordTriggerInvocation({
        receiver: eventInput.receiverTrigger.receiver,
        receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
        eventOid: event.oid,
        type: SlateTriggerInvocationType.map_event,
        invocation: mapRes.invocation
      });

      await this.updateEventInputStatus({
        eventInput,
        data: {
          status: SlateTriggerEventInputStatus.succeeded,
          eventOid: event.oid
        }
      });

      if (targets.shouldDeliver) {
        await slateTriggerEventSendQueue.add({ eventId: event.id }, { id: event.id });
      }
    } catch (error) {
      Sentry.captureException(error, {
        extra: { eventInputId: eventInput.id }
      });

      let status =
        attemptCount >= MAX_TRIGGER_EVENT_INPUT_ATTEMPTS
          ? SlateTriggerEventInputStatus.failed
          : SlateTriggerEventInputStatus.retrying;
      let errorMessage =
        error instanceof Error ? error.message : 'Unexpected error while processing trigger';
      let errorCode = 'unexpected_error';
      if (typeof error === 'object' && error && 'code' in error) {
        let possibleCode = (error as { code?: string }).code;
        if (typeof possibleCode === 'string') {
          errorCode = possibleCode;
        }
      }

      await this.updateEventInputStatus({
        eventInput,
        data: {
          status,
          errorCode,
          errorMessage
        }
      });
      await db.slateTriggerReceiver.update({
        where: { oid: eventInput.receiverTrigger.receiver.oid },
        data: { consecutiveEventFailures: { increment: 1 } }
      });
      slateErrorService
        .recordSlateError({
          type: 'trigger_event_input_failed',
          errorCode,
          errorMessage,
          tenantOid: eventInput.receiverTrigger.receiver.tenantOid,
          slateOid: eventInput.receiverTrigger.receiver.slateOid,
          slateInstanceOid: eventInput.receiverTrigger.receiver.slateInstanceOid,
          triggerReceiverOid: eventInput.receiverTrigger.receiver.oid,
          triggerEventInputOid: eventInput.oid
        })
        .catch(() => {});

      if (status === SlateTriggerEventInputStatus.retrying) {
        await slateTriggerEventProcessQueue.add(
          { eventInputId: eventInput.id },
          { delay: Math.min(30_000, 1000 * 2 ** attemptCount) }
        );
      }
    }
  }

  private async updateEventInputStatus(d: {
    eventInput: { oid: bigint; id: string };
    data: {
      status: SlateTriggerEventInputStatus;
      errorCode?: string | null;
      errorMessage?: string | null;
      eventOid?: bigint | null;
    };
  }) {
    await db.slateTriggerEventInput.update({
      where: { oid: d.eventInput.oid },
      data: d.data
    });

    if (ARCHIVE_INPUT_STATUSES.has(d.data.status)) {
      await this.enqueueEventInputArchive(d.eventInput.id);
    }
  }

  private async enqueueEventInputArchive(eventInputId: string) {
    try {
      await slateTriggerEventInputArchiveQueue.add({ eventInputId }, { id: eventInputId });
    } catch (error) {
      console.error('Failed to enqueue trigger event input archive:', {
        eventInputId,
        error
      });
    }
  }

  async sendTriggerEvent(d: { eventId: string }) {
    let event = await db.slateTriggerEvent.findFirst({
      where: { id: d.eventId },
      include: {
        action: true,
        receiverTrigger: {
          include: receiverTriggerInclude
        }
      }
    });
    if (!event) throw new ServiceError(notFoundError('slate.trigger.event'));

    if (event.deliveryStatus !== SlateTriggerEventDeliveryStatus.pending) return;
    if (event.receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) {
      await db.slateTriggerEvent.update({
        where: { oid: event.oid },
        data: { deliveryStatus: SlateTriggerEventDeliveryStatus.skipped }
      });
      return;
    }

    await this.core.dispatchTriggerEvent({
      receiverTrigger: event.receiverTrigger as ReceiverTriggerWithRelations,
      action: event.action,
      event: {
        oid: event.oid,
        id: event.id,
        type: event.type,
        sourceId: event.sourceId,
        output: event.output as Record<string, any>,
        createdAt: event.createdAt,
        signalEventId: event.signalEventId
      }
    });
  }

  async registerWebhookForReceiverTrigger(d: {
    receiverTrigger: ReceiverTriggerWithRelations | SlateTriggerReceiverTrigger;
  }) {
    let receiverTrigger =
      'receiver' in d.receiverTrigger
        ? (d.receiverTrigger as ReceiverTriggerWithRelations)
        : await this.core.getReceiverTriggerWithRelations(d.receiverTrigger.id);

    let spec = getTriggerSpec(receiverTrigger.action);

    if (
      spec.invocation.type !== SlateTriggerReceiverTriggerSource.webhook ||
      !spec.invocation.autoRegistration
    ) {
      return;
    }

    let context = await this.core.getInvocationContext({ receiverTrigger });

    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });

    let res = await slateInvocationService.registerWebhook({
      stack,
      actionId: context.action.key,
      webhookBaseUrl: getTriggerWebhookBaseUrl(receiverTrigger.id)
    });

    await this.core.recordTriggerInvocation({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      type: SlateTriggerInvocationType.webhook_register,
      invocation: res.invocation
    });

    if (res.status === 'error') {
      console.error('Failed to register trigger webhook:', {
        receiverTriggerId: receiverTrigger.id,
        error: res.error
      });
      return;
    }

    await db.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        registrationDetails: res.data.registrationDetails ?? null,
        state: res.data.state ?? receiverTrigger.state
      }
    });
  }

  async registerWebhookForReceiverTriggerId(d: { receiverTriggerId: string }) {
    let receiverTrigger = await this.core.getReceiverTriggerWithRelations(d.receiverTriggerId);
    await this.registerWebhookForReceiverTrigger({ receiverTrigger });
  }

  async unregisterWebhookForReceiverTrigger(d: {
    receiverTrigger: ReceiverTriggerWithRelations | SlateTriggerReceiverTrigger;
  }) {
    let receiverTrigger =
      'receiver' in d.receiverTrigger
        ? (d.receiverTrigger as ReceiverTriggerWithRelations)
        : await this.core.getReceiverTriggerWithRelations(d.receiverTrigger.id);

    let spec = getTriggerSpec(receiverTrigger.action);

    if (
      spec.invocation.type !== SlateTriggerReceiverTriggerSource.webhook ||
      !spec.invocation.autoUnregistration
    ) {
      return;
    }

    if (!receiverTrigger.registrationDetails) return;

    let context = await this.core.getInvocationContext({ receiverTrigger });

    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });

    let res = await slateInvocationService.unregisterWebhook({
      stack,
      actionId: context.action.key,
      webhookBaseUrl: getTriggerWebhookBaseUrl(receiverTrigger.id),
      registrationDetails: receiverTrigger.registrationDetails,
      state: receiverTrigger.state
    });

    await this.core.recordTriggerInvocation({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      type: SlateTriggerInvocationType.webhook_unregister,
      invocation: res.invocation
    });

    if (res.status === 'error') {
      console.error('Failed to unregister trigger webhook:', {
        receiverTriggerId: receiverTrigger.id,
        error: res.error
      });
      return;
    }

    await db.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        registrationDetails: null
      }
    });
  }

  async unregisterWebhookForReceiverTriggerId(d: { receiverTriggerId: string }) {
    let receiverTrigger = await this.core.getReceiverTriggerWithRelations(d.receiverTriggerId);
    await this.unregisterWebhookForReceiverTrigger({ receiverTrigger });
  }

  async pollTriggerReceiverTrigger(d: { receiverTriggerId: string }) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: {
        id: d.receiverTriggerId
      },
      include: receiverTriggerInclude
    });
    if (!receiverTrigger)
      throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));

    if (receiverTrigger.source !== SlateTriggerReceiverTriggerSource.polling) return;
    if (receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) return;

    let context = await this.core.getInvocationContext({ receiverTrigger });

    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });

    let pollRes = await slateInvocationService.pollTriggerForEvents({
      stack,
      actionId: context.action.key,
      state: receiverTrigger.state
    });

    await this.core.recordTriggerInvocation({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      type: SlateTriggerInvocationType.poll,
      invocation: pollRes.invocation
    });

    let now = new Date();
    let nextPollAt = receiverTrigger.pollIntervalSeconds
      ? new Date(now.getTime() + receiverTrigger.pollIntervalSeconds * 1000)
      : null;

    if (pollRes.status === 'error') {
      console.error('Failed to poll trigger receiver:', {
        receiverTriggerId: receiverTrigger.id,
        error: pollRes.error
      });
      await db.slateTriggerReceiverTrigger.update({
        where: { oid: receiverTrigger.oid },
        data: {
          lastPolledAt: now,
          nextPollAt
        }
      });
      await db.slateTriggerReceiver.update({
        where: { oid: receiverTrigger.receiver.oid },
        data: { consecutivePollingFailures: { increment: 1 } }
      });
      return;
    }

    await db.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        state:
          pollRes.data.updatedState !== undefined
            ? pollRes.data.updatedState
            : receiverTrigger.state,
        lastPolledAt: now,
        nextPollAt
      }
    });
    await db.slateTriggerReceiver.update({
      where: { oid: receiverTrigger.receiver.oid },
      data: { consecutivePollingFailures: 0 }
    });

    await this.core.enqueueTriggerEventInputs({
      receiverTrigger,
      inputs: pollRes.data.inputs
    });
  }

  async handleTriggerWebhook(d: {
    receiverTriggerId: string;
    request: TriggerWebhookRequestPayload;
  }) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: {
        id: d.receiverTriggerId
      },
      include: receiverTriggerInclude
    });
    if (!receiverTrigger)
      throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));

    if (receiverTrigger.source !== SlateTriggerReceiverTriggerSource.webhook) return;
    if (receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) return;

    let context = await this.core.getInvocationContext({ receiverTrigger });

    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });

    let res = await slateInvocationService.handleWebhookRequest({
      stack,
      actionId: context.action.key,
      url: d.request.url,
      method: d.request.method,
      headers: d.request.headers,
      body: d.request.body ?? null,
      state: receiverTrigger.state
    });

    await this.core.recordTriggerInvocation({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      type: SlateTriggerInvocationType.webhook_handle,
      invocation: res.invocation
    });

    if (res.status === 'error') {
      console.error('Failed to handle trigger webhook:', {
        receiverTriggerId: receiverTrigger.id,
        error: res.error
      });
      return;
    }

    await db.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        state:
          res.data.updatedState !== undefined ? res.data.updatedState : receiverTrigger.state
      }
    });

    await this.core.enqueueTriggerEventInputs({
      receiverTrigger,
      inputs: res.data.inputs
    });
  }
}
