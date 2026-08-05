import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  instanceConsumerFindUnique: vi.fn(),
  consumerProfileFindMany: vi.fn(),
  consumerProfileUpdate: vi.fn(),
  consumerProfileUpdateMany: vi.fn(),
  reconcileActorAddMany: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    instanceConsumer: { findUnique: mocks.instanceConsumerFindUnique },
    consumerProfile: {
      findMany: mocks.consumerProfileFindMany,
      findUnique: vi.fn(),
      update: mocks.consumerProfileUpdate,
      updateMany: mocks.consumerProfileUpdateMany
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: config.name === 'cons/ident/recon-actor' ? mocks.reconcileActorAddMany : vi.fn(),
    process: vi.fn(handler => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../src/services/consumerEntities/consumerActor', () => ({
  consumerActorService: { reconcileConsumerProfileActors: vi.fn() }
}));

import { syncIdentityConsumerQueueProcessor } from '../src/queues/syncIdentityConsumer';

describe('sync identity consumer queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not assign the same email to multiple profiles on one surface', async () => {
    mocks.instanceConsumerFindUnique.mockResolvedValue({
      id: 'instance_consumer_1',
      instanceOid: 100n,
      consumerOid: 200n,
      name: 'Updated Name',
      email: 'updated@example.com'
    });
    mocks.consumerProfileFindMany
      .mockResolvedValueOnce([
        { oid: 1n, surfaceOid: 10n },
        { oid: 2n, surfaceOid: 10n },
        { oid: 3n, surfaceOid: 20n }
      ])
      .mockResolvedValueOnce([{ surfaceOid: 10n }])
      .mockResolvedValueOnce([{ id: 'profile_1' }, { id: 'profile_2' }]);

    await (syncIdentityConsumerQueueProcessor as any)({
      identityConsumerId: 'instance_consumer_1'
    });

    expect(mocks.consumerProfileUpdateMany).toHaveBeenCalledWith({
      where: { oid: { in: [1n, 2n, 3n] } },
      data: { name: 'Updated Name' }
    });
    expect(mocks.consumerProfileUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.consumerProfileUpdate).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: { email: 'updated@example.com' }
    });
    expect(mocks.reconcileActorAddMany).toHaveBeenCalledWith([
      { profileId: 'profile_1' },
      { profileId: 'profile_2' }
    ]);
  });
});
