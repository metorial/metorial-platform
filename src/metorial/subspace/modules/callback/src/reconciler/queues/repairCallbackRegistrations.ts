import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import {
  reconcileCallbackRegistrationQueue,
  repairCallbackRegistrationsQueue
} from './definitions';

export let repairCallbackRegistrationsQueueProcessor =
  repairCallbackRegistrationsQueue.process(async data => {
    let rows = await db.callbackInstance.findMany({
      where: {
        slateTriggerReceiverId: { not: null },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 250,
      select: { id: true }
    });
    await reconcileCallbackRegistrationQueue.addManyWithOps(
      rows.map(row => ({
        data: { callbackInstanceId: row.id },
        opts: { id: `registration:${row.id}` }
      }))
    );
    if (rows.length === 250) {
      await repairCallbackRegistrationsQueue.add({ cursor: rows[rows.length - 1]!.id });
    }
  });

export let repairCallbackRegistrationsCron = createCron(
  {
    name: 'sub/callback/registration/repair/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '*/5 * * * *'
  },
  async () => {
    await repairCallbackRegistrationsQueue.add({}, { id: 'periodic' });
  }
);
