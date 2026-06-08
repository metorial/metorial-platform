import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import {
  getTriggerWebhookRequestStorageKey,
  type TriggerWebhookRequestPayload
} from '../../lib/triggerWebhook';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import { invocationsBucketRecord, storage } from '../../storage';

let Sentry = getSentry();

export type TriggerWebhookQueuePayload = {
  webhookRequestId: string;
};

export let slateTriggerWebhookQueue = createQueue<TriggerWebhookQueuePayload>({
  name: 'shub/trg/webhook',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 10_000
    }
  }
});

let webhookLock = createLock({
  name: 'shub/trg/webhook/lock',
  redisUrl: env.service.REDIS_URL
});

type TriggerWebhookBody = TriggerWebhookRequestPayload['body'];

let finalizeWebhookRequest = async (d: {
  request: {
    id: string;
    receiverTriggerId: string | null;
    receiverId: string | null;
    url: string;
    method: string;
    headers: Record<string, string>;
    createdAt: Date;
  };
  body: TriggerWebhookBody;
  bodyStorageKey: string | null;
}) => {
  if (d.body && d.bodyStorageKey) {
    await storage.putObject(
      invocationsBucketRecord.bucket,
      d.bodyStorageKey,
      JSON.stringify({
        id: d.request.id,
        receiverTriggerId: d.request.receiverTriggerId,
        receiverId: d.request.receiverId,
        url: d.request.url,
        method: d.request.method,
        headers: d.request.headers,
        body: d.body,
        createdAt: d.request.createdAt
      })
    );
  }

  await db.slateTriggerWebhookRequest.update({
    where: { id: d.request.id },
    data: {
      processedAt: new Date(),
      bodyStorageKey: d.bodyStorageKey,
      body: null
    }
  });
};

export let slateTriggerWebhookQueueProcessor = slateTriggerWebhookQueue.process(async data => {
  try {
    let request = await db.slateTriggerWebhookRequest.findFirst({
      where: { id: data.webhookRequestId }
    });
    if (!request || request.processedAt) return;

    let headers = request.headers as Record<string, string>;
    let body = request.body as TriggerWebhookBody;
    let bodyStorageKey = body ? getTriggerWebhookRequestStorageKey(request.id) : null;

    if (request.receiverTriggerId) {
      let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
        where: { id: request.receiverTriggerId },
        select: { id: true }
      });
      if (!receiverTrigger) {
        await finalizeWebhookRequest({
          request: {
            id: request.id,
            receiverTriggerId: request.receiverTriggerId,
            receiverId: request.receiverId,
            url: request.url,
            method: request.method,
            headers,
            createdAt: request.createdAt
          },
          body,
          bodyStorageKey
        });
        return;
      }

      return webhookLock.usingLock(receiverTrigger.id, async () => {
        await slateTriggerReceiverService.handleTriggerWebhook({
          receiverTriggerId: receiverTrigger.id,
          request: {
            url: request.url,
            method: request.method,
            headers,
            body
          }
        });

        await finalizeWebhookRequest({
          request: {
            id: request.id,
            receiverTriggerId: request.receiverTriggerId,
            receiverId: request.receiverId,
            url: request.url,
            method: request.method,
            headers,
            createdAt: request.createdAt
          },
          body,
          bodyStorageKey
        });
      });
    }

    if (request.receiverId) {
      let receiver = await db.slateTriggerReceiver.findFirst({
        where: { id: request.receiverId },
        select: { id: true }
      });
      if (!receiver) {
        await finalizeWebhookRequest({
          request: {
            id: request.id,
            receiverTriggerId: request.receiverTriggerId,
            receiverId: request.receiverId,
            url: request.url,
            method: request.method,
            headers,
            createdAt: request.createdAt
          },
          body,
          bodyStorageKey
        });
        return;
      }

      return webhookLock.usingLock(`receiver:${receiver.id}`, async () => {
        await slateTriggerReceiverService.handleReceiverWebhook({
          receiverId: receiver.id,
          request: {
            url: request.url,
            method: request.method,
            headers,
            body
          }
        });

        await finalizeWebhookRequest({
          request: {
            id: request.id,
            receiverTriggerId: request.receiverTriggerId,
            receiverId: request.receiverId,
            url: request.url,
            method: request.method,
            headers,
            createdAt: request.createdAt
          },
          body,
          bodyStorageKey
        });
      });
    }

    await finalizeWebhookRequest({
      request: {
        id: request.id,
        receiverTriggerId: request.receiverTriggerId,
        receiverId: request.receiverId,
        url: request.url,
        method: request.method,
        headers,
        createdAt: request.createdAt
      },
      body,
      bodyStorageKey
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { webhookRequestId: data.webhookRequestId }
    });
    console.error('Failed to process trigger webhook request:', {
      webhookRequestId: data.webhookRequestId,
      error
    });
    throw new QueueRetryError();
  }
});
