import { createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { protoGuardMessageRunService } from '../internal/messageRun';
import type { PersistMessageScanJob } from '../lib/persistJob';

export let persistMessageScanQueue = createQueue<PersistMessageScanJob>({
  name: 'sub/pg/persist',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let persistMessageScanQueueProcessor = persistMessageScanQueue.process(async job => {
  await protoGuardMessageRunService.persistMessageScan({ job });
});
