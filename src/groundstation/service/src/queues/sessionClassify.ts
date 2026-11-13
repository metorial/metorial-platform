import { createQueue } from '@lowerdeck/queue';
import type { ClassificationReason } from '../classification/policy';
import { classifySession } from '../classification/run';
import { env } from '../env';

export let sessionClassifyQueue = createQueue<{
  sessionKey: string;
  reason: ClassificationReason;
}>({
  name: 'gs/session/classify',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let sessionClassifyProcessor = sessionClassifyQueue.process(async data => {
  await classifySession({ sessionKey: data.sessionKey, reason: data.reason });
});
