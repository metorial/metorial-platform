import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import type { TriggerWebhookRequestPayload } from '../../lib/triggerWebhook';
import { processSlateTriggerWebhookQueueRequest } from '../../lib/triggerWebhookQueueProcessing';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import {
  finalizeWebhookRequest,
  getSlateTriggerWebhookLock
} from '../../services/slateTriggerWebhookProcessing';

let Sentry = getSentry();

export type TriggerWebhookQueuePayload = {
  webhookRequestId: string;
  excludeReceiverTriggerIds?: string[];
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

type TriggerWebhookBody = TriggerWebhookRequestPayload['body'];

let loadPendingWebhookRequest = async (webhookRequestId: string) => {
  let request = await db.slateTriggerWebhookRequest.findFirst({
    where: { id: webhookRequestId }
  });
  return request?.processedAt ? null : request;
};

let requestPayload = (
  request: NonNullable<Awaited<ReturnType<typeof loadPendingWebhookRequest>>>
) => ({
  url: request.url,
  method: request.method,
  headers: request.headers as Record<string, string>,
  body: request.body as TriggerWebhookBody
});

let finalize = (request: NonNullable<Awaited<ReturnType<typeof loadPendingWebhookRequest>>>) =>
  finalizeWebhookRequest({
    request: {
      id: request.id,
      receiverTriggerId: request.receiverTriggerId,
      receiverId: request.receiverId,
      url: request.url,
      method: request.method,
      headers: request.headers as Record<string, string>,
      createdAt: request.createdAt
    },
    body: request.body as TriggerWebhookBody
  });

export let slateTriggerWebhookQueueProcessor = slateTriggerWebhookQueue.process(async data => {
  let result: Awaited<ReturnType<typeof processSlateTriggerWebhookQueueRequest>>;
  try {
    result = await processSlateTriggerWebhookQueueRequest(data, {
      loadPendingRequest: loadPendingWebhookRequest,
      usingLock: (key, callback) => getSlateTriggerWebhookLock().usingLock(key, callback),
      fenceExpiredOwner: async request => {
        await db.slateTriggerWebhookRequest.updateMany({
          where: {
            id: request.id,
            processedAt: null,
            syncOwnerToken: request.syncOwnerToken,
            syncOwnerExpiresAt: { lte: new Date() }
          },
          data: {
            syncOwnerToken: null,
            syncOwnerExpiresAt: null,
            syncOwnerCommitStartedAt: null
          }
        });
      },
      targetExists: async request => {
        if (request.receiverTriggerId) {
          return Boolean(
            await db.slateTriggerReceiverTrigger.findFirst({
              where: { id: request.receiverTriggerId },
              select: { id: true }
            })
          );
        }
        if (request.receiverId) {
          return Boolean(
            await db.slateTriggerReceiver.findFirst({
              where: { id: request.receiverId },
              select: { id: true }
            })
          );
        }
        return false;
      },
      handleTarget: async (request, excludeReceiverTriggerIds, onReceiverTriggerCompleted) => {
        if (request.receiverTriggerId) {
          if (!excludeReceiverTriggerIds.includes(request.receiverTriggerId)) {
            await slateTriggerReceiverService.handleTriggerWebhook({
              receiverTriggerId: request.receiverTriggerId,
              request: requestPayload(request)
            });
            await onReceiverTriggerCompleted(request.receiverTriggerId);
          }
          return;
        }
        if (request.receiverId) {
          await slateTriggerReceiverService.handleReceiverWebhook({
            receiverId: request.receiverId,
            excludeReceiverTriggerIds,
            request: requestPayload(request),
            onReceiverTriggerCompleted
          });
        }
      },
      checkpointTriggerCompleted: async (request, receiverTriggerId) => {
        await db.slateTriggerWebhookRequest.updateMany({
          where: {
            id: request.id,
            processedAt: null,
            NOT: { syncCompletedReceiverTriggerIds: { has: receiverTriggerId } }
          },
          data: {
            syncCompletedReceiverTriggerIds: { push: receiverTriggerId }
          }
        });
      },
      finalize
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

  // An unexpired inline owner is normal control flow, not a failure — retry without alerting.
  if (result === 'ownerActive') throw new QueueRetryError();
});
