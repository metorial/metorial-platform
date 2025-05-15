import type { DebounceOptions, Job } from 'bullmq';

export interface IQueueOptions {
  delay?: number;
  id?: string;
  deduplication?: DebounceOptions;
}

export interface IQueueProcessor {
  start: () => Promise<{ close: () => any } | undefined | void>;
}

export interface IQueue<JobData> {
  name: string;
  add(payload: JobData, opts?: IQueueOptions): Promise<{}>;
  addMany(payloads: JobData[], opts?: IQueueOptions): Promise<void>;
  addManyWithOps(
    payloads: {
      data: JobData;
      opts?: IQueueOptions;
    }[]
  ): Promise<void>;
  process(cb: (payload: JobData, job: Job) => Promise<void>): IQueueProcessor;
}
