import { notFoundError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import { randomUUID } from 'crypto';
import {
  SlateTriggerReceiverStatus,
  SlateTriggerReceiverTriggerSource,
  type SlateAction
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import type { TriggerWebhookRequestPayload } from '../lib/triggerWebhook';
import { webhookRequestMatches } from '../lib/triggerWebhookSync';
import {
  getSyncFallbackQueuePayload,
  planSyncCandidateResult,
  runWithHardSyncOwnershipBoundary
} from '../lib/triggerWebhookSyncOwnership';
import { slateTriggerReceiverService } from './slateTriggerReceiver';
import {
  getTriggerSpec,
  receiverInclude,
  receiverTriggerInclude,
  webhookTriggerAllowsMethod,
  type WebhookHttpMethod,
  type WebhookHttpResponse
} from './slateTriggerReceiverShared';
import {
  finalizeWebhookRequest,
  getSlateTriggerWebhookLock
} from './slateTriggerWebhookProcessing';
import { slateTriggerWebhookRequestService } from './slateTriggerWebhookRequest';

let Sentry = getSentry();

let DEFAULT_SYNC_TIMEOUT_MS = 6_000;
let MAX_SYNC_TIMEOUT_MS = 15_000;
let SHORT_LOCK_RETRY_DELAY_MS = 125;
// Provider manifests are capped at the AWS Lambda hard maximum of 900 seconds. This finite
// owner boundary includes 30 seconds for Function Bay transport and fenced Hub bookkeeping.
let HARD_SYNC_OWNERSHIP_MS = 15 * 60 * 1_000 + 30_000;

let ALL_WEBHOOK_METHODS: WebhookHttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
];

type WebhookTarget =
  | {
      type: 'receiverTrigger';
      receiverTriggerId: string;
      receiverId: null;
    }
  | {
      type: 'receiver';
      receiverTriggerId: null;
      receiverId: string;
    };

let waitForInvocationAfterDeadline = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  onDeadline: () => void
) => {
  let timer = setTimeout(onDeadline, timeoutMs);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
};

let getTotalSyncTimeoutMs = () => {
  let configured = env.slates.SLATES_WEBHOOK_SYNC_TIMEOUT_MS ?? DEFAULT_SYNC_TIMEOUT_MS;
  return Math.max(1, Math.min(configured, MAX_SYNC_TIMEOUT_MS));
};

let getAllowedMethodsForTriggers = (triggers: Array<{ action: SlateAction }>) => {
  let allowed = new Set<WebhookHttpMethod>(['POST']);

  for (let trigger of triggers) {
    let spec = getTriggerSpec(trigger.action);
    if (spec.invocation.type !== SlateTriggerReceiverTriggerSource.webhook) continue;
    for (let method of spec.invocation.http?.methods ?? ['POST']) allowed.add(method);
  }

  return ALL_WEBHOOK_METHODS.filter(method => allowed.has(method));
};

let getSyncCandidates = (
  triggers: Array<{ id: string; oid: bigint; action: SlateAction }>,
  requestMethod: string
) =>
  triggers
    .flatMap(trigger => {
      let spec = getTriggerSpec(trigger.action);
      if (spec.invocation.type !== SlateTriggerReceiverTriggerSource.webhook) return [];
      if (!webhookTriggerAllowsMethod(trigger.action, requestMethod)) return [];

      let sync = spec.invocation.http?.sync;
      if (!sync || sync.mode === 'never') return [];

      return [
        {
          id: trigger.id,
          oid: trigger.oid,
          sync
        }
      ];
    })
    .sort((a, b) => (a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : 0));

