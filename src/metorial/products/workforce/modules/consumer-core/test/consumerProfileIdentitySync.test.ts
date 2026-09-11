import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  consumerUpdate: vi.fn(),
  instanceConsumerUpdate: vi.fn(),
  instanceConsumerFindUniqueOrThrow: vi.fn(),
  consumerProfileFindMany: vi.fn(),
  consumerProfileUpdate: vi.fn(),
  consumerProfileUpdateMany: vi.fn(),
  consumerUpdatedAdd: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    consumer: { update: mocks.consumerUpdate },
    instanceConsumer: {
      update: mocks.instanceConsumerUpdate,
      findUniqueOrThrow: mocks.instanceConsumerFindUniqueOrThrow
    },
    consumerProfile: {
      findMany: mocks.consumerProfileFindMany,
      update: mocks.consumerProfileUpdate,
      updateMany: mocks.consumerProfileUpdateMany
    }
  };

  return {
    db,
    ID: { generateId: vi.fn() },
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({ usingLock: vi.fn() }))
}));

vi.mock('@metorial/module-search', () => ({ searchConsumerIds: vi.fn() }));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn(), listen: vi.fn() } }));

vi.mock('../src/queues/lifecycle/consumer', () => ({
  consumerCreatedQueue: { add: vi.fn() },
  consumerUpdatedQueue: { add: mocks.consumerUpdatedAdd }
}));

import { consumerService } from '../src/services/consumer';

describe('consumer profile identity sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates at most one profile email per surface', async () => {
    mocks.consumerProfileFindMany
      .mockResolvedValueOnce([
        { oid: 1n, surfaceOid: 10n },
        { oid: 2n, surfaceOid: 10n },
        { oid: 3n, surfaceOid: 20n }
      ])
      .mockResolvedValueOnce([{ surfaceOid: 10n }]);
    mocks.instanceConsumerFindUniqueOrThrow.mockResolvedValue({
      id: 'instance_consumer_1',
      oid: 100n,
      name: 'Old Name',
      email: 'old@example.com',
      consumer: { id: 'cns_1', organizationMember: null, user: null }
    });
    mocks.instanceConsumerUpdate.mockResolvedValue({
      id: 'instance_consumer_1',
      oid: 100n,
      instanceOid: 200n,
      consumerOid: 300n,
      name: 'Updated Name',
      email: 'updated@example.com'
    });

    await consumerService.updateConsumer({
      consumer: {
        id: 'instance_consumer_1',
        oid: 100n,
        instanceOid: 200n,
        consumerOid: 300n,
        organizationMemberOid: null,
        name: 'Old Name',
        email: 'old@example.com'
      } as any,
      auditScope: {
        organizationOid: 900n,
        actor: { type: 'system', id: 'test' },
        context: { ip: '' }
      } as any,
      input: {
        name: 'Updated Name',
        email: 'updated@example.com'
      }
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
    expect(mocks.consumerUpdatedAdd).toHaveBeenCalledWith({
      instanceConsumerId: 'instance_consumer_1'
    });
  });
});
