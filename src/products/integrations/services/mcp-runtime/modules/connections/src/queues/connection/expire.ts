import { createCron } from '@lowerdeck/cron';
import { subHours, subMinutes } from 'date-fns';
import { db } from '@mtsrc/mcp-runtime-db';
import { env } from '@mtsrc/mcp-runtime-env';

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
