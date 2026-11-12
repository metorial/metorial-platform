import { createCron } from '@lowerdeck/cron';
import { createQueue, getDatabaseConflictCode, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import { globalTenant } from '../../services/tenant';
import {
  TRIGGER_WEBHOOK_EXPANSION_BATCH_SIZE,
  TRIGGER_WEBHOOK_EXPANSION_CLOCK_SKEW_MS,
  TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS,
  TRIGGER_WEBHOOK_EXPANSION_MAX_ATTEMPTS,
  triggerWebhookExpandWorkerOpts,
  triggerWebhookExpansionBackoffMs
} from './_config';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import {
  persistTriggerRawEvents,
  findAllowedTriggerInstances,
  type TriggerRawEventInput
} from './_rawEvent';
import { createTriggerInstanceStack } from './_stack';
import {
  claimTriggerInstance,
  commitTriggerInstance,
  releaseTriggerInstance,
  triggerInstanceLock,
  type TriggerStateInstance
} from './_state';
import { enqueueTriggerRawEventMapping } from './rawEventMapping';

let Sentry = getSentry();

let EXPANSION_FAILED = 'webhook_expansion_failed';

export let createWebhookExpansionInbox = async (d: {
  webhookEventOid: bigint;
  webhookEventId: string;
  webhookRegistrationOid: bigint;
  events: TriggerRawEventInput[];
}) => {
  let result = await db.$transaction(async tx => {
    let allOids = [
      ...new Set(d.events.flatMap(event => event.triggerRegistrationInstanceOids))
    ];
    let instances = await findAllowedTriggerInstances(tx, allOids);
    let allowed = new Set(instances.map(instance => instance.oid));
    let rows = d.events.flatMap((event, index) =>
      event.triggerRegistrationInstanceOids
        .filter(oid => allowed.has(oid))
        .map(oid => ({
          ...getId('triggerWebhookExpansion'),
          triggerRegistrationInstanceOid: oid,
          webhookEventOid: d.webhookEventOid,
          webhookRegistrationOid: d.webhookRegistrationOid,
          deliveryId: event.idempotencyKey ?? `${d.webhookEventId}:${index}`,
          payload: event.payload
        }))
    );
    let created = rows.length
      ? await tx.triggerWebhookExpansion.createManyAndReturn({
          data: rows,
          skipDuplicates: true,
          select: { id: true }
        })
      : [];

    return {
      created,
      hadCandidates: allOids.length > 0,
      hasRemainingCandidates: allowed.size > 0
    };
  });

  await enqueueTriggerWebhookExpansions(result.created);

  return result;
};

let isDue = (at: Date) => at.getTime() <= Date.now() + TRIGGER_WEBHOOK_EXPANSION_CLOCK_SKEW_MS;

let isExpired = (createdAt: Date) =>
  Date.now() - createdAt.getTime() > TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS;

let recordWebhookExpansionFailure = async (d: {
  inbox: { oid: bigint };
  instance: TriggerStateInstance;
  attempt: number;
  error: { code: string; message: string };
}) => {
  let now = Date.now();
  let exhausted = d.attempt >= TRIGGER_WEBHOOK_EXPANSION_MAX_ATTEMPTS;
  let failureCount = d.instance.expansionFailureCount + 1;
  let rowRetryAt = new Date(now + triggerWebhookExpansionBackoffMs(d.attempt));
  let instanceRetryAt = new Date(now + triggerWebhookExpansionBackoffMs(failureCount));

  // Reported before the row is closed, so a crash in between cannot leave a closed row with
  // nothing shown to the user. Reporting twice is harmless.
  if (exhausted) {
    await createTriggerRegistrationInstanceError({
      triggerRegistrationInstanceOid: d.instance.oid,
      code: EXPANSION_FAILED,
      message: `We couldn't fetch new events from the provider after ${d.attempt} attempts, so that update was skipped: ${d.error.message}`
    });
  }

  await db.$transaction(async tx => {
    let counted = await tx.triggerRegistrationInstance.updateMany({
      where: { oid: d.instance.oid, stateClaimToken: d.instance.stateClaimToken },
      data: { expansionFailureCount: failureCount, expansionRetryAt: instanceRetryAt }
    });
    // The claim was lost during the call, so the failure is not ours to count.
    if (!counted.count) throw new QueueRetryError();

    let recorded = await tx.triggerWebhookExpansion.updateMany({
      where: { oid: d.inbox.oid, completedAt: null },
      data: exhausted
        ? {
            attemptCount: { increment: 1 },
            completedAt: new Date(now),
            payload: Prisma.DbNull,
            lastErrorCode: 'retries_exhausted'
          }
        : {
            attemptCount: { increment: 1 },
            nextAttemptAt: rowRetryAt,
            lastErrorCode: d.error.code
          }
    });
    if (!recorded.count) throw new QueueRetryError();

    // The connection's backoff is the floor for every pending row, this one included, so the
    // scanner does not pick them up while no call would be made anyway.
    await tx.triggerWebhookExpansion.updateMany({
      where: {
        triggerRegistrationInstanceOid: d.instance.oid,
        completedAt: null,
        nextAttemptAt: { lt: instanceRetryAt }
      },
      data: { nextAttemptAt: instanceRetryAt }
    });
  });

  return exhausted;
};

export let triggerWebhookExpandQueue = createQueue<{ expansionId: string }>({
  name: 'shub/trg/whk/expand/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true },
  workerOpts: triggerWebhookExpandWorkerOpts
});

export let triggerWebhookExpandQueueProcessor = triggerWebhookExpandQueue.process(
  async data => {
    let inbox = await db.triggerWebhookExpansion.findUnique({
      where: { id: data.expansionId },
      include: { triggerRegistrationInstance: true, webhookRegistration: true }
    });
    if (!inbox || inbox.completedAt) return;
    if (!isDue(inbox.nextAttemptAt) && !isExpired(inbox.createdAt)) return;

    await triggerInstanceLock.usingLock(inbox.triggerRegistrationInstance.id, async () => {
      // A duplicate job may have waited for the first worker's lock, and a renewal may have
      // replaced the saved registration payload meanwhile.
      let current = await db.triggerWebhookExpansion.findUnique({
        where: { oid: inbox.oid },
        include: {
          triggerRegistrationInstance: { select: { expansionRetryAt: true } },
          webhookRegistration: { select: { secretOid: true } }
        }
      });
      if (!current || current.completedAt) return;

      // Checked ahead of the due and backoff gates: the backlog behind a connection that keeps
      // failing has to drain while that connection is still backing off. The error is reported
      // before the row is closed so a crash in between cannot hide the dropped events.
      if (isExpired(current.createdAt)) {
        await createTriggerRegistrationInstanceError({
          triggerRegistrationInstanceOid: current.triggerRegistrationInstanceOid,
          code: EXPANSION_FAILED,
          message: `We couldn't process events for this connection for ${TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS / (60 * 60 * 1000)} hours, so they were dropped.`
        });
        await db.triggerWebhookExpansion.updateMany({
          where: { oid: current.oid, completedAt: null },
          data: { completedAt: new Date(), payload: Prisma.DbNull, lastErrorCode: 'expired' }
        });
        return;
      }
      if (!isDue(current.nextAttemptAt)) return;

      // The connection, not the row, decides when the provider is called again. A row that
      // shows up meanwhile waits for it instead of being picked up by every scan.
      let instanceRetryAt = current.triggerRegistrationInstance.expansionRetryAt;
      if (instanceRetryAt && !isDue(instanceRetryAt)) {
        await db.triggerWebhookExpansion.updateMany({
          where: {
            oid: current.oid,
            completedAt: null,
            nextAttemptAt: { lt: instanceRetryAt }
          },
          data: { nextAttemptAt: instanceRetryAt }
        });
        return;
      }

      // A row that failed before lets less-failed rows go first: they show whether the
      // connection works, so one bad delivery cannot hold healthy ones in its own backoff.
      if (current.attemptCount > 0) {
        let lessFailed = await db.triggerWebhookExpansion.findFirst({
          where: {
            triggerRegistrationInstanceOid: current.triggerRegistrationInstanceOid,
            completedAt: null,
            attemptCount: { lt: current.attemptCount },
            nextAttemptAt: {
              lte: new Date(Date.now() + TRIGGER_WEBHOOK_EXPANSION_CLOCK_SKEW_MS)
            },
            createdAt: { gt: new Date(Date.now() - TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS) }
          },
          orderBy: [{ attemptCount: 'asc' }, { id: 'asc' }],
          select: { id: true }
        });
        if (lessFailed) {
          await enqueueTriggerWebhookExpansions([lessFailed]);
          throw new QueueRetryError();
        }
      }

      let instance = await claimTriggerInstance(inbox.triggerRegistrationInstance.id);
      if (!instance) {
        let eligible = await db.triggerRegistrationInstance.count({
          where: {
            oid: inbox.triggerRegistrationInstanceOid,
            triggerRegistration: { status: 'active', tenant: { disableCallbacks: false } }
          }
        });
        if (eligible) throw new QueueRetryError();
        await db.triggerWebhookExpansion.updateMany({
          where: { oid: inbox.oid, completedAt: null },
          data: {
            completedAt: new Date(),
            payload: Prisma.DbNull,
            lastErrorCode: 'registration_disabled'
          }
        });
        return;
      }

      let attempt = current.attemptCount + 1;
      let recovering =
        instance.expansionFailureCount > 0 || instance.expansionRetryAt !== null;

      try {
        if (inbox.webhookRegistration.status !== 'active') {
          await commitTriggerInstance(instance, undefined, async tx => {
            await tx.triggerWebhookExpansion.update({
              where: { oid: inbox.oid },
              data: {
                completedAt: new Date(),
                payload: Prisma.DbNull,
                lastErrorCode: 'webhook_registration_deleted'
              }
            });
          });
          return;
        }

        let invocation = instance.triggerGroup.spec.invocation;
        if (invocation.type !== 'webhook' || !invocation.supportsExpansion) {
          await recordWebhookExpansionFailure({
            inbox,
            instance,
            attempt,
            error: {
              code: 'expansion_unsupported',
              message: 'This trigger group no longer supports webhook expansion.'
            }
          });
          return;
        }

        let rawEvents: { id: string }[] = [];
        let released: { id: string }[] = [];
        let failure: { code: string; message: string } | undefined;

        // A lost claim or a fenced commit raises QueueRetryError and a database conflict is
        // retried by the queue: neither is an attempt. A failed call, or anything else that
        // breaks here, is one.
        try {
          let saved = await secretService.DANGEROUSLY_decryptSecret({
            secretOid: current.webhookRegistration.secretOid,
            purpose: 'slate_webhook_registration_payload',
            tenant:
              inbox.webhookRegistration.tenantOid === null
                ? globalTenant
                : instance.triggerRegistration.tenant,
            note: `trigger-webhook-expand:${inbox.id}`
          });
          let stack = await createTriggerInstanceStack({
            registration: instance.triggerRegistration,
            sessionId: instance.id,
            note: `trigger-webhook-expand:${inbox.id}`
          });

          let result = await slateInvocationService.expandWebhook({
            stack,
            triggerGroupId: instance.triggerGroup.key,
            payload: inbox.payload,
            state: instance.state,
            selection: instance.selection ?? undefined,
            deliveryId: inbox.deliveryId,
            webhookRegistrationPayload: saved.payload
          });

          if (result.status === 'error') {
            failure = result.error;
          } else {
            let { events, updatedState } = result.data;

            await commitTriggerInstance(instance, updatedState, async tx => {
              let persisted = await persistTriggerRawEvents(tx, {
                source: 'webhook',
                webhookEventOid: inbox.webhookEventOid,
                events: events.map(event => ({
                  ...event,
                  triggerRegistrationInstanceOids: [instance.oid]
                }))
              });
              rawEvents = persisted.created;

              let completed = await tx.triggerWebhookExpansion.updateMany({
                where: { oid: inbox.oid, completedAt: null },
                data: { completedAt: new Date(), payload: Prisma.DbNull, lastErrorCode: null }
              });
              if (!completed.count) throw new QueueRetryError();

              if (!recovering) return;

              // The connection works again: end its backoff and let the rows that never got
              // a turn go now instead of waiting for the next scan.
              await tx.triggerRegistrationInstance.update({
                where: { oid: instance.oid },
                data: { expansionFailureCount: 0, expansionRetryAt: null }
              });
              released = await tx.triggerWebhookExpansion.findMany({
                where: {
                  triggerRegistrationInstanceOid: instance.oid,
                  completedAt: null,
                  attemptCount: 0
                },
                orderBy: { id: 'asc' },
                take: TRIGGER_WEBHOOK_EXPANSION_BATCH_SIZE,
                select: { id: true }
              });
              await tx.triggerWebhookExpansion.updateMany({
                where: {
                  triggerRegistrationInstanceOid: instance.oid,
                  completedAt: null,
                  attemptCount: 0
                },
                data: { nextAttemptAt: new Date() }
              });
            });
          }
        } catch (error) {
          if (error instanceof QueueRetryError || getDatabaseConflictCode(error)) throw error;

          let exhausted = await recordWebhookExpansionFailure({
            inbox,
            instance,
            attempt,
            error: {
              code: 'expansion_failed',
              message: error instanceof Error ? error.message : String(error)
            }
          });
          if (exhausted) return;

          throw error;
        }

        if (failure) {
          await recordWebhookExpansionFailure({ inbox, instance, attempt, error: failure });
          return;
        }

        await enqueueTriggerRawEventMapping(rawEvents);
        await enqueueTriggerWebhookExpansions(released);

        // A recovered connection must not keep showing the old failure, and a later outage
        // has to be reportable again. Best effort: the expansion itself already committed.
        try {
          await db.triggerRegistrationInstanceError.deleteMany({
            where: { triggerRegistrationInstanceOid: instance.oid, code: EXPANSION_FAILED }
          });
        } catch (error) {
          Sentry.captureException(error);
        }
      } finally {
        await releaseTriggerInstance(instance);
      }
    });
  }
);

// Call only after the transaction that wrote the inbox rows has committed. The job id matches
// the expansion scanner's, which re-enqueues every pending row if this fails.
export let enqueueTriggerWebhookExpansions = async (expansions: { id: string }[]) => {
  if (!expansions.length) return;

  try {
    await triggerWebhookExpandQueue.addManyWithOps(
      expansions.map(expansion => ({
        data: { expansionId: expansion.id },
        opts: { id: expansion.id }
      }))
    );
  } catch (error) {
    Sentry.captureException(error);
  }
};

export let triggerWebhookExpansionSearchQueue = createQueue<{
  cutoff: string;
  cursor?: string;
}>({
  name: 'shub/trg/whk/expand/search/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true },
  workerOpts: { concurrency: 1 }
});

export let triggerWebhookExpansionSearchQueueProcessor =
  triggerWebhookExpansionSearchQueue.process(async data => {
    let rows = await db.triggerWebhookExpansion.findMany({
      where: {
        completedAt: null,
        nextAttemptAt: { lte: new Date(data.cutoff) },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_WEBHOOK_EXPANSION_BATCH_SIZE,
      select: { id: true }
    });
    await triggerWebhookExpandQueue.addManyWithOps(
      rows.map(row => ({ data: { expansionId: row.id }, opts: { id: row.id } }))
    );
    if (rows.length === TRIGGER_WEBHOOK_EXPANSION_BATCH_SIZE)
      await triggerWebhookExpansionSearchQueue.add(
        { cutoff: data.cutoff, cursor: rows[rows.length - 1]!.id },
        { delay: 100 }
      );
  });

export let triggerWebhookExpansionCron = createCron(
  {
    name: 'shub/trg/whk/expand/cron/1',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await triggerWebhookExpansionSearchQueue.add({ cutoff: new Date().toISOString() });
  }
);
