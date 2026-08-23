import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    scmRepository: {
      findMany: vi.fn()
    }
  },
  manyQueue: {
    add: vi.fn(),
    process: vi.fn(() => ({ start: vi.fn() }))
  },
  singleQueue: {
    addManyWithOps: vi.fn()
  }
}));

vi.mock('@lowerdeck/cron', () => ({
  createCron: vi.fn((_options, handler) => ({ start: vi.fn(), handler }))
}));
vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn(processors => ({ processors })),
  createQueue: vi.fn(() => mocks.manyQueue)
}));
vi.mock('../../db', () => ({ db: mocks.db }));
vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));
vi.mock('./createRepoWebhook', () => ({
  createRepoWebhookQueue: mocks.singleQueue
}));

import {
  enqueueRepositoryWebhookReconcilePage,
  enqueueRepositoryWebhookReconcileRun,
  reconcileRepoWebhooksPageSize
} from './reconcileRepoWebhooks';

describe('repository webhook reconciliation fan-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts an hourly run with a deterministic bucket id', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T11:17:00.000Z'));

    await enqueueRepositoryWebhookReconcileRun();

    expect(mocks.manyQueue.add).toHaveBeenCalledWith(
      { runId: String(Math.floor(Date.now() / (60 * 60_000))) },
      {
        id: `webhook-reconcile:${Math.floor(Date.now() / (60 * 60_000))}:page-start`
      }
    );
    vi.useRealTimers();
  });

  it('selects only due repositories and gives single jobs stable run ids', async () => {
    mocks.db.scmRepository.findMany.mockResolvedValue([
      { oid: 11n, id: 'osr_one' },
      { oid: 12n, id: 'osr_two' }
    ]);

    await enqueueRepositoryWebhookReconcilePage({ cursor: '10', runId: 'run' });

    expect(mocks.db.scmRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          oid: { gt: 10n },
          OR: [
            { webhookReconcileBlockedUntil: null },
            { webhookReconcileBlockedUntil: { lte: expect.any(Date) } }
          ]
        },
        orderBy: { oid: 'asc' },
        take: reconcileRepoWebhooksPageSize
      })
    );
    expect(mocks.singleQueue.addManyWithOps).toHaveBeenCalledWith([
      { data: { repoId: 'osr_one' }, opts: { id: 'osr_one:reconcile:run' } },
      { data: { repoId: 'osr_two' }, opts: { id: 'osr_two:reconcile:run' } }
    ]);
    expect(mocks.manyQueue.add).not.toHaveBeenCalled();
  });

  it('chains the next cursor only after a full page', async () => {
    let repos = Array.from({ length: reconcileRepoWebhooksPageSize }, (_, index) => ({
      oid: BigInt(index + 1),
      id: `osr_${index + 1}`
    }));
    mocks.db.scmRepository.findMany.mockResolvedValue(repos);

    await enqueueRepositoryWebhookReconcilePage({ runId: 'run' });

    expect(mocks.manyQueue.add).toHaveBeenCalledWith(
      { cursor: String(reconcileRepoWebhooksPageSize), runId: 'run' },
      {
        id: `webhook-reconcile:run:page:${reconcileRepoWebhooksPageSize}`
      }
    );
  });
});
