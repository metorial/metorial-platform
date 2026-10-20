import type { IQueue } from '../types';

export let isOfflineQueueMode = () => process.env.LOWERDECK_OFFLINE == '1';

export let createOfflineQueue = <JobData, QueueOptions>(opts: {
  name: string;
}): IQueue<JobData, QueueOptions> => ({
  name: opts.name,
  add: async () => ({}),
  addMany: async () => {},
  addManyWithOps: async () => {},
  process: () => ({ start: async () => {} })
});
