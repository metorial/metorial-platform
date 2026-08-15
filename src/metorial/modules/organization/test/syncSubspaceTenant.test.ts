import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { syncSubspaceTenantQueueProcessor } from '../src/queues/syncSubspaceTenant';

describe('syncSubspaceTenant queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
