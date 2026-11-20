import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  agentTracking: {
    ingestSource: { revoke: vi.fn() }
  },
  enabled: { value: true }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    workerOpts: config.workerOpts,
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  hourlyPacedDelay: vi.fn(() => ({ delay: 0 }))
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({ config, handler }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    agentTrackingIngestSource: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-agent-tracking-sync', () => ({
  getAgentTracking: () => (mocks.enabled.value ? mocks.agentTracking : null),
  isAgentTrackingEnabled: () => mocks.enabled.value,
  ignoreNotFound: (promise: Promise<unknown>) => promise
}));

import { db } from '@metorial/db';
import {
  revokeIngestSourceQueue,
  revokeIngestSourceQueueProcessor,
  revokeIngestSourcesCron,
  revokeIngestSourcesManyQueue,
  revokeIngestSourcesManyQueueProcessor
} from '../src/queues/revokeIngestSources';

let createRecord = (overrides: Record<string, any> = {}) => ({
  oid: 7n,
  id: 'atis_1',
  status: 'revoked',
  serviceIngestSourceId: 'atis_service_1',
  serviceRevokedAt: null,
  instance: { organization: { id: 'org_1' } },
  ...overrides
});

describe('agent-tracking/ingest-source/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
  });

  it('rate limits the per-key revoke and walks one cursor at a time', () => {
    expect((revokeIngestSourceQueue as any).workerOpts).toEqual({
      concurrency: 5,
      limiter: { max: 10, duration: 1000 }
    });
    expect((revokeIngestSourcesManyQueue as any).workerOpts).toEqual({ concurrency: 1 });
  });

  it('the cron starts one scan, and none while agent tracking is not configured', async () => {
    await (revokeIngestSourcesCron as any).handler();
    expect(revokeIngestSourcesManyQueue.add).toHaveBeenCalledWith({}, { id: 'scan' });

    vi.clearAllMocks();
    mocks.enabled.value = false;

    await (revokeIngestSourcesCron as any).handler();
    expect(revokeIngestSourcesManyQueue.add).not.toHaveBeenCalled();
  });

  it('picks up keys revoked here but not yet in the service, and pages on a full page', async () => {
    let page = Array.from({ length: 500 }, (_, index) => ({ id: `atis_${index}` }));
    vi.mocked(db.agentTrackingIngestSource.findMany).mockResolvedValue(page as any);

    await (revokeIngestSourcesManyQueueProcessor as any).handler({});

    expect(db.agentTrackingIngestSource.findMany).toHaveBeenCalledWith({
      where: { status: 'revoked', serviceRevokedAt: null, id: undefined },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true }
    });
    expect(revokeIngestSourceQueue.addManyWithOps).toHaveBeenCalledWith(
      expect.arrayContaining([{ data: { ingestSourceId: 'atis_0' }, opts: { id: 'atis_0' } }])
    );
    expect(revokeIngestSourcesManyQueue.add).toHaveBeenCalledWith(
      { cursor: 'atis_499' },
      { delay: 0 }
    );
  });

  it('stops on a partial page', async () => {
    vi.mocked(db.agentTrackingIngestSource.findMany).mockResolvedValue([
      { id: 'atis_1' }
    ] as any);

    await (revokeIngestSourcesManyQueueProcessor as any).handler({ cursor: 'atis_0' });

    expect(revokeIngestSourcesManyQueue.add).not.toHaveBeenCalled();
  });

  it('revokes in the service, then records that it did', async () => {
    vi.mocked(db.agentTrackingIngestSource.findUnique).mockResolvedValue(
      createRecord() as any
    );

    await (revokeIngestSourceQueueProcessor as any).handler({ ingestSourceId: 'atis_1' });

    expect(mocks.agentTracking.ingestSource.revoke).toHaveBeenCalledWith({
      organizationId: 'org_1',
      ingestSourceId: 'atis_service_1'
    });
    expect(db.agentTrackingIngestSource.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: { serviceRevokedAt: expect.any(Date) }
    });
    expect(mocks.agentTracking.ingestSource.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(db.agentTrackingIngestSource.update).mock.invocationCallOrder[0]!
    );
  });

  it('fails the job without recording when the service is down, so it is retried', async () => {
    vi.mocked(db.agentTrackingIngestSource.findUnique).mockResolvedValue(
      createRecord() as any
    );
    mocks.agentTracking.ingestSource.revoke.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(
      (revokeIngestSourceQueueProcessor as any).handler({ ingestSourceId: 'atis_1' })
    ).rejects.toThrow('ECONNREFUSED');
    expect(db.agentTrackingIngestSource.update).not.toHaveBeenCalled();
  });

  it('leaves active and already confirmed keys alone', async () => {
    vi.mocked(db.agentTrackingIngestSource.findUnique)
      .mockResolvedValueOnce(createRecord({ status: 'active' }) as any)
      .mockResolvedValueOnce(createRecord({ serviceRevokedAt: new Date() }) as any);

    await (revokeIngestSourceQueueProcessor as any).handler({ ingestSourceId: 'atis_1' });
    await (revokeIngestSourceQueueProcessor as any).handler({ ingestSourceId: 'atis_1' });

    expect(mocks.agentTracking.ingestSource.revoke).not.toHaveBeenCalled();
    expect(db.agentTrackingIngestSource.update).not.toHaveBeenCalled();
  });
});
