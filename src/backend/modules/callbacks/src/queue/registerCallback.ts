import { db, ID } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { installCallbackQueue } from './installCallback';

export let registerCallbackQueue = createQueue<{ callbackId: string; lambdaId: string }>({
  name: 'clb/clb/reg'
});

export let registerCallbackQueueProcessor = registerCallbackQueue.process(async data => {
  let callback = await db.callback.findFirst({
    where: { id: data.callbackId },
    include: { hooks: true, instance: true }
  });
  if (!callback) throw new QueueRetryError();

  let lambda = await db.lambdaServerInstance.findFirst({
    where: { id: data.lambdaId }
  });
  if (!lambda) throw new QueueRetryError();

  if (callback.eventType == 'webhook') {
    await installCallbackQueue.add({
      callbackId: callback.id,
      lambdaId: lambda.id
    });
  }

  if (callback.eventType == 'polling') {
    await db.callbackSchedule.upsert({
      where: { callbackOid: callback.oid },
      update: {},
      create: {
        id: await ID.generateId('callbackSchedule'),
        callbackOid: callback.oid,
        intervalSeconds: callback.intervalSeconds,
        nextRunAt: new Date(),
        state: null
      }
    });
  }
});
