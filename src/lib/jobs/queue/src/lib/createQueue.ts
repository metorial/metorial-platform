import type { BullMqCreateOptions, BullMqQueueOptions } from '../drivers/bullmq';
import { createBullMqQueue } from '../drivers/bullmq';
import { createOfflineQueue, isOfflineQueueMode } from '../drivers/offline';

let seenNames = new Set<string>();

export let createQueue = <JobData>(opts: { driver?: 'bullmq' } & BullMqCreateOptions) => {
  if (!opts.driver) opts.driver = 'bullmq';

  if (seenNames.has(opts.name)) {
    throw new Error(`Queue with name ${opts.name} already exists`);
  }
  seenNames.add(opts.name);

  if (isOfflineQueueMode()) {
    return createOfflineQueue<JobData, BullMqQueueOptions>({ name: opts.name });
  }

  return createBullMqQueue<JobData>({
    name: opts.name,
    redisUrl: opts.redisUrl,

    jobOpts: opts.jobOpts,
    queueOpts: opts.queueOpts,
    workerOpts: opts.workerOpts
  });
};
