import { createQueue as innerCreateQueue } from '@lowerdeck/queue';
import type { BullMqCreateOptions } from '@lowerdeck/queue/dist/drivers/bullmq';
import { getConfig } from '@metorial/config';

export let createQueue = <JobData>(
  opts: { driver?: 'bullmq' } & Omit<BullMqCreateOptions, 'redisUrl'>
) => {
  opts.name = `mte/${opts.name}`;

  return innerCreateQueue<JobData>({
    ...opts,
    redisUrl: getConfig().redisUrl
  });
};

export {
  combineQueueProcessors,
  QueueRetryError,
  runQueueProcessors,
  type IQueue,
  type IQueueProcessor
} from '@lowerdeck/queue';
