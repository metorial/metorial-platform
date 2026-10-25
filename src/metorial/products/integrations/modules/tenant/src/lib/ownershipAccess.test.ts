import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  subspaceIdentityActor: { findUnique: vi.fn(), findMany: vi.fn() },
  coreIdentityActor: { findUnique: vi.fn() },
  consumerActor: { findMany: vi.fn() },
  resolveMetorialFacing: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: { identityActor: mocks.subspaceIdentityActor }
}));

vi.mock('./metorialDb', () => ({
  metorialDb: {
    identityActor: mocks.coreIdentityActor,
    consumerActor: mocks.consumerActor
  }
}));

vi.mock('./metorialFacing', () => ({
  resolveMetorialFacing: mocks.resolveMetorialFacing
}));

import {
  assertCanChangeCoreOwnerLock,
  assertCanChangeOwnerLock,
  canUseCoreOwnedResource,
  canUseOwnedResource,
  getOwnershipAccessor,
  internalOwnershipAccessor,
  redactClientSecretsForCaller,
  usableCoreOwnedResourceWhere,
  usableOwnedResourceWhere,
  type OwnershipAccessor
} from './ownershipAccess';

let consumerOwnerOid = 10n;
let personOwnerOid = 20n;
let ownConsumerOid = 30n;

let actorTypes = new Map<bigint, string>([
  [consumerOwnerOid, 'consumer'],
  [personOwnerOid, 'person'],
  [ownConsumerOid, 'consumer']
]);

let accessor = (d: Partial<OwnershipAccessor> = {}): OwnershipAccessor => ({
  kind: 'member',
  ownActorOids: [],
  ownActorIds: [],
  isRestrictedByProject: true,
  isEnforced: true,
  allowSystemOwned: false,
  ...d
});

let tenant = (d: { api?: boolean; member?: boolean } = {}) => ({
  oid: 1n,
  allowApiAccessToConsumerOwnedResources: d.api ?? false,
  allowMemberAccessToConsumerOwnedResources: d.member ?? false
});

beforeEach(() => {
  vi.clearAllMocks();

  mocks.subspaceIdentityActor.findUnique.mockImplementation(
    async ({ where }: { where: { oid: bigint } }) => {
      let type = actorTypes.get(where.oid);
      return type ? { type } : null;
    }
  );
  mocks.coreIdentityActor.findUnique.mockImplementation(
    async ({ where }: { where: { oid: bigint } }) => {
      let type = actorTypes.get(where.oid);
      return type ? { id: `actor_${where.oid}`, type } : null;
    }
  );
  mocks.consumerActor.findMany.mockResolvedValue([]);
  mocks.subspaceIdentityActor.findMany.mockResolvedValue([]);
});

describe('getOwnershipAccessor', () => {
  it('treats calls without an organization actor as internal', async () => {
    expect(await getOwnershipAccessor({ tenant: tenant() })).toBe(internalOwnershipAccessor);
  });

  it('splits the project toggle by caller type', async () => {
    let apiRestricted = await getOwnershipAccessor({
      tenant: tenant({ api: false, member: true }),
      organizationActor: { oid: 101n, type: 'machine_access' }
    });
    let memberAllowed = await getOwnershipAccessor({
      tenant: tenant({ api: false, member: true }),
      organizationActor: { oid: 102n, type: 'member' }
    });

    expect(apiRestricted).toMatchObject({ kind: 'api', isRestrictedByProject: true });
    expect(memberAllowed).toMatchObject({ kind: 'member', isRestrictedByProject: false });
  });

  it('never restricts consumer callers by project settings', async () => {
    let consumer = await getOwnershipAccessor({
      tenant: tenant(),
      organizationActor: { oid: 103n, type: 'consumer_profile' }
    });

    expect(consumer).toMatchObject({ kind: 'consumer', isRestrictedByProject: false });
  });

  it("resolves the caller's own consumer actors", async () => {
    mocks.consumerActor.findMany.mockResolvedValue([{ id: 'actor_30' }]);
    mocks.subspaceIdentityActor.findMany.mockResolvedValue([
      { oid: ownConsumerOid, id: 'actor_30' }
    ]);

    let result = await getOwnershipAccessor({
      tenant: tenant(),
      organizationActor: { oid: 104n, type: 'member' }
    });

    expect(result.ownActorOids).toEqual([ownConsumerOid]);
    expect(result.ownActorIds).toEqual(['actor_30']);
  });
});

