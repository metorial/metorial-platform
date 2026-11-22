import { beforeEach, describe, expect, it, vi } from 'vitest';

let local = vi.hoisted(() => ({
  checkpoints: new Map<string, { commit: ReturnType<typeof vi.fn> }>(),
  enqueueWatermarkScan: vi.fn(),
  syncEntityAddManyWithOps: vi.fn()
}));

vi.mock('@metorial/queue', async () => (await import('./_mocks')).queueModule);

vi.mock('@metorial/db', () => ({
  db: {
    organization: { findUnique: vi.fn() },
    consumer: { findMany: vi.fn() },
    consumerDevice: { findMany: vi.fn() }
  }
}));

vi.mock('@lowerdeck/queue-checkpoint', async () => {
  let actual = await vi.importActual<typeof import('@lowerdeck/queue-checkpoint')>(
    '@lowerdeck/queue-checkpoint'
  );

  return {
    ...actual,
    createQueueCheckpoint: vi.fn((d: { queue: string }) => {
      let checkpoint = local.checkpoints.get(d.queue) ?? { queue: d.queue, commit: vi.fn() };
      local.checkpoints.set(d.queue, checkpoint);

      return checkpoint;
    }),
    enqueueWatermarkScan: local.enqueueWatermarkScan
  };
});

vi.mock('../src/lib/flag', async () => (await import('./_mocks')).flagModule);

vi.mock('../src/queues/syncEntity', () => ({
  backfillSyncEntityLimiter: { max: 10, duration: 1000 },
  backfillSyncEntityQueue: { addManyWithOps: local.syncEntityAddManyWithOps }
}));

import { db } from '@metorial/db';
import { pacedDelay } from '@metorial/queue';
import {
  backfillEntitiesQueue,
  backfillEntitiesQueueProcessor,
  backfillOrganizationQueue,
  backfillOrganizationQueueProcessor
} from '../src/queues/backfill';
import { mocks, resetMocks } from './_mocks';

let organization = { oid: 1n, id: 'org_1', status: 'active' };

let startedAt = '2026-11-18T03:00:00.000Z';

