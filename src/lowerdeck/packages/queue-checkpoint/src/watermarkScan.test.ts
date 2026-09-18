import { describe, expect, it } from 'vitest';
import { createQueueCheckpoint, QueueCheckpointRow } from './queueCheckpoint';
import {
  commitWatermarkScan,
  enqueueWatermarkScan,
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
      },
      create: async (args: { data: QueueCheckpointRow }) => {
        if (rows.has(args.data.queue)) throw new Error('unique');
        rows.set(args.data.queue, args.data);
      },
      updateMany: async (args: {
        where: { queue: string; processedThrough: { lt: Date } };
        data: { processedThrough: Date };
      }) => {
        let existing = rows.get(args.where.queue);
        if (
          !existing ||
          existing.processedThrough.getTime() >= args.where.processedThrough.lt.getTime()
        ) {
          return { count: 0 };
        }
        rows.set(args.where.queue, {
          ...existing,
          processedThrough: args.data.processedThrough
        });
        return { count: 1 };
      }
    }
  };
};

describe('startWatermarkScan', () => {
  it('peeks at a full pass without consuming the interval', async () => {
    let db = createDb([{ queue: 'q', processedThrough: new Date('2026-01-01T00:00:00Z') }]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q' });

    let first = await startWatermarkScan({ checkpoint });
    let second = await startWatermarkScan({ checkpoint });

    expect(first.fullPass).toBe(true);
    expect(second.fullPass).toBe(true);
    expect(db.rows.has('q#full-pass')).toBe(false);
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
    expect(job.fullPass).toBeUndefined();
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
    expect(job.fullPass).toBeUndefined();
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

  it('keeps a later watermark when an older overlapping scan drains second', async () => {
    let db = createDb([{ queue: 'q#full-pass', processedThrough: new Date() }]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q', overlapMs: 0 });

    await commitWatermarkScan({
      checkpoint,
      job: { startedAt: '2026-01-01T13:00:00.000Z' }
    });
    await commitWatermarkScan({
      checkpoint,
      job: { startedAt: '2026-01-01T12:00:00.000Z' }
    });

    expect((await checkpoint.since())?.toISOString()).toBe('2026-01-01T13:00:00.000Z');
  });
});

describe('enqueueWatermarkScan', () => {
  it('claims a full pass only after the scan head is queued', async () => {
    let db = createDb([{ queue: 'q', processedThrough: new Date('2026-01-01T00:00:00Z') }]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q' });
    let added: unknown[] = [];

    await enqueueWatermarkScan({
      checkpoint,
      queue: {
        add: async (job, opts) => {
          added.push({ job, opts });
        }
      }
    });

    expect(added).toEqual([
      {
        job: expect.objectContaining({ fullPass: true, startedAt: expect.any(String) }),
        opts: { id: 'scan' }
      }
    ]);
    expect(db.rows.has('q#full-pass')).toBe(true);
  });

  it('does not claim when enqueue fails', async () => {
    let db = createDb([{ queue: 'q', processedThrough: new Date('2026-01-01T00:00:00Z') }]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q' });

    await expect(
      enqueueWatermarkScan({
        checkpoint,
        queue: {
          add: async () => {
            throw new Error('redis down');
          }
        }
      })
    ).rejects.toThrow('redis down');

    expect(db.rows.has('q#full-pass')).toBe(false);
  });

  it('promotes to a full pass only once across repeated hourly ticks', async () => {
    let db = createDb([{ queue: 'q', processedThrough: new Date('2026-01-01T00:00:00Z') }]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q' });
    let jobs: { fullPass?: true }[] = [];

    for (let tick = 0; tick < 24; tick++) {
      await enqueueWatermarkScan({
        checkpoint,
        queue: {
          add: async job => {
            jobs.push(job);
          }
        }
      });
    }

    expect(jobs.filter(job => job.fullPass).length).toBe(1);
    expect(jobs.filter(job => job.since).length).toBe(23);
  });

  it('does not claim an explicit full override', async () => {
    let db = createDb([{ queue: 'q', processedThrough: new Date('2026-01-01T12:00:00Z') }]);
    let checkpoint = createQueueCheckpoint({ db, queue: 'q' });

    await enqueueWatermarkScan({
      checkpoint,
      queue: { add: async () => {} },
      full: true
    });

    expect(db.rows.has('q#full-pass')).toBe(false);
  });
});
