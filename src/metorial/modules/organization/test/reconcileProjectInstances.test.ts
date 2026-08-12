import { beforeEach, describe, expect, it, vi } from 'vitest';

let reconcileProjectInstancesCronHandler: (() => Promise<void>) | undefined;

process.env.REDIS_URL = 'redis://localhost:6379';

vi.mock('@metorial/db', () => ({
  db: {
    instance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => {
    reconcileProjectInstancesCronHandler = handler;
    return { handler };
  })
}));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({
    service: {
      REDIS_URL: 'redis://localhost:6379'
    }
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

vi.mock('../src/services', () => ({
  instanceService: {
    generateInstanceSlug: vi.fn()
  }
}));

const { db } = await import('@metorial/db');
const { instanceService } = await import('../src/services');

let reconcileProjectInstancesModule:
  | typeof import('../src/queues/reconcileProjectInstances')
  | undefined;

let getModule = async () => {
  reconcileProjectInstancesModule ??= await import('../src/queues/reconcileProjectInstances');
  return reconcileProjectInstancesModule;
};

describe('reconcileProjectInstances queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a daily cron that enqueues the search queue', async () => {
    let { reconcileProjectInstancesCron, reconcileProjectInstancesSearchQueue } =
      await getModule();

    expect(reconcileProjectInstancesCron).toBeDefined();

    await reconcileProjectInstancesCronHandler!();

    expect(reconcileProjectInstancesSearchQueue.add).toHaveBeenCalledWith(
      {},
      { id: 'org-instances-reconcile-search' }
    );
  });

  it('fans out active instances into single reconcile jobs', async () => {
    let {
      reconcileProjectInstancesQueue,
      reconcileProjectInstancesSearchQueue,
      reconcileProjectInstancesSearchQueueProcessor
    } = await getModule();

    (db.instance.findMany as any).mockResolvedValue([
      { id: 'instance-1' },
      { id: 'instance-2' }
    ] as any);

    await (reconcileProjectInstancesSearchQueueProcessor as any).handler({});

    expect(db.instance.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        id: undefined,
        hasBeenReconciled2: false
      },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true }
    });
    expect(reconcileProjectInstancesQueue.addMany).toHaveBeenCalledWith([
      { instanceId: 'instance-1' },
      { instanceId: 'instance-2' }
    ]);
    expect(reconcileProjectInstancesSearchQueue.add).toHaveBeenCalledWith({
      cursor: 'instance-2'
    });
  });

  it('reconciles a single instance by generating a slug and updating it', async () => {
    let { reconcileProjectInstancesQueueProcessor } = await getModule();

    let instance = {
      id: 'instance-1',
      slug: 'old-slug',
      oldSlug: null,
      project: { id: 'project-1', name: 'Project One' }
    };

    (db.instance.findUnique as any).mockResolvedValue(instance as any);
    (instanceService.generateInstanceSlug as any).mockResolvedValue('new-slug' as any);

    await (reconcileProjectInstancesQueueProcessor as any).handler({
      instanceId: 'instance-1'
    });

    expect(db.instance.findUnique).toHaveBeenCalledWith({
      where: { id: 'instance-1' },
      include: { project: true }
    });
    expect(instanceService.generateInstanceSlug).toHaveBeenCalledWith({
      project: instance.project,
      input: instance
    });
    expect(db.instance.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'instance-1',
        oldSlug: null,
        hasBeenReconciled2: false
      },
      data: {
        hasBeenReconciled2: true,
        slug: 'new-slug',
        oldSlug: 'old-slug',
        previousSlugs: {
          push: 'old-slug'
        }
      }
    });
  });
});