class slateTriggerWebhookSyncServiceImpl {
  private async loadTarget(d: { receiverTriggerId?: string; receiverId?: string }) {
    if (d.receiverTriggerId) {
      let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
        where: { id: d.receiverTriggerId },
        include: receiverTriggerInclude
      });
      if (!receiverTrigger) {
        throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));
      }

      return {
        target: {
          type: 'receiverTrigger',
          receiverTriggerId: receiverTrigger.id,
          receiverId: null
        } satisfies WebhookTarget,
        active: receiverTrigger.receiver.status === SlateTriggerReceiverStatus.active,
        triggers: [receiverTrigger]
      };
    }

    if (d.receiverId) {
      let receiver = await db.slateTriggerReceiver.findFirst({
        where: { id: d.receiverId },
        include: receiverInclude
      });
      if (!receiver) throw new ServiceError(notFoundError('slate.trigger.receiver'));

      return {
        target: {
          type: 'receiver',
          receiverTriggerId: null,
          receiverId: receiver.id
        } satisfies WebhookTarget,
        active: receiver.status === SlateTriggerReceiverStatus.active,
        triggers: receiver.triggers.filter(
          trigger => trigger.source === SlateTriggerReceiverTriggerSource.webhook
        )
      };
    }

    throw new Error('A webhook target is required.');
  }

  async handleWebhookRequest(d: {
    receiverTriggerId?: string;
    receiverId?: string;
    request: TriggerWebhookRequestPayload;
  }): Promise<
    | { type: 'methodNotAllowed'; allowedMethods: WebhookHttpMethod[] }
    | { type: 'queued'; webhookRequestId: string }
    | { type: 'response'; webhookRequestId: string; response: WebhookHttpResponse }
  > {
    let target = await this.loadTarget(d);
    let requestRecord = await slateTriggerWebhookRequestService.createWebhookRequest({
      receiverTriggerId: target.target.receiverTriggerId ?? undefined,
      receiverId: target.target.receiverId ?? undefined,
      request: d.request,
      enqueue: false
    });
    let finalize = (ownerToken?: string) =>
      finalizeWebhookRequest({
        request: {
          id: requestRecord.id,
          receiverTriggerId: requestRecord.receiverTriggerId,
          receiverId: requestRecord.receiverId,
          url: requestRecord.url,
          method: requestRecord.method,
          headers: requestRecord.headers as Record<string, string>,
          createdAt: requestRecord.createdAt
        },
        body: d.request.body,
        ownerToken
      });

    let allowedMethods = getAllowedMethodsForTriggers(target.triggers);
    let method = d.request.method.toUpperCase();
    if (method !== 'POST' && !allowedMethods.includes(method as WebhookHttpMethod)) {
      await finalize();
      return { type: 'methodNotAllowed', allowedMethods };
    }

    let applicableTriggers = target.triggers.filter(trigger =>
      webhookTriggerAllowsMethod(trigger.action, method)
    );

    let candidates = target.active
      ? getSyncCandidates(applicableTriggers, method).filter(candidate => {
          return (
            candidate.sync.mode === 'always' ||
            (candidate.sync.mode === 'match' &&
              (candidate.sync.match ?? []).some(matcher =>
                webhookRequestMatches(d.request, matcher)
              ))
          );
        })
      : [];

    if (candidates.length === 0) {
      await slateTriggerWebhookRequestService.enqueueWebhookRequest({
        webhookRequestId: requestRecord.id
      });
      return { type: 'queued', webhookRequestId: requestRecord.id };
    }

    let ownerToken = randomUUID();
    let ownerExpiresAt = new Date(Date.now() + HARD_SYNC_OWNERSHIP_MS);

    // Persist the delayed owner before claiming or invoking inline work. If this process exits
    // at any later instruction, BullMQ still has a durable takeover scheduled for the same hard
    // boundary used by the ownership fence below. Hub has no webhook outbox/reconciler, so the
    // row-create to first Redis publish gap remains the queue producer's pre-existing boundary.
    await slateTriggerWebhookRequestService.enqueueWebhookRequest({
      webhookRequestId: requestRecord.id,
      delayMs: HARD_SYNC_OWNERSHIP_MS,
      jobId: `sync-fallback-${requestRecord.id}`
    });
    let claimedOwnership = await slateTriggerWebhookRequestService.claimSyncOwnership({
      webhookRequestId: requestRecord.id,
      ownerToken,
      expiresAt: ownerExpiresAt
    });
    if (!claimedOwnership) {
      return { type: 'queued', webhookRequestId: requestRecord.id };
    }

    let processedReceiverTriggerIds: string[] = [];
    let startedAt = Date.now();
    let totalTimeoutMs = getTotalSyncTimeoutMs();
    let lockKey =
      target.target.type === 'receiver'
        ? `receiver:${target.target.receiverId}`
        : target.target.receiverTriggerId;
    let publicResultSettled = false;
    let resolvePublicResult!: (
      value:
        | { type: 'queued'; webhookRequestId: string }
        | { type: 'response'; webhookRequestId: string; response: WebhookHttpResponse }
    ) => void;
    let rejectPublicResult!: (reason?: unknown) => void;
    let publicResult = new Promise<
      | { type: 'queued'; webhookRequestId: string }
      | { type: 'response'; webhookRequestId: string; response: WebhookHttpResponse }
    >((resolve, reject) => {
      resolvePublicResult = resolve;
      rejectPublicResult = reject;
    });
    let settlePublicResult = (
      result:
        | { type: 'queued'; webhookRequestId: string }
        | { type: 'response'; webhookRequestId: string; response: WebhookHttpResponse }
    ) => {
      if (publicResultSettled) return;
      publicResultSettled = true;
      resolvePublicResult(result);
    };
    let settleQueued = () =>
      settlePublicResult({ type: 'queued', webhookRequestId: requestRecord.id });
    let ownsContinuation = () =>
      slateTriggerWebhookRequestService.ownsSyncContinuation({
        webhookRequestId: requestRecord.id,
        ownerToken
      });

    let processCandidates = async () => {
      let commitActive = false;

      for (let [candidateIndex, candidate] of candidates.entries()) {
        if (!(await ownsContinuation())) return { type: 'abandoned' as const };

        let remainingMs = totalTimeoutMs - (Date.now() - startedAt);
        let invocation = runWithHardSyncOwnershipBoundary(
          enterCommit =>
            slateTriggerReceiverService.handleTriggerWebhook({
              receiverTriggerId: candidate.id,
              request: d.request,
              invocationGuard: ownsContinuation,
              enterCommit
            }),
          {
            timeoutMs: Math.max(1, ownerExpiresAt.getTime() - Date.now()),
            enterCommit: async () => {
              let entered = await slateTriggerWebhookRequestService.enterSyncCommit({
                webhookRequestId: requestRecord.id,
                ownerToken
              });
              if (entered) commitActive = true;
              return entered;
            },
            onLateError: error => {
              Sentry.captureException(error, {
                extra: { webhookRequestId: requestRecord.id, phase: 'late_sync_rpc' }
              });
            }
          }
        );
        let ownershipResult =
          remainingMs <= 0
            ? (settleQueued(), await invocation)
            : await waitForInvocationAfterDeadline(
                invocation,
                Math.min(remainingMs, candidate.sync.timeoutMs ?? totalTimeoutMs),
                settleQueued
              );

        if (ownershipResult.type === 'expired') return { type: 'abandoned' as const };
        let result = ownershipResult.value;
        let plan = planSyncCandidateResult(result, {
          candidateIndex,
          candidateCount: candidates.length
        });
        if (plan.type === 'abandoned') return { type: 'abandoned' as const };
        if (plan.type === 'fallback') {
          throw new Error(`Webhook sync provider invocation failed for ${candidate.id}.`);
        }

        let recorded =
          plan.checkpoint === 'skipped'
            ? await slateTriggerWebhookRequestService.recordSyncTriggerSkipped({
                webhookRequestId: requestRecord.id,
                ownerToken,
                receiverTriggerId: candidate.id
              })
            : await slateTriggerWebhookRequestService.completeSyncTriggerCommit({
                webhookRequestId: requestRecord.id,
                ownerToken,
                receiverTriggerId: candidate.id,
                continueRpc: plan.continueRpc
              });
        if (!recorded) return { type: 'abandoned' as const };

        if (plan.continueRpc) commitActive = false;
        processedReceiverTriggerIds.push(candidate.id);
        if (plan.response) {
          return { type: 'completed' as const, response: plan.response };
        }
      }

      if (!commitActive) {
        commitActive = await slateTriggerWebhookRequestService.enterSyncCommit({
          webhookRequestId: requestRecord.id,
          ownerToken
        });
        if (!commitActive) return { type: 'abandoned' as const };
      }

      return { type: 'completed' as const, response: undefined };
    };

    let processing = (async () => {
      try {
        let ownershipResult = await getSlateTriggerWebhookLock().usingLock(
          lockKey,
          async () => {
            try {
              let candidateResult = await processCandidates();
              if (candidateResult.type === 'abandoned') return candidateResult;

              let remainingTriggers = applicableTriggers.filter(
                trigger => !processedReceiverTriggerIds.includes(trigger.id)
              );
              if (remainingTriggers.length > 0) {
                await slateTriggerWebhookRequestService.releaseSyncOwnership({
                  webhookRequestId: requestRecord.id,
                  ownerToken
                });
                await slateTriggerWebhookRequestService.enqueueWebhookRequest({
                  webhookRequestId: requestRecord.id,
                  excludeReceiverTriggerIds: processedReceiverTriggerIds
                });
              } else {
                await finalize(ownerToken);
              }

              return candidateResult;
            } catch (error) {
              Sentry.captureException(error, {
                extra: {
                  webhookRequestId: requestRecord.id,
                  receiverId: target.target.receiverId,
                  receiverTriggerId: target.target.receiverTriggerId
                }
              });
              console.error(
                'Failed to process webhook synchronously; falling back to queue:',
                {
                  webhookRequestId: requestRecord.id,
                  error
                }
              );

              await slateTriggerWebhookRequestService.releaseSyncOwnership({
                webhookRequestId: requestRecord.id,
                ownerToken
              });
              await slateTriggerWebhookRequestService.enqueueWebhookRequest(
                getSyncFallbackQueuePayload(requestRecord.id, processedReceiverTriggerIds)
              );
              return { type: 'fallback' as const };
            }
          },
          {
            retryCount: 1,
            retryDelay: SHORT_LOCK_RETRY_DELAY_MS,
            retryJitter: 0
          }
        );

        let candidateResult = ownershipResult;
        if (candidateResult.type === 'abandoned') {
          // The durable fallback owner takes over; make sure the caller is never left hanging.
          settleQueued();
          return;
        }
        if (candidateResult.type === 'fallback') {
          settleQueued();
          return;
        }

        settlePublicResult(
          candidateResult.response
            ? {
                type: 'response',
                webhookRequestId: requestRecord.id,
                response: candidateResult.response
              }
            : { type: 'queued', webhookRequestId: requestRecord.id }
        );
      } catch (error) {
        Sentry.captureException(error, {
          extra: {
            webhookRequestId: requestRecord.id,
            receiverId: target.target.receiverId,
            receiverTriggerId: target.target.receiverTriggerId
          }
        });
        console.error('Failed to process webhook synchronously; falling back to queue:', {
          webhookRequestId: requestRecord.id,
          error
        });

        await slateTriggerWebhookRequestService.releaseSyncOwnership({
          webhookRequestId: requestRecord.id,
          ownerToken
        });
        await slateTriggerWebhookRequestService.enqueueWebhookRequest(
          getSyncFallbackQueuePayload(requestRecord.id, processedReceiverTriggerIds)
        );
        settleQueued();
      }
    })();

    void processing.catch(error => {
      Sentry.captureException(error, { extra: { webhookRequestId: requestRecord.id } });
      console.error('Webhook sync fallback orchestration failed:', {
        webhookRequestId: requestRecord.id,
        error
      });
      if (!publicResultSettled) {
        publicResultSettled = true;
        rejectPublicResult(error);
      }
    });

    return publicResult;
  }
}

export let slateTriggerWebhookSyncService = Service.create(
  'slateTriggerWebhookSyncService',
  () => new slateTriggerWebhookSyncServiceImpl()
).build();
