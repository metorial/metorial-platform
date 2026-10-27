import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  instanceConsumerFindUnique: vi.fn(),
  consumerProfileFindMany: vi.fn(),
  consumerProfileFindUnique: vi.fn(),
  archiveProfileActors: vi.fn(),
  syncInstanceActors: vi.fn(),
  consumerProfileUpdate: vi.fn(),
  consumerProfileUpdateMany: vi.fn(),
  reconcileActorAddMany: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    instanceConsumer: { findUnique: mocks.instanceConsumerFindUnique },
    consumerProfile: {
      findMany: mocks.consumerProfileFindMany,
      findUnique: mocks.consumerProfileFindUnique,
      update: mocks.consumerProfileUpdate,
      updateMany: mocks.consumerProfileUpdateMany
    }
  };

  return {
    db,
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: config.name === 'cons/ident/recon-actor' ? mocks.reconcileActorAddMany : vi.fn(),
    process: vi.fn(handler => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@metorial/module-consumer-entities', () => ({
  consumerActorService: { reconcileConsumerProfileActors: vi.fn() },
  archiveDeletedConsumerProfileActorsQueue: { add: mocks.archiveProfileActors },
  syncInstanceConsumerActorsQueue: { add: mocks.syncInstanceActors }
}));

import {
  reconcileConsumerActorQueueProcessor,
  syncIdentityConsumerQueueProcessor
} from '../src/queues/syncIdentityConsumer';

describe('sync identity consumer queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cleans up deleted profiles without overwriting their anonymized names', async () => {
    mocks.consumerProfileFindUnique.mockResolvedValue({
      id: 'cop_deleted',
      status: 'deleted',
      instanceOid: 100n,
      consumerOid: 200n
    });
    mocks.instanceConsumerFindUnique.mockResolvedValue({ id: 'inc_1', name: 'Original Name' });
    await (reconcileConsumerActorQueueProcessor as any)({ profileId: 'cop_deleted' });
    expect(mocks.archiveProfileActors).toHaveBeenCalledWith({
      consumerProfileId: 'cop_deleted'
    });
    expect(mocks.syncInstanceActors).toHaveBeenCalledWith({ instanceConsumerId: 'inc_1' });
    expect(mocks.consumerProfileUpdate).not.toHaveBeenCalled();
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
