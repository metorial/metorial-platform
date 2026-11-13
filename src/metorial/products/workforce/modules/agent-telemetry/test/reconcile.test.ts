import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  groundstation: {
    entity: { list: vi.fn(), archive: vi.fn() }
  },
  enabled: { value: true }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  dailyPacedDelay: vi.fn(() => ({ delay: 0 }))
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({ config, handler }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    organization: { findMany: vi.fn(), findUnique: vi.fn() },
    project: { findMany: vi.fn() },
    instance: { findMany: vi.fn() },
    consumer: { findMany: vi.fn() },
    consumerDevice: { findMany: vi.fn() }
  }
}));

vi.mock('../src/internal/groundstation', () => ({
  getGroundstation: () => (mocks.enabled.value ? mocks.groundstation : null),
  isAgentTelemetryEnabled: () => mocks.enabled.value,
  ignoreNotFound: (promise: Promise<unknown>) => promise
}));

vi.mock('../src/queues/syncScope', () => ({
  syncScopeQueue: { add: vi.fn(), addMany: vi.fn() }
}));

import { db } from '@metorial/db';
import {
  reconcileCron,
  reconcileEntitiesQueue,
  reconcileEntitiesQueueProcessor,
  reconcileManyQueue,
  reconcileManyQueueProcessor,
  reconcileSingleQueue,
  reconcileSingleQueueProcessor
} from '../src/queues/reconcile';
import { syncScopeQueue } from '../src/queues/syncScope';

let organization = { oid: 1n, id: 'org_1', status: 'active' };

describe('agent-telemetry/reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
  });

  it('the cron does nothing while Groundstation is not configured', async () => {
    mocks.enabled.value = false;

    await (reconcileCron as any).handler();

    expect(reconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('fans out one job per organization and pages on a full page', async () => {
    let page = Array.from({ length: 500 }, (_, index) => ({ id: `org_${index}` }));
    vi.mocked(db.organization.findMany).mockResolvedValue(page as any);

    await (reconcileManyQueueProcessor as any).handler({});

    expect(reconcileSingleQueue.addManyWithOps).toHaveBeenCalledWith(
      expect.arrayContaining([{ data: { organizationId: 'org_0' }, opts: { id: 'org_0' } }])
    );
    expect(reconcileManyQueue.add).toHaveBeenCalledWith({ cursor: 'org_499' }, { delay: 0 });
  });

  it('only re-syncs the scope of a deleted organization', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
    expect(reconcileEntitiesQueue.addMany).not.toHaveBeenCalled();
  });

  it('archives synced users whose consumer no longer exists', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.groundstation.entity.list.mockResolvedValue({
      items: [
        { id: 'gen_1', source: 'metorial.consumer', ref: 'con_live' },
        { id: 'gen_2', source: 'metorial.consumer', ref: 'con_gone' },
        { id: 'gen_3', source: 'vendor.cursor', ref: 'cursor_user' },
        { id: 'gen_4', source: 'customer', ref: null }
      ],
      pagination: { has_more_after: false }
    });
    vi.mocked(db.consumer.findMany).mockResolvedValue([{ id: 'con_live' }] as any);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'user'
    });

    expect(mocks.groundstation.entity.list).toHaveBeenCalledWith({
      organizationId: 'org_1',
      kinds: ['user'],
      statuses: ['managed', 'discovered'],
      limit: 100,
      after: undefined
    });

    expect(db.consumer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['con_live', 'con_gone'] }, organizationOid: 1n },
      select: { id: true }
    });
    expect(mocks.groundstation.entity.archive).toHaveBeenCalledTimes(1);
    expect(mocks.groundstation.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_2'
    });
    expect(reconcileEntitiesQueue.add).not.toHaveBeenCalled();
  });

  it('treats ended devices as gone and continues on the next page', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.groundstation.entity.list.mockResolvedValue({
      items: [{ id: 'gen_9', source: 'metorial.device', ref: 'codv_ended' }],
      pagination: { has_more_after: true }
    });
    vi.mocked(db.consumerDevice.findMany).mockResolvedValue([]);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'device'
    });

    expect(db.consumerDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' })
      })
    );
    expect(mocks.groundstation.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_9'
    });
    expect(reconcileEntitiesQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1', kind: 'device', after: 'gen_9' },
      { delay: 0 }
    );
  });
});
