import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findEmail: vi.fn(),
  enqueue: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({ process: (processor: unknown) => processor }),
  QueueRetryError: class extends Error {}
}));
vi.mock('../db', () => ({
  db: { outgoingEmail: { findFirst: mocks.findEmail } }
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));
vi.mock('./sendEmailSingle', () => ({
  sendEmailSingleQueue: { addManyWithOps: mocks.enqueue }
}));

import { sendEmailQueueProcessor } from './sendEmail';

let processEmail = sendEmailQueueProcessor as unknown as (data: {
  emailId: string;
}) => Promise<void>;

describe('Relay destination fan-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueue.mockResolvedValue(undefined);
  });

  it('uses stable, distinct, non-integer job IDs for pending and retry destinations', async () => {
    let pendingId = 9007199254740993n;
    let retryId = 9007199254740994n;

    mocks.findEmail.mockResolvedValue({
      destinations: [
        { id: pendingId, status: 'pending' },
        { id: retryId, status: 'retry' },
        { id: 9007199254740995n, status: 'sent' },
        { id: 9007199254740996n, status: 'failed' }
      ]
    });

    await processEmail({ emailId: 'oe_1' });
    await processEmail({ emailId: 'oe_1' });

    let jobs = mocks.enqueue.mock.calls[0]![0];
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job: { data: unknown }) => job.data)).toEqual([
      { destinationId: pendingId },
      { destinationId: retryId }
    ]);

    let jobIds = jobs.map((job: { opts: { id: string } }) => job.opts.id);
    expect(new Set(jobIds).size).toBe(2);

    for (let jobId of jobIds) {
      expect(jobId).not.toMatch(/^\d+$/);
      expect(jobId).not.toContain(':');
    }

    expect(mocks.enqueue.mock.calls[1]![0]).toEqual(jobs);
  });
});
