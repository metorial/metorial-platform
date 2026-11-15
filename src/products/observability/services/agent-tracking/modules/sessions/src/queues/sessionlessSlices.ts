import { createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { settleSessionless } from '../lib/sessionless';

let settleDelayMs = 30_000;

export type SessionlessBucket = { organizationId: string; instanceId: string; bucket: string };

export let sessionlessSlicesQueue = createQueue<SessionlessBucket>({
  name: 'at/slices/sessionless',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let sessionlessSlicesProcessor = sessionlessSlicesQueue.process(async data => {
  await settleSessionless({
    organizationId: data.organizationId,
    instanceId: data.instanceId,
    bucket: new Date(data.bucket)
  });
});

export let queueSessionlessSlices = async (buckets: SessionlessBucket[]) => {
  if (!buckets.length) return;

  await sessionlessSlicesQueue.addManyWithOps(
    buckets.map(bucket => ({
      data: bucket,
      opts: {
        delay: settleDelayMs,
        deduplication: {
          id: `sessionless:${bucket.instanceId}:${bucket.bucket}`,
          ttl: settleDelayMs
        }
      }
    }))
  );
};
