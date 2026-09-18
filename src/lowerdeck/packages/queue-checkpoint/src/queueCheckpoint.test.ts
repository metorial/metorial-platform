import { describe, expect, it } from 'vitest';
import { createQueueCheckpoint, QueueCheckpointRow } from './queueCheckpoint';

let createDb = (initial?: QueueCheckpointRow) => {
  let rows = new Map<string, QueueCheckpointRow>();
  if (initial) rows.set(initial.queue, initial);

  return {
    rows,
    queueCheckpoint: {
      findUnique: async (args: { where: { queue: string } }) =>
        rows.get(args.where.queue) ?? null,
      upsert: async (args: {
        where: { queue: string };
        create: QueueCheckpointRow;
        update: { processedThrough: Date };
      }) => {
        let existing = rows.get(args.where.queue);
        rows.set(
          args.where.queue,
          existing
            ? { ...existing, processedThrough: args.update.processedThrough }
            : args.create
        );
      }
    }
  };
};

describe('createQueueCheckpoint', () => {
  it('returns undefined on a missing row so the first run is a full sweep', async () => {
    let checkpoint = createQueueCheckpoint({ db: createDb(), queue: 'q' });

    expect(await checkpoint.since()).toBeUndefined();
  });

  it('subtracts the overlap from the stored watermark', async () => {
    let processedThrough = new Date('2026-01-01T12:00:00Z');
    let checkpoint = createQueueCheckpoint({
      db: createDb({ queue: 'q', processedThrough }),
      queue: 'q',
      overlapMs: 60_000
    });

    expect((await checkpoint.since())?.toISOString()).toBe('2026-01-01T11:59:00.000Z');
  });

  it('clamps to maxLookbackMs when the watermark is far behind', async () => {
    let checkpoint = createQueueCheckpoint({
      db: createDb({ queue: 'q', processedThrough: new Date('2020-01-01T00:00:00Z') }),
      queue: 'q',
      maxLookbackMs: 60_000
    });

    let since = await checkpoint.since();
    expect(since!.getTime()).toBeGreaterThan(Date.now() - 65_000);
  });

  it('round-trips a committed watermark', async () => {
    let db = createDb();
    let checkpoint = createQueueCheckpoint({ db, queue: 'q', overlapMs: 0 });

    let through = new Date('2026-01-01T12:00:00Z');
    await checkpoint.commit(through);

    expect((await checkpoint.since())?.getTime()).toBe(through.getTime());

    let later = new Date('2026-01-01T13:00:00Z');
    await checkpoint.commit(later);
    expect((await checkpoint.since())?.getTime()).toBe(later.getTime());
  });

  it('reset forces the next run back to a full sweep window', async () => {
    let db = createDb();
    let checkpoint = createQueueCheckpoint({ db, queue: 'q', overlapMs: 0 });

    await checkpoint.commit(new Date('2026-01-01T12:00:00Z'));
    await checkpoint.reset();

    expect((await checkpoint.since())?.getTime()).toBe(0);
  });
});
