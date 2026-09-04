import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { subMinutes } from 'date-fns';
import { env } from '../../env';

export let stopProviderRunsCron = createCron(
  {
    name: 'sub/con/prun/stop',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let twoMinutesAgo = subMinutes(new Date(), 2);

    // This shouldn't happen but if a connection worker
    // crashes while provider runs are active, we need to
    // make sure they get stopped eventually.
    await db.providerRun.updateMany({
      where: {
        status: 'running',
        lastPingAt: { lt: twoMinutesAgo }
      },
      data: {
        status: 'stopped',
        completedAt: new Date()
      }
    });
  }
);
