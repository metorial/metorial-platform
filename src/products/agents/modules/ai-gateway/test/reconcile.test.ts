import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ enabled: { value: true } }));

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
    instance: { findMany: vi.fn() }
  }
}));

vi.mock('../src/lib/client', () => ({
  isAiGatewayEnabled: () => mocks.enabled.value
}));

vi.mock('../src/queues/syncScope', () => ({
  syncScopeQueue: { add: vi.fn(), addMany: vi.fn() }
}));

import { db } from '@metorial/db';
import {
  reconcileCron,
  reconcileManyQueue,
  reconcileManyQueueProcessor,
  reconcileScopesQueue,
  reconcileScopesQueueProcessor,
  reconcileSingleQueue,
  reconcileSingleQueueProcessor
} from '../src/queues/reconcile';
import { syncScopeQueue } from '../src/queues/syncScope';

describe('ai-gateway/reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
  });

  it('the cron does nothing while the gateway is not configured', async () => {
    mocks.enabled.value = false;

    await (reconcileCron as any).handler();

    expect(reconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('the cron starts a reconcile pass', async () => {
    await (reconcileCron as any).handler();

    expect(reconcileManyQueue.add).toHaveBeenCalledWith({});
  });

  it('fans out one job per organization and pages on a full page', async () => {
    let page = Array.from({ length: 500 }, (_, index) => ({ id: `org_${index}` }));
    vi.mocked(db.organization.findMany).mockResolvedValue(page as any);

    await (reconcileManyQueueProcessor as any).handler({});

    expect(reconcileSingleQueue.addManyWithOps).toHaveBeenCalledWith(
      page.map(organization => ({
        data: { organizationId: organization.id },
        opts: { id: organization.id }
      }))
    );
    expect(reconcileManyQueue.add).toHaveBeenCalledWith({ cursor: 'org_499' }, { delay: 0 });
  });

  it('stops paging on a partial page', async () => {
    vi.mocked(db.organization.findMany).mockResolvedValue([{ id: 'org_1' }] as any);

    await (reconcileManyQueueProcessor as any).handler({});

    expect(reconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('syncs an active organization and its projects and instances', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      id: 'org_1',
      status: 'active'
    } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
    expect(reconcileScopesQueue.addMany).toHaveBeenCalledWith([
      { organizationId: 'org_1', type: 'project' },
      { organizationId: 'org_1', type: 'instance' }
    ]);
  });

  it('only archives an inactive organization', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      id: 'org_1',
      status: 'deleted'
    } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
    expect(reconcileScopesQueue.addMany).not.toHaveBeenCalled();
  });

  it('syncs every project of an organization', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: 'proj_1' },
      { id: 'proj_2' }
    ] as any);

    await (reconcileScopesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'project'
    });

    expect(syncScopeQueue.addMany).toHaveBeenCalledWith([
      { type: 'project', id: 'proj_1' },
      { type: 'project', id: 'proj_2' }
    ]);
    expect(reconcileScopesQueue.add).not.toHaveBeenCalled();
  });

  it('pages through instances', async () => {
    let page = Array.from({ length: 500 }, (_, index) => ({ id: `inst_${index}` }));
    vi.mocked(db.instance.findMany).mockResolvedValue(page as any);

    await (reconcileScopesQueueProcessor as any).handler({
      organizationId: 'org_1',
      type: 'instance'
    });

    expect(reconcileScopesQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1', type: 'instance', cursor: 'inst_499' },
      { delay: 0 }
    );
  });
});
