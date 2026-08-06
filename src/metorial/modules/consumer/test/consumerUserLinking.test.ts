import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  consumerFindMany: vi.fn(),
  consumerUpdateMany: vi.fn(),
  reconcileAdd: vi.fn(),
  syncUserConsumersAdd: vi.fn(),
  getNamespaceProperties: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    consumer: {
      findMany: mocks.consumerFindMany,
      updateMany: mocks.consumerUpdateMany
    },
    consumerProfile: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    instanceConsumer: { findMany: vi.fn() },
    instance: { findMany: vi.fn(), findFirst: vi.fn() }
  };

  return {
    db,
    ID: { generateId: vi.fn() },
    Prisma: {},
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn(), validate: vi.fn() }
}));

vi.mock('@metorial/consumer-auth', () => ({
  getEffectiveConsumerGroups: vi.fn(),
  normalizeStringList: vi.fn((list?: string[]) => list ?? [])
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn(async (_key, callback) => await callback())
  }))
}));

vi.mock('@metorial/module-organization', () => ({
  namespaceService: { getNamespacePropertiesByPortalOid: mocks.getNamespaceProperties }
}));

vi.mock('@metorial/module-search', () => ({ searchConsumerIds: vi.fn() }));

vi.mock('../src/queues/lifecycle/consumerInvite', () => ({
  consumerInviteUpdatedQueue: { add: vi.fn(), addMany: vi.fn() }
}));

vi.mock('../src/queues/lifecycle/consumerProfile', () => ({
  consumerProfileCreatedQueue: { add: vi.fn() },
  consumerProfileUpdatedQueue: { add: vi.fn() }
}));

vi.mock('../src/queues/reconcileUserConsumer', () => ({
  reconcileUserConsumersQueue: { add: mocks.reconcileAdd }
}));

vi.mock('../src/queues/syncUserConsumer', () => ({
  syncUserConsumersQueue: { add: mocks.syncUserConsumersAdd }
}));

vi.mock('../src/services/consumers/consumer', () => ({
  consumerService: { upsertConsumer: vi.fn() }
}));

vi.mock('../src/services/consumers/consumerSurface', () => ({
  consumerSurfaceInclude: {},
  consumerSurfaceService: { enrichConsumerSurfaces: vi.fn(async () => []) }
}));

import { consumerProfileService } from '../src/services/consumers/consumerProfile';

// The invite is created with whatever casing the inviter typed, while the user row that shows up
// later is lowercased by the identity provider.
let user = {
  oid: 42n,
  id: 'mus_0msh5kb1t5UnE15PgIJwId',
  email: 'vgbmzap@herber.space',
  globalProfileOid: null
} as any;

let invitedConsumer = {
  oid: 7n,
  id: 'cns_0msh5jzp8A3ja0EsfALrV3',
  organizationOid: 900n,
  userOid: null,
  email: 'VgBmzap@herber.space',
  profiles: [],
  organization: { oid: 900n }
};

describe('consumerProfileService.getConsumersForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNamespaceProperties.mockResolvedValue(new Map());
  });

  it('matches consumer emails case-insensitively', async () => {
    mocks.consumerFindMany.mockResolvedValue([]);

    await consumerProfileService.getConsumersForUser({ user });

    expect(mocks.consumerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              email: { equals: 'vgbmzap@herber.space', mode: 'insensitive' },
              userOid: null
            }
          ])
        })
      })
    );
  });

  it('claims a consumer invited under a different casing', async () => {
    mocks.consumerFindMany
      .mockResolvedValueOnce([invitedConsumer])
      .mockResolvedValueOnce([{ ...invitedConsumer, userOid: user.oid }]);

    let consumers = await consumerProfileService.getConsumersForUser({ user });

    expect(mocks.consumerUpdateMany).toHaveBeenCalledWith({
      where: { oid: { in: [invitedConsumer.oid] }, userOid: null },
      data: { userOid: user.oid }
    });
    expect(mocks.reconcileAdd).toHaveBeenCalledWith({ userId: user.id });
    expect(mocks.syncUserConsumersAdd).toHaveBeenCalledWith({ userId: user.id });
    expect(consumers.map(consumer => consumer.id)).toEqual([invitedConsumer.id]);
  });
});
