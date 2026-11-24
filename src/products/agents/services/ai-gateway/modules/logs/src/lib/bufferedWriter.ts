export type BufferedWriterOptions<T> = {
  write: (items: T[]) => Promise<void>;
  flushIntervalMs: number;
  maxBatch: number;
  maxBuffered: number;
  onDrop?: (dropped: number, reason: 'overflow' | 'write_failed', error?: unknown) => void;
};

// Inference must never wait on (or fail because of) the log store, so writes are buffered and
// flushed in batches. A batch that fails is retried once with the next flush; if the store stays
// down the buffer is capped and the oldest entries are dropped.
export let createBufferedWriter = <T>(opts: BufferedWriterOptions<T>) => {
  let buffer: T[] = [];
  let retry: T[] | null = null;
  let flushing: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  let trim = () => {
    let overflow = buffer.length - opts.maxBuffered;
    if (overflow > 0) {
      buffer.splice(0, overflow);
      opts.onDrop?.(overflow, 'overflow');
    }
  };

  let writeBatch = async (batch: T[], isRetry: boolean) => {
    try {
      await opts.write(batch);
    } catch (error) {
      if (isRetry) opts.onDrop?.(batch.length, 'write_failed', error);
      else retry = [...(retry ?? []), ...batch];
    }
  };

  let flushOnce = async () => {
    if (retry) {
      let pending = retry;
      retry = null;
      await writeBatch(pending, true);
    }

    while (buffer.length) {
      await writeBatch(buffer.splice(0, opts.maxBatch), false);
    }
  };

  let flush = async () => {
    while (flushing) await flushing;
    if (!buffer.length && !retry) return;

    flushing = flushOnce().finally(() => {
      flushing = null;
    });

    await flushing;
  };

  let ensureTimer = () => {
    if (timer) return;

    timer = setInterval(() => void flush(), opts.flushIntervalMs);
    (timer as { unref?: () => void }).unref?.();
  };

  return {
    push: (item: T) => {
      buffer.push(item);
      trim();
      ensureTimer();

      if (buffer.length >= opts.maxBatch && !flushing) void flush();
    },

    flush,

    close: async () => {
      if (timer) clearInterval(timer);
      timer = null;

      await flush();
    },

    get size() {
      return buffer.length + (retry?.length ?? 0);
    }
  };
};
