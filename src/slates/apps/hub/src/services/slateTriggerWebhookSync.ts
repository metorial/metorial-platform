import { notFoundError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import { randomUUID } from 'crypto';
import type { SafeWebhookRejectionCode, WebhookWireResponse } from '@slates/proto';
import {
  SlateTriggerReceiverStatus,
  SlateTriggerReceiverTriggerSource,
  type SlateAction
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import {
  adaptWebhookWireRequestForProviderInvocation,
  type WebhookWireRequest
} from '../lib/webhookWire';
import type { WebhookCapturePolicy } from '../lib/webhookCapturePolicy';
import { webhookWireRequestMatches } from '../lib/triggerWebhookSync';
import {
  planSyncCandidateResult,
  runWithHardSyncOwnershipBoundary
} from '../lib/triggerWebhookSyncOwnership';
import { slateTriggerReceiverService } from './slateTriggerReceiver';
import { actionVerificationDeclaration } from './slateTriggerRegistrationLifecycle';
import { authenticateReceiverRouteBoundary } from './slateTriggerWebhookAuthenticatedBoundary';
import {
  getTriggerSpec,
  isRoutableWebhookReceiverTrigger,
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

let adaptExactWebhookResponse = (response: WebhookWireResponse): WebhookHttpResponse => ({
  status: response.status,
  headers: Object.fromEntries(response.headers),
  body: response.body.present
    ? {
        encoding: 'base64' as const,
        content: response.body.base64
      }
    : null
});

let exactWebhookFailureResponse = (
  code: SafeWebhookRejectionCode | 'sync_deadline_exceeded' | 'mixed_sync_authority'
): WebhookHttpResponse => {
  let status =
    code === 'sync_deadline_exceeded' ||
    code === 'provider_timeout' ||
    code === 'state_cas_conflict'
      ? 503
      : code === 'mixed_sync_authority' ||
          code === 'conflicting_rule_outcomes' ||
          code === 'conflicting_sync_responses'
        ? 409
        : code.startsWith('credential_') || code === 'security_header_ambiguous'
          ? 401
          : 400;
  return {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: { encoding: 'base64', content: Buffer.from(code).toString('base64') }
  };
};

export let getSyncCandidates = (
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
      let ingress = (
        spec.invocation.http as {
          ingress?: {
            kind?: string;
            verification?: {
              mechanism?: string;
              rules?: Array<{
                result?: {
                  type?: string;
                };
              }>;
            };
          };
        }
      )?.ingress;
      let hasHubSyncOnlyAuthority =
        ingress?.kind === 'receiver_route' &&
        ingress.verification?.mechanism === 'hub' &&
        ingress.verification.rules?.some(rule => rule.result?.type === 'sync_only');
      let mechanism = actionVerificationDeclaration(trigger.action).mechanism;
      let kind =
        mechanism === 'hub' || hasHubSyncOnlyAuthority
          ? hasHubSyncOnlyAuthority
            ? ('hub_exact' as const)
            : null
          : mechanism === 'path_secret_only'
            ? ('legacy_path' as const)
            : null;
      if (!kind) return [];

      return [
        {
          id: trigger.id,
          oid: trigger.oid,
          kind,
          sync
        }
      ];
    })
    .sort((a, b) => (a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : 0));

class slateTriggerWebhookSyncServiceImpl {
  private async loadTarget(d: { receiverTriggerId?: string; receiverId?: string }) {
    if (d.receiverTriggerId) {
      let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
        where: {
          id: d.receiverTriggerId,
          source: SlateTriggerReceiverTriggerSource.webhook,
          tombstonedAt: null,
          ingressDisabledAt: null
        },
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
        receiver: receiverTrigger.receiver,
        triggers: [receiverTrigger]
      };
    }

    if (d.receiverId) {
      let receiver = await db.slateTriggerReceiver.findFirst({
        where: { id: d.receiverId },
        include: {
          ...receiverInclude,
          triggers: {
            where: {
              source: SlateTriggerReceiverTriggerSource.webhook,
              tombstonedAt: null,
              ingressDisabledAt: null
            },
            include: { action: true }
          }
        }
      });
      if (!receiver) throw new ServiceError(notFoundError('slate.trigger.receiver'));

      return {
        target: {
          type: 'receiver',
          receiverTriggerId: null,
          receiverId: receiver.id
        } satisfies WebhookTarget,
        active: receiver.status === SlateTriggerReceiverStatus.active,
        receiver,
        triggers: receiver.triggers.filter(isRoutableWebhookReceiverTrigger)
      };
    }

    throw new Error('A webhook target is required.');
  }

  async handleWebhookRequest(d: {
    receiverTriggerId?: string;
    receiverId?: string;
    request: WebhookWireRequest;
    pathSecret: string;
    capturePolicy: WebhookCapturePolicy;
  }): Promise<
    | { type: 'methodNotAllowed'; allowedMethods: WebhookHttpMethod[] }
    | { type: 'queued'; webhookRequestId: string }
    | { type: 'response'; webhookRequestId: string; response: WebhookHttpResponse }
  > {
    let target;
    try {
      target = await this.loadTarget(d);
    } catch (error) {
      await slateTriggerWebhookRequestService.createRejectedWebhookRequest({
        receiverTriggerId: d.receiverTriggerId,
        receiverId: d.receiverId,
        url: d.request.url,
        method: d.request.method,
        headers: d.request.headers,
        pathSecret: d.pathSecret,
        capturePolicy: d.capturePolicy,
        safeRejectionCode: 'target_unavailable'
      });
      throw error;
    }
    let owner = target.receiver;
    let authenticatedBoundary = owner
      ? await authenticateReceiverRouteBoundary({
          tenant: owner.tenant,
          receiverId: owner.id,
          supplied: d.pathSecret
        }).catch(() => null)
      : null;
    let requestRecord = !authenticatedBoundary
      ? {
          ...(await slateTriggerWebhookRequestService.createRejectedWebhookRequest({
            receiverTriggerId: target.target.receiverTriggerId ?? undefined,
            receiverId: target.target.receiverId ?? undefined,
            url: d.request.url,
            method: d.request.method,
            headers: d.request.headers,
            pathSecret: d.pathSecret,
            capturePolicy: d.capturePolicy,
            safeRejectionCode: 'baseline_path_invalid'
          })),
          __baselineRejected: true as const
        }
      : await slateTriggerWebhookRequestService.createCapturedWebhookRequest({
          receiverTriggerId: target.target.receiverTriggerId ?? undefined,
          receiverId: target.target.receiverId ?? undefined,
          wireRequest: d.request,
          pathSecret: d.pathSecret,
          capturePolicy: d.capturePolicy,
          authenticatedBoundary,
          enqueue: false
        });
    if ('__baselineRejected' in requestRecord) {
      return {
        type: 'response',
        webhookRequestId: requestRecord.id,
        response: {
          status: 401,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
          body: {
            encoding: 'base64',
            content: Buffer.from('baseline_path_invalid').toString('base64')
          }
        }
      };
    }
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
        body: null,
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
                webhookWireRequestMatches(d.request, matcher)
              ))
          );
        })
      : [];

    if (candidates.length === 0) {
      let ownerToken = randomUUID();
      let claimToken = randomUUID();
      let ownerExpiresAt = new Date(Date.now() + HARD_SYNC_OWNERSHIP_MS);
      if (
        !(await slateTriggerWebhookRequestService.claimSyncOwnership({
          webhookRequestId: requestRecord.id,
          ownerToken,
          expiresAt: ownerExpiresAt
        })) ||
        !(await slateTriggerWebhookRequestService.prepareQueueTakeover({
          webhookRequestId: requestRecord.id,
          ownerToken,
          claimToken
        }))
      ) {
        throw new Error('Webhook queue ownership could not be prepared');
      }
      try {
        await slateTriggerWebhookRequestService.enqueueWebhookRequest({
          webhookRequestId: requestRecord.id,
          claimToken
        });
      } catch (error) {
        await slateTriggerWebhookRequestService.abortPreparedQueueTakeover({
          webhookRequestId: requestRecord.id,
          ownerToken,
          claimToken
        });
        throw error;
      }
      await slateTriggerWebhookRequestService.confirmQueueTakeover({
        webhookRequestId: requestRecord.id,
        ownerToken,
        claimToken
      });
      return { type: 'queued', webhookRequestId: requestRecord.id };
    }
    let candidateKinds = new Set(candidates.map(candidate => candidate.kind));
    if (candidateKinds.size > 1) {
      await finalize();
      return {
        type: 'response',
        webhookRequestId: requestRecord.id,
        response: exactWebhookFailureResponse('mixed_sync_authority')
      };
    }
    let exactOnly = candidates.every(candidate => candidate.kind === 'hub_exact');
    if (exactOnly) {
      let run = async () => {
        let result =
          target.target.type === 'receiverTrigger'
            ? await slateTriggerReceiverService.handleCapturedTriggerWebhook({
                receiverTriggerId: target.target.receiverTriggerId,
                request: d.request,
                requestId: requestRecord.id
              })
            : await slateTriggerReceiverService.handleCapturedReceiverWebhook({
                receiverId: target.target.receiverId,
                request: d.request,
                requestId: requestRecord.id,
                excludeReceiverTriggerIds: applicableTriggers
                  .filter(
                    trigger => !candidates.some(candidate => candidate.id === trigger.id)
                  )
                  .map(trigger => trigger.id)
              });
        await finalize();
        return {
          type: 'response' as const,
          webhookRequestId: requestRecord.id,
          response:
            result.status === 'rejected'
              ? exactWebhookFailureResponse(result.code)
              : result.response
                ? adaptExactWebhookResponse(result.response)
                : exactWebhookFailureResponse('sync_deadline_exceeded')
        };
      };
      let execution = run().catch(async _error => {
        await finalize().catch(() => undefined);
        return {
          type: 'response' as const,
          webhookRequestId: requestRecord.id,
          response: exactWebhookFailureResponse('sync_deadline_exceeded')
        };
      });
      let timeoutMs = candidates[0]!.sync.timeoutMs ?? getTotalSyncTimeoutMs();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let deadline = new Promise<Awaited<typeof execution>>(resolve => {
        timer = setTimeout(
          () =>
            resolve({
              type: 'response',
              webhookRequestId: requestRecord.id,
              response: exactWebhookFailureResponse('sync_deadline_exceeded')
            }),
          timeoutMs
        );
      });
      let response = await Promise.race([execution, deadline]);
      if (timer) clearTimeout(timer);
      return response;
    }

    let ownerToken = randomUUID();
    let queueClaimToken = randomUUID();
    let ownerExpiresAt = new Date(Date.now() + HARD_SYNC_OWNERSHIP_MS);

    // Persist the delayed owner before claiming or invoking inline work. If this process exits
    // at any later instruction, BullMQ still has a durable takeover scheduled for the same hard
    // boundary used by the ownership fence below. Hub has no webhook outbox/reconciler, so the
    // row-create to first Redis publish gap remains the queue producer's pre-existing boundary.
    let claimedOwnership = await slateTriggerWebhookRequestService.claimSyncOwnership({
      webhookRequestId: requestRecord.id,
      ownerToken,
      expiresAt: ownerExpiresAt
    });
    if (!claimedOwnership) {
      throw new Error('Webhook inline ownership could not be claimed');
    }
    if (
      !(await slateTriggerWebhookRequestService.prepareQueueTakeover({
        webhookRequestId: requestRecord.id,
        ownerToken,
        claimToken: queueClaimToken
      }))
    ) {
      throw new Error('Webhook delayed takeover could not be prepared');
    }
    try {
      await slateTriggerWebhookRequestService.enqueueWebhookRequest({
        webhookRequestId: requestRecord.id,
        claimToken: queueClaimToken,
        delayMs: HARD_SYNC_OWNERSHIP_MS,
        jobId: `sync-fallback-${requestRecord.id}`
      });
    } catch (error) {
      await slateTriggerWebhookRequestService.abortPreparedQueueTakeover({
        webhookRequestId: requestRecord.id,
        ownerToken,
        claimToken: queueClaimToken
      });
      await slateTriggerWebhookRequestService.releaseSyncOwnership({
        webhookRequestId: requestRecord.id,
        ownerToken
      });
      throw error;
    }

    let transferToQueue = async (excludeReceiverTriggerIds: string[]) => {
      let confirmed = await slateTriggerWebhookRequestService.confirmQueueTakeover({
        webhookRequestId: requestRecord.id,
        ownerToken,
        claimToken: queueClaimToken
      });
      if (!confirmed) return false;
      try {
        await slateTriggerWebhookRequestService.enqueueWebhookRequest({
          webhookRequestId: requestRecord.id,
          claimToken: queueClaimToken,
          excludeReceiverTriggerIds,
          jobId: `sync-now-${requestRecord.id}`
        });
      } catch (_error) {
        // The delayed job was durably published before transfer. It remains the fallback owner.
        Sentry.captureException(new Error('Immediate webhook takeover wake-up failed'), {
          extra: { webhookRequestId: requestRecord.id }
        });
      }
      return true;
    };

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
              request: adaptWebhookWireRequestForProviderInvocation(d.request),
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
            onLateError: _error => {
              Sentry.captureException(new Error('Late synchronous webhook RPC failed'), {
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
                await transferToQueue(processedReceiverTriggerIds);
              } else {
                await finalize(ownerToken);
              }

              return candidateResult;
            } catch (_error) {
              Sentry.captureException(new Error('Synchronous webhook processing failed'), {
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
                  errorCode: 'webhook_sync_processing_failed'
                }
              );

              await transferToQueue(processedReceiverTriggerIds);
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
      } catch (_error) {
        Sentry.captureException(new Error('Synchronous webhook orchestration failed'), {
          extra: {
            webhookRequestId: requestRecord.id,
            receiverId: target.target.receiverId,
            receiverTriggerId: target.target.receiverTriggerId
          }
        });
        console.error('Failed to process webhook synchronously; falling back to queue:', {
          webhookRequestId: requestRecord.id,
          errorCode: 'webhook_sync_orchestration_failed'
        });

        await transferToQueue(processedReceiverTriggerIds);
        settleQueued();
      }
    })();

    void processing.catch(_error => {
      Sentry.captureException(new Error('Webhook sync fallback orchestration failed'), {
        extra: { webhookRequestId: requestRecord.id }
      });
      console.error('Webhook sync fallback orchestration failed:', {
        webhookRequestId: requestRecord.id,
        errorCode: 'webhook_sync_fallback_failed'
      });
      if (!publicResultSettled) {
        publicResultSettled = true;
        rejectPublicResult(_error);
      }
    });

    return publicResult;
  }
}

export let slateTriggerWebhookSyncService = Service.create(
  'slateTriggerWebhookSyncService',
  () => new slateTriggerWebhookSyncServiceImpl()
).build();
