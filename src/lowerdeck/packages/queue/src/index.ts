import { createBullMqQueue } from './drivers/bullmq';
import type { BullMqCreateOptions } from './drivers/bullmq';
import type { IQueueProcessor } from './types';

export type { BullMqCreateOptions, BullMqQueueOptions } from './drivers/bullmq';
export * from './lib/queueRetryError';
export * from './types';

let seenNames = new Set<string>();

export let createQueue = <JobData>(opts: { driver?: 'bullmq' } & BullMqCreateOptions) => {
  if (!opts.driver) opts.driver = 'bullmq';

  if (seenNames.has(opts.name)) {
    throw new Error(`Queue with name ${opts.name} already exists`);
  }
  seenNames.add(opts.name);

  return createBullMqQueue<JobData>({
    name: opts.name,
    redisUrl: opts.redisUrl,

    jobOpts: opts.jobOpts,
    queueOpts: opts.queueOpts,
    workerOpts: opts.workerOpts
  });
};

export let combineQueueProcessors = (opts: IQueueProcessor[]): IQueueProcessor => {
  return {
    start: async () => {
      let processors: Awaited<ReturnType<IQueueProcessor['start']>>[] = [];

      // Processor trees can contain hundreds of BullMQ workers. Starting the tree with
      // Promise.all creates a Redis connection storm and immediately drains every queue
      // at once. Waiting for each child also makes nested processor groups naturally
      // bounded without a global semaphore or deadlocks.
      try {
        for (let processor of opts) {
          processors.push(await processor.start());
        }
      } catch (error) {
        // A partially started worker must not remain alive without a health endpoint.
        await Promise.allSettled(
          processors.reverse().map(async processor => await processor?.close?.())
        );
        throw error;
      }

      return {
        close: async () => {
          await Promise.all(processors.map(x => x?.close?.()));
        }
      };
    }
  };
};

export let runQueueProcessors = async (processor: IQueueProcessor[]) => {
  let combined = combineQueueProcessors(processor);

  let res = await combined.start();

  process.on('SIGINT', async () => {
    await res?.close();
  });

  process.on('SIGTERM', async () => {
    await res?.close();
  });

  return res;
};
