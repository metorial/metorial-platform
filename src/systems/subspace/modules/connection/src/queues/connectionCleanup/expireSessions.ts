import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { subMinutes } from 'date-fns';
import { env } from '../../env';

export let expireSessionsCron = createCron(
  {
    name: 'sub/con/ses/expire',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let twoMinutesAgo = subMinutes(new Date(), 2);

    await db.session.updateMany({
      where: {
        connectionState: 'connected',
        lastActiveAt: { lt: twoMinutesAgo }
      },
      data: {
        connectionState: 'disconnected'
      }
    });
  }
);
