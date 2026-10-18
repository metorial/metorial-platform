import { createCron } from '@lowerdeck/cron';
import {
  combineQueueProcessors,
  createQueue,
  deleteInChunks,
  hourlyPacedDelay
} from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { subHours } from 'date-fns';
import { env } from '../env';

let USAGE_RECORD_RETENTION_HOURS = 2;
let USAGE_RECORD_DELETE_CHUNK_SIZE = 5000;
let USAGE_RECORD_DELETE_MAX_CHUNKS = 10;

let connectionCleanupTriggerCron = createCron(
  {
    name: 'sub/con/cleanup',
    cron: '15 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await providerRunUsageRecordCleanupQueue.add({
      cutoff: subHours(new Date(), USAGE_RECORD_RETENTION_HOURS).toISOString()
    });
  }
);

let providerRunUsageRecordCleanupQueue = createQueue<{ cutoff: string }>({
  name: 'sub/con/cleanup/prur',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let providerRunUsageRecordCleanupProcessor = providerRunUsageRecordCleanupQueue.process(
  async data => {
    let cutoff = new Date(data.cutoff);

    let { hasMore } = await deleteInChunks({
      chunkSize: USAGE_RECORD_DELETE_CHUNK_SIZE,
      maxChunks: USAGE_RECORD_DELETE_MAX_CHUNKS,
      selectKeys: take =>
        db.providerRunUsageRecord.findMany({
          where: { createdAt: { lt: cutoff } },
          take,
          select: { id: true }
        }),
      deleteKeys: keys =>
        db.providerRunUsageRecord.deleteMany({
          where: { id: { in: keys.map(key => key.id) } }
        })
    });

    if (hasMore) {
      await providerRunUsageRecordCleanupQueue.add(data, hourlyPacedDelay());
    }
  }
);

export let connectionCleanupCron = combineQueueProcessors([
  connectionCleanupTriggerCron,
  providerRunUsageRecordCleanupProcessor
]);
