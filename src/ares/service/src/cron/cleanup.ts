import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../db';

export let cleanupCron = createCron(
  {
    name: 'fed/id/cleanup',
    cron: '0 0 * * *',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  async () => {
    let now = new Date();
    let oneWeekAgo = subDays(now, 7);

    await db.authAttempt.deleteMany({
      where: { createdAt: { lt: oneWeekAgo } }
    });

    await db.authIntent.deleteMany({
      where: { createdAt: { lt: oneWeekAgo } }
    });

    await db.authBlock.deleteMany({
      where: { blockedAt: { lt: oneWeekAgo } }
    });
  }
);
