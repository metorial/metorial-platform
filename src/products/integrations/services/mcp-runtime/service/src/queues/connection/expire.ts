import { createCron } from '@lowerdeck/cron';
import { subHours, subMinutes } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';

export let expiresConnectionsCron = createCron(
  {
    name: 'shut/con-expire/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    let twoMinutesAgo = subMinutes(new Date(), 2);
    let fiveHoursAgo = subHours(new Date(), 5);

    await db.serverConnection.updateMany({
      where: {
        OR: [
          {
            status: 'connected',
            lastPingAt: { lt: twoMinutesAgo }
          },
          {
            status: 'new',
            createdAt: { lt: fiveHoursAgo }
          }
        ]
      },
      data: {
        status: 'disconnected'
      }
    });
  }
);
