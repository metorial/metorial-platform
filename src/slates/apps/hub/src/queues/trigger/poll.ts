import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { addSeconds } from 'date-fns';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { slateInvocationService } from '../../services/slateInvocation';
import { TRIGGER_POLL_MAX_FAILURE_BACKOFF_SECONDS, triggerPollWorkerOpts } from './_config';
import { persistTriggerRawEvents } from './_rawEvent';
import { createTriggerInstanceStack } from './_stack';
import {
  claimTriggerInstance,
  commitTriggerInstance,
  releaseTriggerInstance,
  triggerInstanceLock,
  triggerStateLeaseMs
} from './_state';
import { enqueueTriggerRawEventMapping } from './rawEventMapping';
import { enqueueTriggerWebhookExpansions } from './webhookExpand';

export let triggerPollQueue = createQueue<{ scheduleId: string }>({
  name: 'shub/trg/poll/2',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true },
  workerOpts: triggerPollWorkerOpts
});

export let triggerPollQueueProcessor = triggerPollQueue.process(async data => {
  let schedule = await db.triggerRegistrationSchedule.findUnique({
    where: { id: data.scheduleId },
    include: { triggerRegistrationInstance: true }
  });
  if (!schedule) return;

  await triggerInstanceLock.usingLock(schedule.triggerRegistrationInstance.id, async () => {
    let now = new Date();
    let token = snowflake.nextId().toString();
    let claimed = await db.triggerRegistrationSchedule.updateMany({
      where: {
        oid: schedule.oid,
        isDisabled: false,
        nextRunAt: { equals: schedule.nextRunAt, lte: now },
        OR: [{ claimedUntil: null }, { claimedUntil: { lte: now } }],
        triggerRegistrationInstance: {
          triggerRegistration: { status: 'active', tenant: { disableCallbacks: false } }
        }
      },
      data: { claimToken: token, claimedUntil: new Date(now.getTime() + triggerStateLeaseMs) }
    });
    if (!claimed.count) return;

    let completeSchedule = async (
      tx: Prisma.TransactionClient,
      ranAt: Date,
      nextRunAt: Date
    ) => {
      let completed = await tx.triggerRegistrationSchedule.updateMany({
        where: {
          oid: schedule.oid,
          claimToken: token,
          claimedUntil: { gt: new Date() },
          isDisabled: false
        },
        data: {
          firstRunAt: schedule.firstRunAt ?? ranAt,
          lastRunAt: ranAt,
          nextRunAt,
          claimToken: null,
          claimedUntil: null
        }
      });
      if (!completed.count) throw new QueueRetryError();
    };

    let instance = await claimTriggerInstance(schedule.triggerRegistrationInstance.id);
    try {
      if (!instance) throw new QueueRetryError();
      let invocation = instance.triggerGroup.spec.invocation;
      if (invocation.type === 'webhook' && invocation.supportsExpansion) {
        let expansions: { id: string }[] = [];

        await commitTriggerInstance(instance, undefined, async tx => {
          let links = await tx.triggerRegistrationWebhook.findMany({
            where: {
              triggerRegistrationInstanceOid: instance.oid,
              webhookRegistration: { status: 'active' }
            },
            include: { webhookRegistration: true }
          });
          // A reconciliation that is still waiting covers this run too.
          let pending = await tx.triggerWebhookExpansion.findMany({
            where: {
              triggerRegistrationInstanceOid: instance.oid,
              completedAt: null,
              payload: { equals: Prisma.DbNull }
            },
            distinct: ['webhookRegistrationOid'],
            select: { webhookRegistrationOid: true }
          });
          let pendingOids = new Set(pending.map(row => row.webhookRegistrationOid));

          let rows = links.flatMap(link =>
            link.webhookRegistration && !pendingOids.has(link.webhookRegistration.oid)
              ? [
                  {
                    ...getId('triggerWebhookExpansion'),
                    triggerRegistrationInstanceOid: instance.oid,
                    webhookRegistrationOid: link.webhookRegistration.oid,
                    deliveryId: `${schedule.id}:${schedule.nextRunAt.toISOString()}:${link.webhookRegistration.id}`,
                    payload: Prisma.DbNull
                  }
                ]
              : []
          );
          expansions = rows.length
            ? await tx.triggerWebhookExpansion.createManyAndReturn({
                data: rows,
                skipDuplicates: true,
                select: { id: true }
              })
            : [];

          await completeSchedule(tx, now, addSeconds(now, schedule.intervalSeconds));
        });

        await enqueueTriggerWebhookExpansions(expansions);
        return;
      }
      let stack = await createTriggerInstanceStack({
        registration: instance.triggerRegistration,
        sessionId: instance.id,
        note: `trigger-poll:${schedule.id}`
      });
      let result = await slateInvocationService.pollTriggerGroup({
        stack,
        triggerGroupId: instance.triggerGroup.key,
        state: instance.state,
        selection: instance.selection ?? undefined
      });
      let finishedAt = new Date();
      let nextRunAt = addSeconds(
        finishedAt,
        result.status === 'success'
          ? schedule.intervalSeconds
          : Math.min(schedule.intervalSeconds, TRIGGER_POLL_MAX_FAILURE_BACKOFF_SECONDS)
      );

      let rawEvents: { id: string }[] = [];

      await commitTriggerInstance(
        instance,
        result.status === 'success' ? result.data.updatedState : undefined,
        async tx => {
          await completeSchedule(tx, finishedAt, nextRunAt);

          await tx.triggerPollingRun.create({
            data: {
              ...getId('triggerPollingRun'),
              status: result.status === 'success' ? 'succeeded' : 'failed',
              scheduleOid: schedule.oid,
              invocationOid: result.invocation.oid,
              errorCode: result.status === 'error' ? result.error.code : null,
              errorMessage: result.status === 'error' ? result.error.message : null
            }
          });
          if (result.status === 'success') {
            let persisted = await persistTriggerRawEvents(tx, {
              source: 'polling',
              events: result.data.events.map(event => ({
                ...event,
                triggerRegistrationInstanceOids: [instance.oid]
              }))
            });
            rawEvents = persisted.created;
          }
        }
      );

      await enqueueTriggerRawEventMapping(rawEvents);
    } finally {
      if (instance) await releaseTriggerInstance(instance);
      await db.triggerRegistrationSchedule.updateMany({
        where: { oid: schedule.oid, claimToken: token },
        data: { claimedUntil: null, claimToken: null }
      });
    }
  });
});
