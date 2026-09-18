import { describe, expect, it } from 'vitest';
import { createQueueCheckpoint, QueueCheckpointRow } from './queueCheckpoint';
import {
  commitWatermarkScan,
  startWatermarkScan,
  watermarkScanWhere
} from './watermarkScan';

let createDb = (initial?: QueueCheckpointRow[]) => {
  let rows = new Map<string, QueueCheckpointRow>();
  for (let row of initial ?? []) rows.set(row.queue, row);

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

describe('startWatermarkScan', () => {
  it('promotes to a full pass only once across repeated hourly ticks', async () => {
    let db = createDb([
      { queue: 'q', processedThrough: new Date('2026-01-01T00:00:00Z') }
    ]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q' });

    let full = 0;
    for (let tick = 0; tick < 24; tick++) {
      let job = await startWatermarkScan({ checkpoint });
      if (job.since === undefined) full++;
    }

    expect(full).toBe(1);
  });

  it('carries the watermark on a non-full pass', async () => {
    let processedThrough = new Date('2026-01-01T12:00:00Z');
    let db = createDb([
      { queue: 'q', processedThrough },
      { queue: 'q#full-pass', processedThrough: new Date() }
    ]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q', overlapMs: 0 });

    let job = await startWatermarkScan({ checkpoint });

    expect(job.since).toBe(processedThrough.toISOString());
    expect(watermarkScanWhere(job)).toEqual({ updatedAt: { gte: processedThrough } });
  });

  it('honours an explicit full override without consuming the interval', async () => {
    let db = createDb([
      { queue: 'q', processedThrough: new Date('2026-01-01T12:00:00Z') },
      { queue: 'q#full-pass', processedThrough: new Date() }
    ]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q' });

    let job = await startWatermarkScan({ checkpoint, full: true });

    expect(job.since).toBeUndefined();
    expect(watermarkScanWhere(job)).toEqual({});
  });

  it('commits the scan start time so the next run resumes from it', async () => {
    let db = createDb([{ queue: 'q#full-pass', processedThrough: new Date() }]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q', overlapMs: 0 });

    let job = await startWatermarkScan({ checkpoint });
    await commitWatermarkScan({ checkpoint, job });

    expect((await checkpoint.since())?.toISOString()).toBe(job.startedAt);
  });

  it('does not move the watermark when the job never started one', async () => {
    let db = createDb();
    let checkpoint = createQueueCheckpoint({ db, queue: 'q', overlapMs: 0 });

    await commitWatermarkScan({ checkpoint, job: {} });

    expect(await checkpoint.since()).toBeUndefined();
  });
});
