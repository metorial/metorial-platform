import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { TRIGGER_POLL_SEARCH_BATCH_SIZE } from './_config';
import { triggerPollQueue } from './poll';

export let triggerScheduleSearchCron = createCron(
  {
    name: 'shub/trg/sched/cron/1',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await triggerScheduleSearchQueue.add({ cutoff: new Date().toISOString() });
  }
);

export let triggerScheduleSearchQueue = createQueue<{ cutoff: string; cursor?: string }>({
  name: 'shub/trg/sched/search/1',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let triggerScheduleSearchQueueProcessor = triggerScheduleSearchQueue.process(
  async data => {
    let cutoff = new Date(data.cutoff);

    let schedules = await db.triggerRegistrationSchedule.findMany({
      where: {
        isDisabled: false,
        OR: [{ claimedUntil: null }, { claimedUntil: { lte: cutoff } }],
        triggerRegistrationInstance: {
          triggerRegistration: { status: 'active', tenant: { disableCallbacks: false } }
        },
        nextRunAt: { lte: cutoff },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_POLL_SEARCH_BATCH_SIZE,
      select: { id: true, oid: true }
    });
    if (schedules.length === 0) return;

    await triggerPollQueue.addManyWithOps(
      schedules.map(s => ({
        data: { scheduleId: s.id },
        opts: { id: s.id }
      }))
    );

    if (schedules.length === TRIGGER_POLL_SEARCH_BATCH_SIZE) {
      await triggerScheduleSearchQueue.add({
        cutoff: data.cutoff,
        cursor: schedules[schedules.length - 1]!.id
      });
    }
  }
);