describe('canUseOwnedResource', () => {
  it('allows internal callers everything', async () => {
    expect(
      await canUseOwnedResource(internalOwnershipAccessor, {
        ownerActorOid: consumerOwnerOid,
        isOwnerLocked: true
      })
    ).toBe(true);
  });

  it('allows ownerless resources', async () => {
    expect(await canUseOwnedResource(accessor(), { ownerActorOid: null })).toBe(true);
  });

  it('allows resources owned by non-consumer actors', async () => {
    expect(
      await canUseOwnedResource(accessor(), {
        ownerActorOid: personOwnerOid,
        isOwnerLocked: true
      })
    ).toBe(true);
  });

  it('blocks consumer-owned resources when the project restricts the caller', async () => {
    expect(await canUseOwnedResource(accessor(), { ownerActorOid: consumerOwnerOid })).toBe(
      false
    );
  });

  it('allows consumer-owned resources when the project allows the caller', async () => {
    expect(
      await canUseOwnedResource(accessor({ isRestrictedByProject: false }), {
        ownerActorOid: consumerOwnerOid
      })
    ).toBe(true);
  });

  it('blocks locked resources even when the project allows the caller', async () => {
    expect(
      await canUseOwnedResource(accessor({ isRestrictedByProject: false }), {
        ownerActorOid: consumerOwnerOid,
        isOwnerLocked: true
      })
    ).toBe(false);
  });

  it('always allows the owner, even when locked', async () => {
    expect(
      await canUseOwnedResource(accessor({ ownActorOids: [ownConsumerOid] }), {
        ownerActorOid: ownConsumerOid,
        isOwnerLocked: true
      })
    ).toBe(true);
  });

  it('falls back to the identity actor when no owner is set', async () => {
    expect(
      await canUseOwnedResource(accessor(), {
        ownerActorOid: null,
        identityActorOid: consumerOwnerOid
      })
    ).toBe(false);
  });
});

describe('canUseCoreOwnedResource', () => {
  it('matches the owner by portable actor id', async () => {
    expect(
      await canUseCoreOwnedResource(accessor({ ownActorIds: ['actor_30'] }), {
        ownerActorOid: ownConsumerOid,
        isOwnerLocked: true
      })
    ).toBe(true);
  });

  it('applies the same lock and project rules as subspace resources', async () => {
    expect(
      await canUseCoreOwnedResource(accessor(), { ownerActorOid: consumerOwnerOid })
    ).toBe(false);
    expect(
      await canUseCoreOwnedResource(accessor({ isRestrictedByProject: false }), {
        ownerActorOid: consumerOwnerOid
      })
    ).toBe(true);
    expect(
      await canUseCoreOwnedResource(accessor({ isRestrictedByProject: false }), {
        ownerActorOid: consumerOwnerOid,
        isOwnerLocked: true
      })
    ).toBe(false);
  });
});

