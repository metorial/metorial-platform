import { beforeEach, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  add: vi.fn(),
  addManyWithOps: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({ add: mocks.add, process: (handler: unknown) => handler })
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: (_id: string, handler: () => unknown) => handler() })
}));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost' } } }));
vi.mock('../../id', () => ({ getId: () => ({ id: 'sync_1', oid: 1n }) }));
vi.mock('../../db', () => ({
  db: {
    registry: { findUnique: mocks.findUnique, update: mocks.update },
    registrySync: { create: mocks.create }
  }
}));
vi.mock('../../registry', () => ({
  getRegistryClient: async () => ({ 'change-notifications': { $get: mocks.get } }),
  getRegistryQuery: () => ({ supports_prebuilt: 'true' })
}));
vi.mock('./syncSlate', () => ({ syncSlateQueue: { addManyWithOps: mocks.addManyWithOps } }));

import { syncRegistryQueueProcessor } from './syncRegistry';

let run = syncRegistryQueueProcessor as unknown as (data: { registryId: string }) => Promise<void>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue({
    id: 'registry_1', oid: 1n, changeNotificationCursor: 'notification_old'
  });
});

it('retries HTTP failures without advancing the cursor', async () => {
  mocks.get.mockResolvedValue(new Response('Unavailable', { status: 503 }));
  await expect(run({ registryId: 'registry_1' })).rejects.toThrow(
    'status 503 - registry registry_1 - cursor notification_old - Unavailable'
  );
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.addManyWithOps).not.toHaveBeenCalled();
});

it('enqueues newer versions before advancing the cursor and schedules a fresh continuation', async () => {
  mocks.get.mockResolvedValue(Response.json({ items: [{
    id: 'notification_new', slate: { fullIdentifier: 'scope/provider' },
    slateVersion: { id: 'version_1', identifier: '1.0.0' }
  }] }));
  await run({ registryId: 'registry_1' });
  expect(mocks.get).toHaveBeenCalledWith({ query: {
    limit: '100', after: 'notification_old', order: 'asc', supports_prebuilt: 'true'
  } });
  expect(mocks.addManyWithOps).toHaveBeenCalledWith([{
    data: { id: 'scope/provider', version: 'version_1', registryId: 'registry_1' },
    opts: { id: 'notification_new' }
  }]);
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'registry_1' }, data: {
    changeNotificationCursor: 'notification_new', lastSyncedAt: expect.any(Date)
  } });
  expect(mocks.addManyWithOps.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.update.mock.invocationCallOrder[0]!
  );
  expect(mocks.add).toHaveBeenCalledWith({ registryId: 'registry_1' }, { delay: 1000 });
});
