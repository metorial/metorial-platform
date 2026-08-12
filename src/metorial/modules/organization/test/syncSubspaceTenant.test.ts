import { beforeEach, describe, expect, it, vi } from 'vitest';

let { syncSubspaceTenantCronHandler } = vi.hoisted(() => ({
  syncSubspaceTenantCronHandler: undefined as (() => Promise<void>) | undefined
}));

vi.mock('@metorial/db', () => ({
  db: {
    instance: {
      findMany: vi.fn()
    },
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => {
    syncSubspaceTenantCronHandler = handler;
    return { handler };
  })
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn().mockImplementation(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'QueueRetryError';
    }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: {
    ensureForProject: vi.fn(),
    ensureForInstance: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { subspaceScopeService } from '@metorial-subspace/module-tenant';
import {
  syncSubspaceTenantCron,
  syncSubspaceTenantQueue,
  syncSubspaceTenantQueueProcessor,
  syncSubspaceTenantSearchQueue,
  syncSubspaceTenantSearchQueueProcessor
} from '../src/queues/syncSubspaceTenant';

describe('syncSubspaceTenant queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a daily cron that enqueues the search queue', async () => {
    expect(syncSubspaceTenantCron).toBeDefined();

    await syncSubspaceTenantCronHandler!();

    expect(syncSubspaceTenantSearchQueue.add).toHaveBeenCalledWith(
      {},
      { id: 'org-sync-subspace-tenant-search' }
    );
  });

  it('fans out active projects into single sync jobs', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: 'proj-1' },
      { id: 'proj-2' }
    ] as any);

    await (syncSubspaceTenantSearchQueueProcessor as any).handler({});

    expect(db.project.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        id: undefined
      },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true }
    });
    expect(syncSubspaceTenantQueue.addMany).toHaveBeenCalledWith([
      { projectId: 'proj-1' },
      { projectId: 'proj-2' }
    ]);
    expect(syncSubspaceTenantSearchQueue.add).toHaveBeenCalledWith({
      cursor: 'proj-2'
    });
  });

  it('ensures the project tenant and each instance scope directly', async () => {
    let project = { id: 'proj-1', oid: 1 };
    let instances = [{ id: 'inst-1' }, { id: 'inst-2' }];
    vi.mocked(db.project.findUnique).mockResolvedValue(project as any);
    vi.mocked(db.instance.findMany).mockResolvedValue(instances as any);

    await (syncSubspaceTenantQueueProcessor as any).handler({ projectId: project.id });

    expect(subspaceScopeService.ensureForProject).toHaveBeenCalledWith(project);
    expect(subspaceScopeService.ensureForInstance).toHaveBeenNthCalledWith(1, instances[0]);
    expect(subspaceScopeService.ensureForInstance).toHaveBeenNthCalledWith(2, instances[1]);
  });
});
