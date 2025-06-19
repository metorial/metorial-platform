import { JobsOptions, QueueOptions, WorkerOptions } from 'bullmq';
import { createBullMqQueue } from './drivers/bullmq';
import { IQueueProcessor } from './types';

export * from './types';

let seenNames = new Set<string>();

export let createQueue = <JobData>(
  opts: { name: string } & {
    driver?: 'bullmq';
    jobOpts?: JobsOptions;
    queueOpts?: Omit<QueueOptions, 'connection'>;
    workerOpts?: Omit<WorkerOptions, 'connection'>;
  }
) => {
  if (!opts.driver) opts.driver = 'bullmq';

  if (seenNames.has(opts.name)) {
    throw new Error(`Queue with name ${opts.name} already exists`);
  }

  if (opts.driver === 'bullmq') {
    return createBullMqQueue<JobData>({
      name: opts.name,
      jobOpts: opts.jobOpts,
      queueOpts: opts.queueOpts,
      workerOpts: opts.workerOpts
    });
  }

  throw new Error(`Unknown queue driver: ${opts.driver}`);
};

export let combineQueueProcessors = (opts: IQueueProcessor[]): IQueueProcessor => {
  return {
    start: async () => {
      let processors = await Promise.all(opts.map(x => x.start()));

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
