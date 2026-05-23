import { notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { db } from '../db';
import { getId } from '../id';
import type { TriggerWebhookRequestPayload } from '../lib/triggerWebhook';
import { slateTriggerWebhookQueue } from '../queues/trigger/webhook';

class slateTriggerWebhookRequestServiceImpl {
  async createWebhookRequest(d: {
    receiverTriggerId: string;
    request: TriggerWebhookRequestPayload;
  }) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: { id: d.receiverTriggerId },
      select: { id: true }
    });
    if (!receiverTrigger) {
      throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));
    }

    let record = await db.slateTriggerWebhookRequest.create({
      data: {
        ...getId('slateTriggerWebhookRequest'),
        receiverTriggerId: d.receiverTriggerId,
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
