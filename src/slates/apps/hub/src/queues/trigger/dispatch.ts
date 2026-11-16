import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { TRIGGER_DISPATCH_RECHECK_DELAY_MS } from './_config';
import { triggerRawEventMappingQueue } from './rawEventMapping';
import { triggerEventProcessQueue } from './eventProcess';

let batchSize = 500;

export let triggerDispatchQueue = createQueue<{ cursor?: string; cutoff: string }>({
  name: 'shub/trg/dispatch/1',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let triggerDispatchQueueProcessor = triggerDispatchQueue.process(async data => {
  let rows = await db.triggerRawEventDispatch.findMany({
    where: {
      nextAttemptAt: { lte: new Date(data.cutoff) },
      rawEventOid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
    },
    orderBy: { rawEventOid: 'asc' },
    take: batchSize,
    select: { rawEventOid: true, rawEvent: { select: { id: true } } }
  });
  await triggerRawEventMappingQueue.addManyWithOps(
    rows.map(row => ({
      data: { rawEventId: row.rawEvent.id },
      opts: { id: row.rawEvent.id }
    }))
  );
  // The mapping worker removes the outbox only after enqueueing every child.
  await db.triggerRawEventDispatch.updateMany({
    where: { rawEventOid: { in: rows.map(row => row.rawEventOid) } },
    data: { nextAttemptAt: new Date(Date.now() + TRIGGER_DISPATCH_RECHECK_DELAY_MS) }
  });

  if (rows.length === batchSize) {
    await triggerDispatchQueue.add(
      { cutoff: data.cutoff, cursor: rows[rows.length - 1]!.rawEventOid.toString() },
      { delay: 100 }
    );
  }
});

export let triggerDispatchCron = createCron(
  {
    name: 'shub/trg/dispatch/cron/1',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    let cutoff = new Date().toISOString();
    await triggerDispatchQueue.add({ cutoff });
    await triggerMappedDispatchQueue.add({ cutoff });
  }
);

export let triggerMappedDispatchQueue = createQueue<{ cursor?: string; cutoff: string }>({
  name: 'shub/trg/mapped/dispatch/1',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let triggerMappedDispatchQueueProcessor = triggerMappedDispatchQueue.process(
  async data => {
    let rows = await db.triggerEventDispatch.findMany({
      where: {
        nextAttemptAt: { lte: new Date(data.cutoff) },
        eventOid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: { eventOid: 'asc' },
      take: batchSize,
      select: { eventOid: true, event: { select: { id: true } } }
    });
    await triggerEventProcessQueue.addManyWithOps(
      rows.map(row => ({ data: { eventId: row.event.id }, opts: { id: row.event.id } }))
    );
    await db.triggerEventDispatch.updateMany({
      where: { eventOid: { in: rows.map(row => row.eventOid) } },
      data: { nextAttemptAt: new Date(Date.now() + TRIGGER_DISPATCH_RECHECK_DELAY_MS) }
    });
    if (rows.length === batchSize)
      await triggerMappedDispatchQueue.add(
        { cutoff: data.cutoff, cursor: rows[rows.length - 1]!.eventOid.toString() },
        { delay: 100 }
      );
  }
);
