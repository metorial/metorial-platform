import { createQueue as innerCreateQueue } from '@lowerdeck/queue';
import { getConfig } from '@metorial/config';
import type { JobsOptions, QueueOptions, WorkerOptions } from 'bullmq';

export let createQueue = <JobData>(opts: {
  driver?: 'bullmq';

  name: string;
  jobOpts?: JobsOptions;
  queueOpts?: Omit<QueueOptions, 'connection'>;
  workerOpts?: Omit<WorkerOptions, 'connection'>;
}) => {
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
