import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getId } from '../id';
import type { TriggerWebhookRequestPayload } from '../lib/triggerWebhook';
import { slateTriggerWebhookQueue } from '../queues/trigger/webhook';

class slateTriggerWebhookRequestServiceImpl {
  async createWebhookRequest(d: {
    receiverTriggerId?: string;
    receiverId?: string;
    request: TriggerWebhookRequestPayload;
  }) {
    if (Boolean(d.receiverTriggerId) === Boolean(d.receiverId)) {
      throw new ServiceError(
        badRequestError({
          message: 'Exactly one webhook target is required.'
        })
      );
    }

    if (d.receiverTriggerId) {
      let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
        where: { id: d.receiverTriggerId },
        select: { id: true }
      });
      if (!receiverTrigger) {
        throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));
      }
    }

    if (d.receiverId) {
      let receiver = await db.slateTriggerReceiver.findFirst({
        where: { id: d.receiverId },
        select: { id: true }
      });
      if (!receiver) {
        throw new ServiceError(notFoundError('slate.trigger.receiver'));
      }
    }

    let record = await db.slateTriggerWebhookRequest.create({
      data: {
        ...getId('slateTriggerWebhookRequest'),
        receiverTriggerId: d.receiverTriggerId,
        receiverId: d.receiverId,
        url: d.request.url,
        method: d.request.method,
        headers: d.request.headers,
        body: d.request.body
      }
    });

    await slateTriggerWebhookQueue.add({
      webhookRequestId: record.id
    });

    return record;
  }
}

export let slateTriggerWebhookRequestService = Service.create(
  'slateTriggerWebhookRequestService',
  () => new slateTriggerWebhookRequestServiceImpl()
).build();
