import { describe, expect, it } from 'vitest';

import { BatchProcessor } from './batchProcessor';

type Item = { name: string; bytes: number };

let collect = (batchSize: number, budget?: { maxBytes: number }) => {
  let batches: string[][] = [];

  let processor = new BatchProcessor<Item>(
    async batch => {
      batches.push(batch.map(item => item.name));
    },
    batchSize,
    budget ? { maxBytes: budget.maxBytes, getBytes: item => item.bytes } : undefined
  );

  return { processor, batches };
};

describe('BatchProcessor', () => {
  it('flushes on the count limit when no budget is set', async () => {
    let { processor, batches } = collect(2);

    for (let name of ['a', 'b', 'c']) await processor.put({ name, bytes: 1_000_000 });
    await processor.flush();

    expect(batches).toEqual([['a', 'b'], ['c']]);
  });

  it('flushes on the byte budget before the count limit', async () => {
    let { processor, batches } = collect(10, { maxBytes: 100 });

    await processor.put({ name: 'a', bytes: 60 });
    await processor.put({ name: 'b', bytes: 60 });
    await processor.flush();

    // 'b' would have pushed the batch to 120 bytes, so 'a' went out alone.
    expect(batches).toEqual([['a'], ['b']]);
  });

  it('fills a batch up to the budget', async () => {
    let { processor, batches } = collect(10, { maxBytes: 100 });

    await processor.put({ name: 'a', bytes: 40 });
    await processor.put({ name: 'b', bytes: 40 });
    await processor.put({ name: 'c', bytes: 40 });
    await processor.flush();

    expect(batches).toEqual([
      ['a', 'b'],
      ['c']
    ]);
  });

  it('sends an oversized item on its own rather than dropping it', async () => {
    let { processor, batches } = collect(10, { maxBytes: 100 });

    await processor.put({ name: 'small', bytes: 10 });
    await processor.put({ name: 'huge', bytes: 5_000 });
    await processor.put({ name: 'after', bytes: 10 });
    await processor.flush();

    expect(batches).toEqual([['small'], ['huge'], ['after']]);
  });

  it('still honours the count limit when a budget is set', async () => {
    let { processor, batches } = collect(2, { maxBytes: 1_000_000 });

    for (let name of ['a', 'b', 'c']) await processor.put({ name, bytes: 1 });
    await processor.flush();

    expect(batches).toEqual([['a', 'b'], ['c']]);
  });

  it('resets the running total between batches', async () => {
    let { processor, batches } = collect(10, { maxBytes: 100 });

    await processor.put({ name: 'a', bytes: 90 });
    await processor.put({ name: 'b', bytes: 90 });
    await processor.put({ name: 'c', bytes: 5 });
    await processor.flush();

    // If the total leaked across batches, 'c' would have been split off too.
    expect(batches).toEqual([['a'], ['b', 'c']]);
  });

  it('does nothing on an empty flush', async () => {
    let { processor, batches } = collect(5, { maxBytes: 100 });

    await processor.flush();

    expect(batches).toEqual([]);
  });

  it('rejects a non-positive budget', () => {
    expect(
      () => new BatchProcessor<Item>(async () => {}, 5, { maxBytes: 0, getBytes: () => 1 })
    ).toThrow('maxBytes must be greater than 0');
  });
});