describe('assertCanChangeOwnerLock', () => {
  let resource = { id: 'res_1', ownerActorOid: consumerOwnerOid, isOwnerLocked: true };

  it('ignores unchanged lock values', async () => {
    await expect(
      assertCanChangeOwnerLock(accessor(), resource, true)
    ).resolves.toBeUndefined();
    await expect(
      assertCanChangeOwnerLock(accessor(), resource, undefined)
    ).resolves.toBeUndefined();
  });

  it('only lets the owner unlock', async () => {
    await expect(
      assertCanChangeOwnerLock(accessor({ isRestrictedByProject: false }), resource, false)
    ).rejects.toThrow(/Only the owner/);

    await expect(
      assertCanChangeOwnerLock(accessor({ ownActorOids: [consumerOwnerOid] }), resource, false)
    ).resolves.toBeUndefined();
  });

  it('lets anyone who can use the resource lock it', async () => {
    let unlocked = { ...resource, isOwnerLocked: false };

    await expect(
      assertCanChangeOwnerLock(accessor({ isRestrictedByProject: false }), unlocked, true)
    ).resolves.toBeUndefined();
    await expect(assertCanChangeOwnerLock(accessor(), unlocked, true)).rejects.toThrow();
  });

  it('applies the same rules to core resources', async () => {
    await expect(
      assertCanChangeCoreOwnerLock(accessor({ isRestrictedByProject: false }), resource, false)
    ).rejects.toThrow(/Only the owner/);
    await expect(
      assertCanChangeCoreOwnerLock(accessor({ ownActorIds: ['actor_10'] }), resource, false)
    ).resolves.toBeUndefined();
  });
});

describe('usable list filters', () => {
  it('does not filter internal callers', () => {
    expect(usableOwnedResourceWhere(internalOwnershipAccessor)).toEqual({});
    expect(usableCoreOwnedResourceWhere(internalOwnershipAccessor)).toEqual({});
  });

  it('only returns non-consumer-owned or own resources when restricted', () => {
    let where = usableOwnedResourceWhere(accessor({ ownActorOids: [ownConsumerOid] }));

    expect(where).toEqual({
      OR: [
        { ownerActorOid: null },
        { ownerActor: { type: { not: 'consumer' } } },
        { ownerActorOid: { in: [ownConsumerOid] } }
      ]
    });
  });

  it('also returns unlocked resources when the project allows the caller', () => {
    let where = usableOwnedResourceWhere(accessor({ isRestrictedByProject: false })) as {
      OR: unknown[];
    };

    expect(where.OR[0]).toEqual({ isOwnerLocked: false });
  });

  it('checks the fallback actor for resources without an owner', () => {
    let where = usableOwnedResourceWhere(accessor(), {
      fallback: { field: 'identityActorOid', relation: 'identityActor' }
    });

    expect(where).toEqual({
      OR: [
        {
          ownerActorOid: null,
          OR: [{ identityActorOid: null }, { identityActor: { type: { not: 'consumer' } } }]
        },
        {
          ownerActorOid: { not: null },
          OR: [{ ownerActorOid: null }, { ownerActor: { type: { not: 'consumer' } } }]
        }
      ]
    });
  });

  it('matches core owners by actor id', () => {
    let where = usableCoreOwnedResourceWhere(accessor({ ownActorIds: ['actor_30'] }));

    expect(where).toEqual({
      OR: [
        { ownerActorOid: null },
        { ownerActor: { type: { not: 'consumer' } } },
        { ownerActor: { id: { in: ['actor_30'] } } }
      ]
    });
  });
});

describe('redactClientSecretsForCaller', () => {
  let resources = [
    { id: 'a', ownerActorOid: null, clientSecret: 'secret_a' },
    { id: 'b', ownerActorOid: consumerOwnerOid, clientSecret: 'secret_b' }
  ];

  beforeEach(() => {
    mocks.resolveMetorialFacing.mockResolvedValue({ tenant: tenant() });
  });

  it('keeps secrets for internal callers', async () => {
    let result = await redactClientSecretsForCaller({ instance: {} as any, resources });

    expect(result.map(resource => resource.clientSecret)).toEqual(['secret_a', 'secret_b']);
  });

  it('removes secrets of resources the caller cannot use', async () => {
    let result = await redactClientSecretsForCaller({
      instance: {} as any,
      organizationActor: { oid: 201n, type: 'member' } as any,
      resources
    });

    expect(result.map(resource => resource.clientSecret)).toEqual(['secret_a', '']);
  });
});
