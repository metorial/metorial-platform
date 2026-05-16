type BatchProcessorFn<T> = (batch: T[]) => void | Promise<void>;

export class BatchProcessor<T> {
  private batch: T[] = [];
  private readonly processor: BatchProcessorFn<T>;
  private readonly batchSize: number;

  private processing: Promise<void> | null = null;

  public put = async (data: T): Promise<void> => {
    await this.waitForProcessing();

    this.batch.push(data);

    if (this.batch.length >= this.batchSize) {
      await this.processCurrentBatch();
    }
  };

  public flush = async (): Promise<void> => {
    await this.waitForProcessing();

    if (this.batch.length === 0) {
      return;
    }

    await this.processCurrentBatch();
  };

  public clear = async (): Promise<void> => {
    await this.waitForProcessing();
    this.batch = [];
  };

  public constructor(processor: BatchProcessorFn<T>, batchSize: number) {
    if (batchSize <= 0) {
      throw new Error('batchSize must be greater than 0');
    }

    this.processor = processor;
    this.batchSize = batchSize;
  }

  private waitForProcessing = async (): Promise<void> => {
    while (this.processing !== null) {
      await this.processing;
    }
  };

  private processCurrentBatch = async (): Promise<void> => {
    let batchToProcess = this.batch;

    this.batch = [];

    this.processing = Promise.resolve(this.processor(batchToProcess));

    try {
      await this.processing;
    } finally {
      this.processing = null;
    }
  };
}
