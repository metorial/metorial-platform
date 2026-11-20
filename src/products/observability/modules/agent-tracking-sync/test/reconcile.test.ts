import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', async () => (await import('./_mocks')).queueModule);

vi.mock('@metorial/cron', async () => (await import('./_mocks')).cronModule);

vi.mock('@metorial/db', () => ({
  db: {
    organization: { findMany: vi.fn(), findUnique: vi.fn() },
    project: { findMany: vi.fn() },
    instance: { findMany: vi.fn(), findFirst: vi.fn() },
    consumer: { findMany: vi.fn() },
    consumerDevice: { findMany: vi.fn() }
  }
}));

vi.mock('../src/lib/client', async () => (await import('./_mocks')).clientModule);

vi.mock('../src/lib/flag', async () => (await import('./_mocks')).flagModule);

vi.mock('../src/queues/syncScope', () => ({
  syncScopeQueue: { add: vi.fn(), addMany: vi.fn() }
}));

vi.mock('../src/queues/backfill', () => ({
  backfillOrganizationQueue: { add: vi.fn() }
}));

import { db } from '@metorial/db';
import {
  reconcileCron,
  reconcileEntitiesQueue,
  reconcileEntitiesQueueProcessor,
  reconcileManyQueue,
  reconcileManyQueueProcessor,
  reconcileScopesQueue,
  reconcileSingleQueue,
  reconcileSingleQueueProcessor
} from '../src/queues/reconcile';
import { backfillOrganizationQueue } from '../src/queues/backfill';
import { mocks, resetMocks } from './_mocks';
import { syncScopeQueue } from '../src/queues/syncScope';

mocks.agentTracking = { entity: { list: vi.fn(), archive: vi.fn() } };

let organization = { oid: 1n, id: 'org_1', status: 'active' };

describe('agent-tracking/reconcile', () => {
  beforeEach(() => resetMocks());

  it('the cron does nothing while agent tracking is not configured', async () => {
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

  it('skips an organization without the agent tracking flag', async () => {
    mocks.flagged.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    vi.mocked(db.instance.findFirst).mockResolvedValue({ oid: 3n } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).not.toHaveBeenCalled();
    expect(reconcileScopesQueue.addMany).not.toHaveBeenCalled();
    expect(reconcileEntitiesQueue.addMany).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();
  });

  it('does nothing when a flag change finds the flag still off', async () => {
    mocks.flagged.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await (reconcileSingleQueueProcessor as any).handler({
      organizationId: 'org_1',
      backfillRoster: true
    });

    expect(reconcileSingleQueue.add).not.toHaveBeenCalled();
    expect(syncScopeQueue.add).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();
  });

  it('backfills the roster after a flag change even without credentials', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await (reconcileSingleQueueProcessor as any).handler({
      organizationId: 'org_1',
      backfillRoster: true
    });

    expect(db.instance.findFirst).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1' },
      { id: 'org_1' }
    );
  });

  it('archives nothing for an organization without the agent tracking flag', async () => {
    mocks.flagged.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'user'
    });

    expect(mocks.agentTracking.entity.list).not.toHaveBeenCalled();
    expect(mocks.agentTracking.entity.archive).not.toHaveBeenCalled();
  });

  it('only re-syncs the scope of a deleted organization', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
    expect(reconcileEntitiesQueue.addMany).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();
  });

  it('backfills the roster of an organization that holds an active credential', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    vi.mocked(db.instance.findFirst).mockResolvedValue({ oid: 3n } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(db.instance.findFirst).toHaveBeenCalledWith({
      where: {
        organizationOid: 1n,
        OR: [
          { agentTrackingIngestSources: { some: { status: 'active' } } },
          { agentTrackingIngestTokens: { some: { status: 'active' } } }
        ]
      },
      select: { oid: true }
    });
    expect(backfillOrganizationQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1' },
      { id: 'org_1' }
    );
  });

  it('leaves the roster of an organization without credentials to the listeners', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    vi.mocked(db.instance.findFirst).mockResolvedValue(null);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(reconcileEntitiesQueue.addMany).toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();
  });

  it('archives synced users whose consumer no longer exists', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.agentTracking.entity.list.mockResolvedValue({
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

    expect(mocks.agentTracking.entity.list).toHaveBeenCalledWith({
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
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledTimes(1);
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_2'
    });
    expect(reconcileEntitiesQueue.add).not.toHaveBeenCalled();
  });

  it('treats ended devices as gone and continues on the next page', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.agentTracking.entity.list.mockResolvedValue({
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
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_9'
    });
    expect(reconcileEntitiesQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1', kind: 'device', after: 'gen_9' },
      { delay: 0 }
    );
  });
});
