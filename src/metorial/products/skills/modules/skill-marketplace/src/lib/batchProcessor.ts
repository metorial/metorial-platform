type BatchProcessorFn<T> = (batch: T[]) => void | Promise<void>;

type BatchByteBudget<T> = {
  maxBytes: number;
  getBytes: (item: T) => number;
};

export class BatchProcessor<T> {
  private batch: T[] = [];
  private batchBytes = 0;
  private readonly processor: BatchProcessorFn<T>;
  private readonly batchSize: number;
  private readonly byteBudget: BatchByteBudget<T> | null;

  private processing: Promise<void> | null = null;

  public put = async (data: T): Promise<void> => {
    await this.waitForProcessing();

    let bytes = this.byteBudget?.getBytes(data) ?? 0;

    if (
      this.byteBudget &&
      this.batch.length > 0 &&
      this.batchBytes + bytes > this.byteBudget.maxBytes
    ) {
      await this.processCurrentBatch();
    }

    this.batch.push(data);
    this.batchBytes += bytes;

    if (
      this.batch.length >= this.batchSize ||
      (this.byteBudget && this.batchBytes >= this.byteBudget.maxBytes)
    ) {
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
    this.batchBytes = 0;
  };

  public constructor(
    processor: BatchProcessorFn<T>,
    batchSize: number,
    byteBudget?: BatchByteBudget<T>
  ) {
    if (batchSize <= 0) {
      throw new Error('batchSize must be greater than 0');
    }

    if (byteBudget && byteBudget.maxBytes <= 0) {
      throw new Error('maxBytes must be greater than 0');
    }

    this.processor = processor;
    this.batchSize = batchSize;
    this.byteBudget = byteBudget ?? null;
  }

  private waitForProcessing = async (): Promise<void> => {
    while (this.processing !== null) {
      await this.processing;
    }
  };

  private processCurrentBatch = async (): Promise<void> => {
    let batchToProcess = this.batch;

    this.batch = [];
    this.batchBytes = 0;

    this.processing = Promise.resolve(this.processor(batchToProcess));

    try {
      await this.processing;
    } finally {
      this.processing = null;
    }
  };
}
