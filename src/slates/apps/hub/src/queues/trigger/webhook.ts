import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import { dispatchCapturedWebhookWireRequest } from '../../lib/capturedWebhookDispatch';
import {
  processSlateTriggerWebhookQueueRequest,
  settleExactWebhookQueueResult
} from '../../lib/triggerWebhookQueueProcessing';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import {
  finalizeWebhookRequest,
  getSlateTriggerWebhookLock
} from '../../services/slateTriggerWebhookProcessing';
import { slateTriggerWebhookRequestService } from '../../services/slateTriggerWebhookRequest';
import { handleExhaustedWebhookFailure } from './webhookTerminalRepair';

let Sentry = getSentry();

export type TriggerWebhookQueuePayload = {
  webhookRequestId: string;
  claimToken: string;
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

let loadPendingWebhookRequest = async (webhookRequestId: string) => {
  let request = await db.slateTriggerWebhookRequest.findFirst({
    where: { id: webhookRequestId }
  });
  return request?.processedAt ? null : request;
};

let requestPayload = async (
  request: NonNullable<Awaited<ReturnType<typeof loadPendingWebhookRequest>>>
) =>
  await slateTriggerWebhookRequestService.loadDecryptedPayload({
    webhookRequestId: request.id,
    tenantId: request.tenantId ?? undefined,
    receiverId: request.receiverOwnerId ?? undefined
  });

let finalize = (
  request: NonNullable<Awaited<ReturnType<typeof loadPendingWebhookRequest>>>,
  claimToken: string
) =>
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
    body: null,
    queueClaimToken: claimToken
  });

export let slateTriggerWebhookQueueProcessor = slateTriggerWebhookQueue.process(
  async data => {
    let result: Awaited<ReturnType<typeof processSlateTriggerWebhookQueueRequest>>;
    try {
      result = await processSlateTriggerWebhookQueueRequest(data, {
        loadPendingRequest: loadPendingWebhookRequest,
        usingLock: (key, callback) => getSlateTriggerWebhookLock().usingLock(key, callback),
        claimQueueOwnership: async (request, claimToken, now) => {
          if (request.queueClaimToken !== claimToken) return 'invalid';
          if (request.queueClaimState === 'owned') return 'owned';
          if (request.queueClaimState !== 'prepared') return 'invalid';
          if (
            request.syncOwnerToken &&
            request.syncOwnerExpiresAt &&
            request.syncOwnerExpiresAt > now
          ) {
            return 'ownerActive';
          }
          let claimed = await db.slateTriggerWebhookRequest.updateMany({
            where: {
              id: request.id,
              processedAt: null,
              queueClaimToken: claimToken,
              queueClaimState: 'prepared',
              OR: [{ syncOwnerExpiresAt: null }, { syncOwnerExpiresAt: { lte: now } }]
            },
            data: {
              syncOwnerToken: null,
              syncOwnerExpiresAt: null,
              syncOwnerCommitStartedAt: null,
              queueClaimState: 'owned',
              queueClaimedAt: now
            }
          });
          return claimed.count === 1 ? 'owned' : 'ownerActive';
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
        handleTarget: async (
          request,
          excludeReceiverTriggerIds,
          onReceiverTriggerCompleted
        ) => {
          let finalizeRejected = async (code: string) =>
            await finalizeWebhookRequest({
              request: {
                id: request.id,
                receiverTriggerId: request.receiverTriggerId,
                receiverId: request.receiverId,
                url: request.url,
                method: request.method,
                headers: request.headers,
                createdAt: request.createdAt
              },
              body: null,
              queueClaimToken: data.claimToken,
              outcome: 'rejected',
              safeRejectionCode: code
            });
          if (request.receiverTriggerId) {
            if (!excludeReceiverTriggerIds.includes(request.receiverTriggerId)) {
              let exactResult = await dispatchCapturedWebhookWireRequest({
                request: await requestPayload(request),
                handle: wireRequest =>
                  slateTriggerReceiverService.handleCapturedTriggerWebhook({
                    receiverTriggerId: request.receiverTriggerId!,
                    requestId: request.id,
                    request: wireRequest
                  })
              });
              await settleExactWebhookQueueResult({
                result: exactResult,
                onRejected: async code => {
                  await finalizeRejected(code);
                },
                onAccepted: async () => {
                  await finalizeWebhookRequest({
                    request: {
                      id: request.id,
                      receiverTriggerId: request.receiverTriggerId,
                      receiverId: request.receiverId,
                      url: request.url,
                      method: request.method,
                      headers: request.headers,
                      createdAt: request.createdAt
                    },
                    body: null,
                    queueClaimToken: data.claimToken
                  });
                  await onReceiverTriggerCompleted(request.receiverTriggerId!);
                }
              });
            }
            return;
          }
          if (request.receiverId) {
            let exactResult = await dispatchCapturedWebhookWireRequest({
              request: await requestPayload(request),
              handle: wireRequest =>
                slateTriggerReceiverService.handleCapturedReceiverWebhook({
                  receiverId: request.receiverId!,
                  requestId: request.id,
                  excludeReceiverTriggerIds,
                  request: wireRequest,
                  onReceiverTriggerCompleted
                })
            });
            await settleExactWebhookQueueResult({
              result: exactResult,
              onRejected: async code => {
                await finalizeRejected(code);
              },
              onAccepted: async () => {
                await finalizeWebhookRequest({
                  request: {
                    id: request.id,
                    receiverTriggerId: request.receiverTriggerId,
                    receiverId: request.receiverId,
                    url: request.url,
                    method: request.method,
                    headers: request.headers,
                    createdAt: request.createdAt
                  },
                  body: null,
                  queueClaimToken: data.claimToken
                });
              }
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
        finalize: request => finalize(request, data.claimToken)
      });
    } catch (error) {
      Sentry.captureException(new Error('Trigger webhook queue processing failed'), {
        extra: { webhookRequestId: data.webhookRequestId }
      });
      console.error('Failed to process trigger webhook request:', {
        webhookRequestId: data.webhookRequestId,
        errorCode: 'webhook_processing_failed'
      });
      throw new QueueRetryError();
    }

    // An unexpired inline owner is normal control flow, not a failure — retry without alerting.
    if (result === 'ownerActive') throw new QueueRetryError();
  },
  {
    onFinalFailure: async ({ payload }) => {
      if (typeof payload.claimToken !== 'string' || payload.claimToken.length === 0) {
        // Generationless jobs predate claim ownership and cannot enter the terminal finalizer.
        return;
      }
      let request = await loadPendingWebhookRequest(payload.webhookRequestId);
      if (!request) return;
      await handleExhaustedWebhookFailure({
        requestId: request.id,
        claimToken: payload.claimToken,
        safeRejectionCode: 'webhook_processing_failed',
        finalize: async () =>
          await finalizeWebhookRequest({
            request: {
              id: request.id,
              receiverTriggerId: request.receiverTriggerId,
              receiverId: request.receiverId,
              url: request.url,
              method: request.method,
              headers: request.headers,
              createdAt: request.createdAt
            },
            body: null,
            queueClaimToken: payload.claimToken,
            outcome: 'failed',
            safeRejectionCode: 'webhook_processing_failed'
          })
      });
    }
  }
);
