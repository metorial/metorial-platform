import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { addMinutes } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { TRIGGER_POLL_CLAIM_DURATION_MINUTES, TRIGGER_POLL_SEARCH_BATCH_SIZE } from './_config';
import { triggerPollQueue } from './poll';

export let triggerScheduleSearchCron = createCron(
  {
    name: 'shub/trg/sched/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await triggerScheduleSearchQueue.add({ cutoff: new Date().toISOString() });
  }
);

export let triggerScheduleReleaseStaleClaimsCron = createCron(
  {
    name: 'shub/trg/sched/release/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await db.triggerRegistrationSchedule.updateMany({
      where: { claimedUntil: { lt: new Date() } },
      data: { claimedUntil: null }
    });
  }
);

export let triggerScheduleSearchQueue = createQueue<{ cutoff: string; cursor?: string }>({
  name: 'shub/trg/sched/search',
  redisUrl: env.service.REDIS_URL
});

export let triggerScheduleSearchQueueProcessor = triggerScheduleSearchQueue.process(
  async data => {
    let cutoff = new Date(data.cutoff);

    let schedules = await db.triggerRegistrationSchedule.findMany({
      where: {
        isDisabled: false,
        claimedUntil: null,
        nextRunAt: { lte: cutoff },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_POLL_SEARCH_BATCH_SIZE,
      select: { id: true, oid: true }
    });
    if (schedules.length === 0) return;

    await db.triggerRegistrationSchedule.updateMany({
      where: { oid: { in: schedules.map(s => s.oid) }, claimedUntil: null },
      data: { claimedUntil: addMinutes(new Date(), TRIGGER_POLL_CLAIM_DURATION_MINUTES) }
    });

    await triggerPollQueue.addMany(schedules.map(s => ({ scheduleId: s.id })));

    if (schedules.length === TRIGGER_POLL_SEARCH_BATCH_SIZE) {
      await triggerScheduleSearchQueue.add({
        cutoff: data.cutoff,
        cursor: schedules[schedules.length - 1]!.id
      });
    }
  }
);
