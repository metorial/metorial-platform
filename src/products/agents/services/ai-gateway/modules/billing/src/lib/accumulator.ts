export type BillingCharge = {
  projectId: string;
  costNanoUsd: bigint;
  requestCount: number;
};

export type BillingAccumulatorOptions = {
  write: (charge: BillingCharge) => Promise<void>;
  flushIntervalMs: number;
  writeConcurrency?: number;
  onError?: (error: unknown, charge: BillingCharge) => void;
};

// Billed usage is summed per project in memory and written as one increment per flush, so
// inference never waits on the database. A failed write keeps its charge for the next flush:
// billing data is never dropped while the process lives.
export let createBillingAccumulator = (opts: BillingAccumulatorOptions) => {
  let writeConcurrency = opts.writeConcurrency ?? 20;
  let pending = new Map<string, Omit<BillingCharge, 'projectId'>>();
  let flushing: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  let merge = (charge: BillingCharge) => {
    let entry = pending.get(charge.projectId);

    pending.set(charge.projectId, {
      costNanoUsd: (entry?.costNanoUsd ?? 0n) + charge.costNanoUsd,
      requestCount: (entry?.requestCount ?? 0) + charge.requestCount
    });
  };

  let ensureTimer = () => {
    if (timer) return;

    timer = setInterval(() => void flush(), opts.flushIntervalMs);
    (timer as { unref?: () => void }).unref?.();
  };

  let flushOnce = async () => {
    let batch = [...pending].map(([projectId, entry]) => ({ projectId, ...entry }));
    pending = new Map();

    for (let i = 0; i < batch.length; i += writeConcurrency) {
      await Promise.all(
        batch.slice(i, i + writeConcurrency).map(async charge => {
          try {
            await opts.write(charge);
          } catch (error) {
            opts.onError?.(error, charge);
            merge(charge);
          }
        })
      );
    }
  };

  let flush = async () => {
    while (flushing) await flushing;
    if (!pending.size) return;

    flushing = flushOnce().finally(() => {
      flushing = null;
    });

    await flushing;
  };

  return {
    add: (charge: BillingCharge) => {
      if (charge.costNanoUsd <= 0n && charge.requestCount <= 0) return;

      merge(charge);
      ensureTimer();
    },

    flush,

    close: async () => {
      if (timer) clearInterval(timer);
      timer = null;

      await flush();
    },

    pending: () => [...pending].map(([projectId, entry]) => ({ projectId, ...entry }))
  };
};

export type BillingAccumulator = ReturnType<typeof createBillingAccumulator>;
