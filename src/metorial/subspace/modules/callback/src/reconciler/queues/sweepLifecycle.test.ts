import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  processors: new Map<string, (data: any) => Promise<void>>(),
  callbackFindMany: vi.fn(),
  callbackFanoutAddMany: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn((options: { name: string }) => ({
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn((processor: (data: any) => Promise<void>) => {
      mocks.processors.set(options.name, processor);
      return processor;
    })
  }))
}));
vi.mock('@lowerdeck/cron', () => ({ createCron: vi.fn(() => vi.fn()) }));
vi.mock('@metorial-subspace/db', () => ({
  db: {
    callback: {
      findMany: mocks.callbackFindMany,
      update: vi.fn()
    },
    callbackInstance: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../lib/sync', () => ({ syncCallback: vi.fn() }));
vi.mock('./definitions', () => ({
  callbackReconcileInstanceQueue: { addManyWithOps: vi.fn() }
}));
vi.mock('../../queues/integrationReconcile', () => ({
  callbackFanoutQueue: { addMany: mocks.callbackFanoutAddMany }
}));

import './sweepLifecycle';

describe('callback lifecycle projection repair sweep', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-enqueues active callbacks safely when a lifecycle event was missed', async () => {
    mocks.callbackFindMany.mockResolvedValue([{ id: 'callback_1' }]);
    let processor = mocks.processors.get('sub/callback/lifecycle/sweepMissingProjections')!;

    await processor({});
    await processor({});

    expect(mocks.callbackFanoutAddMany).toHaveBeenNthCalledWith(1, [
      { callbackId: 'callback_1' }
    ]);
    expect(mocks.callbackFanoutAddMany).toHaveBeenNthCalledWith(2, [
      { callbackId: 'callback_1' }
    ]);
  });
});
