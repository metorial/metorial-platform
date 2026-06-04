import { beforeEach, describe, expect, it, vi } from 'vitest';

let { reconcileProjectInstancesCronHandler } = vi.hoisted(() => ({
  reconcileProjectInstancesCronHandler: undefined as (() => Promise<void>) | undefined
}));

vi.mock('@metorial/db', () => ({
  db: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => {
    reconcileProjectInstancesCronHandler = handler;
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

vi.mock('../src/services/instance', () => ({
  instanceService: {
    reconcileProjectInstances: vi.fn()
  }
}));

vi.mock('../src/services/organizationActor', () => ({
  organizationActorService: {
    getSystemActor: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { instanceService } from '../src/services/instance';
import { organizationActorService } from '../src/services/organizationActor';
import {
  reconcileProjectInstancesCron,
  reconcileProjectInstancesQueueProcessor,
  reconcileProjectInstancesQueue,
  reconcileProjectInstancesSearchQueue,
  reconcileProjectInstancesSearchQueueProcessor
} from '../src/queues/reconcileProjectInstances';

describe('reconcileProjectInstances queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a daily cron that enqueues the search queue', async () => {
    expect(reconcileProjectInstancesCron).toBeDefined();

    await reconcileProjectInstancesCronHandler!();

    expect(reconcileProjectInstancesSearchQueue.add).toHaveBeenCalledWith(
      {},
      { id: 'org-project-instances-reconcile-search' }
    );
  });

  it('fans out active projects into single reconcile jobs', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: 'proj-1' },
      { id: 'proj-2' }
    ] as any);

    await (reconcileProjectInstancesSearchQueueProcessor as any).handler({});

    expect(db.project.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        id: undefined,
        instances: {
          some: {
            status: 'active',
            hasBeenReconciled: false
          }
        }
      },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true }
    });
    expect(reconcileProjectInstancesQueue.add).toHaveBeenCalledWith(
      { projectId: 'proj-1' },
      { id: 'proj-1' }
    );
    expect(reconcileProjectInstancesQueue.add).toHaveBeenCalledWith(
      { projectId: 'proj-2' },
      { id: 'proj-2' }
    );
    expect(reconcileProjectInstancesSearchQueue.add).toHaveBeenCalledWith({
      cursor: 'proj-2'
    });
  });

  it('delegates single project reconciliation to instanceService', async () => {
    let project = {
      id: 'proj-1',
      organization: { id: 'org-1' }
    };
    let systemActor = { id: 'actor-system' };

    vi.mocked(db.project.findUnique).mockResolvedValue(project as any);
    vi.mocked(organizationActorService.getSystemActor).mockResolvedValue(systemActor as any);

    await (reconcileProjectInstancesQueueProcessor as any).handler({
      projectId: 'proj-1'
    });

    expect(instanceService.reconcileProjectInstances).toHaveBeenCalledWith({
      project,
      performedBy: systemActor,
      context: { ip: '0.0.0.0', ua: 'Metorial' }
    });
  });
});
