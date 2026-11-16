import { createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { settleSession } from '../lib/settle';

let settleDelayMs = 30_000;

export let sessionSettleQueue = createQueue<{ sessionKey: string }>({
  name: 'at/session/settle',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let sessionSettleProcessor = sessionSettleQueue.process(async data => {
  await settleSession({ sessionKey: data.sessionKey });
});

// Deduplicated rather than keyed by job id: a job id also swallows adds while the job is running,
// which would drop records that land mid-settle. Throttling only ignores adds while one waits.
export let queueSessionSettle = async (sessionKeys: string[]) => {
  if (!sessionKeys.length) return;

  await sessionSettleQueue.addManyWithOps(
    sessionKeys.map(sessionKey => ({
      data: { sessionKey },
      opts: {
        delay: settleDelayMs,
        deduplication: { id: `settle:${sessionKey}`, ttl: settleDelayMs }
      }
    }))
  );
};
