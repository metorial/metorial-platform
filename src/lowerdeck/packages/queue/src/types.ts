import type { Job } from 'bullmq';

export interface IQueueProcessor {
  start: () => Promise<{ close: () => any } | undefined | void>;
}

export interface IQueue<JobData, QueueOptions> {
  name: string;
  add(payload: JobData, opts?: QueueOptions): Promise<{}>;
  addMany(payloads: JobData[], opts?: QueueOptions): Promise<void>;
  addManyWithOps(
    payloads: {
      data: JobData;
      opts?: QueueOptions;
    }[]
  ): Promise<void>;
  process(cb: (payload: JobData, job: Job) => Promise<void>): IQueueProcessor;
}