describe('agent-tracking/backfill', () => {
  beforeEach(() => {
    resetMocks();
    local.checkpoints.clear();
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
  });

  it('paces the per-organization tier and walks one cursor at a time', () => {
    expect((backfillOrganizationQueue as any).workerOpts).toEqual({
      concurrency: 5,
      limiter: { max: 10, duration: 1000 }
    });
    expect((backfillEntitiesQueue as any).workerOpts).toEqual({ concurrency: 1 });
  });

  it('starts with the consumer scan only, keyed by organization', async () => {
    await (backfillOrganizationQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(local.enqueueWatermarkScan).toHaveBeenCalledTimes(1);
    expect(local.enqueueWatermarkScan).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpoint: expect.objectContaining({
          queue: 'agent-tracking/backfill/consumer/org_1'
        }),
        queue: backfillEntitiesQueue,
        id: 'consumer_org_1',
        extra: { organizationId: 'org_1', type: 'consumer' }
      })
    );
  });

  it('does nothing while agent tracking is not configured', async () => {
    mocks.enabled.value = false;

    await (backfillOrganizationQueueProcessor as any).handler({ organizationId: 'org_1' });
    await (backfillEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'consumer',
      startedAt
    });

    expect(local.enqueueWatermarkScan).not.toHaveBeenCalled();
    expect(db.consumer.findMany).not.toHaveBeenCalled();
  });

  it('does nothing for an organization without the agent tracking flag', async () => {
    mocks.flagged.value = false;

    await (backfillOrganizationQueueProcessor as any).handler({ organizationId: 'org_1' });
    await (backfillEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'consumer',
      startedAt
    });

    expect(local.enqueueWatermarkScan).not.toHaveBeenCalled();
    expect(db.consumer.findMany).not.toHaveBeenCalled();
    expect(local.syncEntityAddManyWithOps).not.toHaveBeenCalled();
  });

  it('skips an organization that is gone or not active', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await (backfillOrganizationQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(local.enqueueWatermarkScan).not.toHaveBeenCalled();
  });

  it('queues the existing entity sync for a full page and pages on', async () => {
    let page = Array.from({ length: 500 }, (_, index) => ({ id: `con_${index}` }));
    vi.mocked(db.consumer.findMany).mockResolvedValue(page as any);

    await (backfillEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'consumer',
      startedAt,
      fullPass: true
    });

    expect(db.consumer.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true },
      where: { id: undefined, organizationOid: 1n }
    });
    expect(local.syncEntityAddManyWithOps).toHaveBeenCalledWith(
      expect.arrayContaining([
        { data: { type: 'consumer', id: 'con_0' }, opts: { id: 'con_0' } },
        { data: { type: 'consumer', id: 'con_499' }, opts: { id: 'con_499' } }
      ])
    );
    expect(backfillEntitiesQueue.add).toHaveBeenCalledWith(
      {
        organizationId: 'org_1',
        type: 'consumer',
        startedAt,
        fullPass: true,
        cursor: 'con_499'
      },
      { delay: 25_000 }
    );
    expect(pacedDelay).toHaveBeenCalledWith({ baseMs: 100_000, jitterMs: 10_000 });
    expect(local.checkpoints.has('agent-tracking/backfill/consumer/org_1')).toBe(false);
    expect(local.enqueueWatermarkScan).not.toHaveBeenCalled();
  });

  it('only reads what changed since the watermark and commits on the last page', async () => {
    let since = '2026-11-17T02:55:00.000Z';
    vi.mocked(db.consumerDevice.findMany).mockResolvedValue([{ id: 'codv_1' }] as any);

    await (backfillEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'device',
      startedAt,
      since,
      cursor: 'codv_0'
    });

    expect(db.consumerDevice.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true },
      where: {
        updatedAt: { gte: new Date(since) },
        id: { gt: 'codv_0' },
        status: 'active',
        instance: { organizationOid: 1n }
      }
    });
    expect(local.syncEntityAddManyWithOps).toHaveBeenCalledWith([
      { data: { type: 'device', id: 'codv_1' }, opts: { id: 'codv_1' } }
    ]);
    expect(backfillEntitiesQueue.add).not.toHaveBeenCalled();
    expect(
      local.checkpoints.get('agent-tracking/backfill/device/org_1')!.commit
    ).toHaveBeenCalledWith(new Date(startedAt));
    expect(local.enqueueWatermarkScan).not.toHaveBeenCalled();
  });

  it('starts the device scan once the consumer scan has committed', async () => {
    vi.mocked(db.consumer.findMany).mockResolvedValue([{ id: 'con_1' }] as any);

    await (backfillEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'consumer',
      startedAt
    });

    let commit = local.checkpoints.get('agent-tracking/backfill/consumer/org_1')!.commit;
    expect(commit).toHaveBeenCalledWith(new Date(startedAt));
    expect(local.enqueueWatermarkScan).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpoint: expect.objectContaining({ queue: 'agent-tracking/backfill/device/org_1' }),
        queue: backfillEntitiesQueue,
        id: 'device_org_1',
        extra: { organizationId: 'org_1', type: 'device' }
      })
    );
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(
      local.enqueueWatermarkScan.mock.invocationCallOrder[0]!
    );
  });

  it('commits an empty scan without queueing anything', async () => {
    vi.mocked(db.consumer.findMany).mockResolvedValue([]);

    await (backfillEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'consumer',
      startedAt
    });

    expect(local.syncEntityAddManyWithOps).not.toHaveBeenCalled();
    expect(
      local.checkpoints.get('agent-tracking/backfill/consumer/org_1')!.commit
    ).toHaveBeenCalledWith(new Date(startedAt));
  });
});
