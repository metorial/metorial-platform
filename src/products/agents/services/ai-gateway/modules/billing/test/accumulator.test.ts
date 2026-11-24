import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBillingAccumulator, type BillingCharge } from '../src/lib/accumulator';

let setup = (write?: (charge: BillingCharge) => Promise<void>) => {
  let writes: BillingCharge[] = [];
  let onError = vi.fn();

  let accumulator = createBillingAccumulator({
    flushIntervalMs: 1000,
    writeConcurrency: 2,
    write: write ?? (async charge => void writes.push(charge)),
    onError
  });

  return { accumulator, writes, onError };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createBillingAccumulator', () => {
  it('sums charges per project and writes one increment per project', async () => {
    let { accumulator, writes } = setup();

    accumulator.add({ projectId: 'a', costNanoUsd: 100n, requestCount: 1 });
    accumulator.add({ projectId: 'b', costNanoUsd: 7n, requestCount: 1 });
    accumulator.add({ projectId: 'a', costNanoUsd: 50n, requestCount: 0 });
    await accumulator.flush();

    expect(writes).toEqual([
      { projectId: 'a', costNanoUsd: 150n, requestCount: 1 },
      { projectId: 'b', costNanoUsd: 7n, requestCount: 1 }
    ]);
    expect(accumulator.pending()).toEqual([]);
  });

  it('ignores empty charges', async () => {
    let { accumulator, writes } = setup();

    accumulator.add({ projectId: 'a', costNanoUsd: 0n, requestCount: 0 });
    await accumulator.flush();

    expect(writes).toEqual([]);
  });

  it('keeps a request without cost, so request counts stay exact', async () => {
    let { accumulator, writes } = setup();

    accumulator.add({ projectId: 'a', costNanoUsd: 0n, requestCount: 1 });
    await accumulator.flush();

    expect(writes).toEqual([{ projectId: 'a', costNanoUsd: 0n, requestCount: 1 }]);
  });

  it('keeps a failed write and merges it with later charges', async () => {
    let attempts = 0;
    let writes: BillingCharge[] = [];
    let { accumulator, onError } = setup(async charge => {
      if (++attempts == 1) throw new Error('database down');
      writes.push(charge);
    });

    accumulator.add({ projectId: 'a', costNanoUsd: 100n, requestCount: 1 });
    await accumulator.flush();

    expect(onError).toHaveBeenCalledOnce();
    expect(accumulator.pending()).toEqual([
      { projectId: 'a', costNanoUsd: 100n, requestCount: 1 }
    ]);

    accumulator.add({ projectId: 'a', costNanoUsd: 5n, requestCount: 1 });
    await accumulator.flush();

    expect(writes).toEqual([{ projectId: 'a', costNanoUsd: 105n, requestCount: 2 }]);
  });

  it('only retries the projects whose write failed', async () => {
    let writes: BillingCharge[] = [];
    let { accumulator } = setup(async charge => {
      if (charge.projectId == 'b') throw new Error('nope');
      writes.push(charge);
    });

    accumulator.add({ projectId: 'a', costNanoUsd: 1n, requestCount: 1 });
    accumulator.add({ projectId: 'b', costNanoUsd: 2n, requestCount: 1 });
    accumulator.add({ projectId: 'c', costNanoUsd: 3n, requestCount: 1 });
    await accumulator.flush();

    expect(writes.map(charge => charge.projectId)).toEqual(['a', 'c']);
    expect(accumulator.pending()).toEqual([
      { projectId: 'b', costNanoUsd: 2n, requestCount: 1 }
    ]);
  });

  it('keeps charges that arrive while a flush is writing for the next flush', async () => {
    let release!: () => void;
    let writes: BillingCharge[] = [];
    let { accumulator } = setup(async charge => {
      if (!writes.length) await new Promise<void>(resolve => (release = resolve));
      writes.push(charge);
    });

    accumulator.add({ projectId: 'a', costNanoUsd: 1n, requestCount: 1 });
    let first = accumulator.flush();
    await Promise.resolve();

    accumulator.add({ projectId: 'a', costNanoUsd: 2n, requestCount: 1 });
    let second = accumulator.flush();

    release();
    await Promise.all([first, second]);

    expect(writes).toEqual([
      { projectId: 'a', costNanoUsd: 1n, requestCount: 1 },
      { projectId: 'a', costNanoUsd: 2n, requestCount: 1 }
    ]);
  });

  it('writes in bounded batches', async () => {
    let inFlight = 0;
    let peak = 0;
    let { accumulator } = setup(async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise(resolve => setTimeout(resolve, 1));
      inFlight--;
    });

    for (let i = 0; i < 7; i++) {
      accumulator.add({ projectId: `p${i}`, costNanoUsd: 1n, requestCount: 1 });
    }
    await accumulator.flush();

    expect(peak).toBe(2);
  });

  it('flushes on its interval once something was charged', async () => {
    vi.useFakeTimers();
    let { accumulator, writes } = setup();

    await vi.advanceTimersByTimeAsync(5000);
    expect(writes).toEqual([]);

    accumulator.add({ projectId: 'a', costNanoUsd: 1n, requestCount: 1 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(writes).toHaveLength(1);
  });

  it('flushes what is left when it closes', async () => {
    let { accumulator, writes } = setup();

    accumulator.add({ projectId: 'a', costNanoUsd: 9n, requestCount: 1 });
    await accumulator.close();

    expect(writes).toEqual([{ projectId: 'a', costNanoUsd: 9n, requestCount: 1 }]);
  });
});
