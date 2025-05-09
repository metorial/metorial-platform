export interface IQueueOptions {
  delay: number;
}

export interface IQueueProcessor {
  start: () => Promise<{ close: () => any } | undefined | void>;
}

export interface IQueue<JobData> {
  name: string;
  add(
    payload: JobData,
    opts?: IQueueOptions
  ): Promise<{
    waitUntilFinished(opts?: { timeout?: number }): Promise<void>;
  }>;
  addMany(payloads: JobData[], opts?: IQueueOptions): Promise<void>;
  process(cb: (payload: JobData) => Promise<void>): IQueueProcessor;
}
