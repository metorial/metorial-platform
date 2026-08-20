import { createCron } from '@lowerdeck/cron';
import { QueueRetryError } from '@lowerdeck/queue';
import { randomUUID } from 'node:crypto';
import { db } from '../../db';
import { env } from '../../env';
import { snowflake } from '../../id';
import { finalizeWebhookRequest } from '../../services/slateTriggerWebhookProcessing';
import { slateTriggerWebhookTerminalRepairQueue } from './eventQueues';

type RepairStore = any;

export let classifyWebhookTerminalState = async (d: {
  store: RepairStore;
  requestId: string;
  claimToken: string;
}) => {
  let request = await d.store.slateTriggerWebhookRequest.findUnique({
    where: { id: d.requestId },
    select: { processedAt: true, queueClaimToken: true, queueClaimState: true }
  });
  if (!request) return 'missing' as const;
  if (request.processedAt) return 'already_terminal' as const;
  if (request.queueClaimToken !== d.claimToken || request.queueClaimState !== 'owned') {
    return 'stale_claim' as const;
  }
  return 'retryable' as const;
};

let ensureWebhookTerminalOwnership = async (d: {
  store: RepairStore;
  requestId: string;
  claimToken: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let request = await d.store.slateTriggerWebhookRequest.findUnique({
    where: { id: d.requestId },
    select: {
      processedAt: true,
      queueClaimToken: true,
      queueClaimState: true,
      syncOwnerExpiresAt: true
    }
  });
  if (!request) return 'missing' as const;
  if (request.processedAt) return 'already_terminal' as const;
  if (request.queueClaimToken !== d.claimToken) return 'stale_claim' as const;
  if (request.queueClaimState === 'owned') return 'retryable' as const;
  if (request.queueClaimState !== 'prepared') return 'stale_claim' as const;
  if (request.syncOwnerExpiresAt && request.syncOwnerExpiresAt > now) {
    return 'owner_active' as const;
  }
  let claimed = await d.store.slateTriggerWebhookRequest.updateMany({
    where: {
      id: d.requestId,
      processedAt: null,
      queueClaimToken: d.claimToken,
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
  if (claimed.count === 1) return 'ownership_acquired' as const;
  return await classifyWebhookTerminalState(d);
};

let repairKey = (requestId: string, claimToken: string) => `${requestId}:${claimToken}`;

export let persistWebhookTerminalRepair = async (d: {
  store: RepairStore;
  requestId: string;
  claimToken: string;
  safeRejectionCode: string;
  status?: 'pending' | 'blocked';
  evidence?: Record<string, unknown>;
}) =>
  await d.store.webhookTerminalFinalizationRepair.upsert({
    where: { key: repairKey(d.requestId, d.claimToken) },
    create: {
      oid: snowflake.nextId(),
      id: randomUUID(),
      key: repairKey(d.requestId, d.claimToken),
      requestId: d.requestId,
      claimToken: d.claimToken,
      safeRejectionCode: d.safeRejectionCode,
      status: d.status ?? 'pending',
      completionEvidence: d.evidence
    },
    update: {
      safeRejectionCode: d.safeRejectionCode,
      status: d.status ?? 'pending',
      completionEvidence: d.evidence,
      completedAt: null
    }
  });

export let handleExhaustedWebhookFailure = async (d: {
  store?: RepairStore;
  requestId: string;
  claimToken: string;
  safeRejectionCode: string;
  finalize: () => Promise<boolean>;
  enqueue?: (repairId: string, options: { id: string }) => Promise<unknown>;
}) => {
  let store = d.store ?? db;
  try {
    if (await d.finalize()) return 'finalized' as const;
  } catch {
    // A durable repair below owns the retry. If persisting it fails, the error escapes to the
    // queue driver so the exhausted job visibly records terminal-hook failure.
  }
  let state = await ensureWebhookTerminalOwnership({
    store,
    requestId: d.requestId,
    claimToken: d.claimToken
  });
  if (state === 'ownership_acquired') {
    try {
      if (await d.finalize()) return 'finalized' as const;
    } catch {
      // The newly acquired queue claim is durably recoverable below.
    }
    state = 'retryable';
  }
  if (state === 'already_terminal') return state;
  let repairable = state === 'retryable' || state === 'owner_active';
  let repair = await persistWebhookTerminalRepair({
    store,
    requestId: d.requestId,
    claimToken: d.claimToken,
    safeRejectionCode: d.safeRejectionCode,
    status: repairable ? 'pending' : 'blocked',
    evidence:
      repairable ? undefined : { type: 'terminal_claim_classification', state }
  });
  if (!repairable) return state;
  let enqueue =
    d.enqueue ??
    (async (repairId: string, options: { id: string }) =>
      await slateTriggerWebhookTerminalRepairQueue.add({ repairId }, options));
  try {
    await enqueue(repair.id, { id: `webhook-terminal-repair-${repair.id}` });
  } catch {
    await store.webhookTerminalFinalizationRepair.update({
      where: { oid: repair.oid },
      data: { lastErrorCode: 'repair_queue_publish_failed', lastAttemptAt: new Date() }
    });
  }
  return 'repair_durable' as const;
};

let requestFinalizerInput = (request: any, claimToken: string, safeRejectionCode: string) => ({
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
  queueClaimToken: claimToken,
  outcome: 'failed' as const,
  safeRejectionCode
});

export let runWebhookTerminalRepair = async (d: {
  repairId: string;
  store?: RepairStore;
  finalize?: (input: ReturnType<typeof requestFinalizerInput>) => Promise<boolean>;
}) => {
  let store = d.store ?? db;
  let repair = await store.webhookTerminalFinalizationRepair.findUnique({
    where: { id: d.repairId }
  });
  if (!repair || repair.status !== 'pending') return 'skipped' as const;
  let request = await store.slateTriggerWebhookRequest.findUnique({
    where: { id: repair.requestId }
  });
  if (!request) {
    await store.webhookTerminalFinalizationRepair.update({
      where: { oid: repair.oid },
      data: {
        status: 'blocked',
        completedAt: new Date(),
        completionEvidence: { type: 'terminal_claim_classification', state: 'missing' }
      }
    });
    return 'missing' as const;
  }
  try {
    let ownership = await ensureWebhookTerminalOwnership({
      store,
      requestId: repair.requestId,
      claimToken: repair.claimToken
    });
    if (ownership === 'already_terminal') {
      await store.webhookTerminalFinalizationRepair.update({
        where: { oid: repair.oid },
        data: {
          status: 'completed',
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          lastErrorCode: null,
          completedAt: new Date(),
          completionEvidence: {
            type: 'terminal_finalization_committed',
            state: ownership
          }
        }
      });
      return ownership;
    }
    if (ownership === 'owner_active') {
      await store.webhookTerminalFinalizationRepair.update({
        where: { oid: repair.oid },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          lastErrorCode: ownership
        }
      });
      throw new QueueRetryError();
    }
    if (ownership === 'missing' || ownership === 'stale_claim') {
      await store.webhookTerminalFinalizationRepair.update({
        where: { oid: repair.oid },
        data: {
          status: 'blocked',
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          lastErrorCode: ownership,
          completedAt: new Date(),
          completionEvidence: {
            type: 'terminal_claim_classification',
            state: ownership
          }
        }
      });
      return ownership;
    }
    let committed = await (d.finalize ?? finalizeWebhookRequest)(
      requestFinalizerInput(request, repair.claimToken, repair.safeRejectionCode)
    );
    let state = committed
      ? ('finalized' as const)
      : await classifyWebhookTerminalState({
          store,
          requestId: repair.requestId,
          claimToken: repair.claimToken
        });
    if (state === 'finalized' || state === 'already_terminal') {
      await store.webhookTerminalFinalizationRepair.update({
        where: { oid: repair.oid },
        data: {
          status: 'completed',
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          lastErrorCode: null,
          completedAt: new Date(),
          completionEvidence: { type: 'terminal_finalization_committed', state }
        }
      });
      return state;
    }
    await store.webhookTerminalFinalizationRepair.update({
      where: { oid: repair.oid },
      data: {
        status: state === 'retryable' ? 'pending' : 'blocked',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        lastErrorCode: state,
        completionEvidence:
          state === 'retryable' ? undefined : { type: 'terminal_claim_classification', state }
      }
    });
    if (state === 'retryable') throw new QueueRetryError();
    return state;
  } catch (error) {
    if (error instanceof QueueRetryError) throw error;
    await store.webhookTerminalFinalizationRepair.update({
      where: { oid: repair.oid },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        lastErrorCode: 'terminal_finalize_failed'
      }
    });
    throw new QueueRetryError();
  }
};

export let slateTriggerWebhookTerminalRepairQueueProcessor =
  slateTriggerWebhookTerminalRepairQueue.process(async data => {
    await runWebhookTerminalRepair({ repairId: data.repairId });
  });

export let slateTriggerWebhookTerminalRepairCron = createCron(
  {
    name: 'shub/trg/webhook/terminal-repair/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    let repairs = await db.webhookTerminalFinalizationRepair.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { id: true }
    });
    await Promise.all(
      repairs.map(repair =>
        slateTriggerWebhookTerminalRepairQueue.add(
          { repairId: repair.id },
          { id: `webhook-terminal-repair-${repair.id}` }
        )
      )
    );
    await db.webhookTerminalFinalizationRepair.deleteMany({
      where: {
        status: 'completed',
        completedAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });
  }
);
