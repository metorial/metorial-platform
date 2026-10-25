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
  assertCanAttachOwnedResources,
  assertCanChangeOwnerOnlyVisibility,
  assertCanSeeOwnedResource,
  canSeeOwnedResource,
  canUseOwnedResource,
  canUseCoreOwnedResource,
  internalOwnershipAccessor,
  isOwnershipEnforced,
  ownedCoreResourceWhere,
  ownedResourceWhere,
  systemOwnershipAccessor,
  type OwnershipAccessor
} from './ownershipAccess';

let consumerOwnerOid = 10n;
let ownConsumerOid = 30n;

let accessor = (d: Partial<OwnershipAccessor> = {}): OwnershipAccessor => ({
  kind: 'member',
  ownActorOids: [ownConsumerOid],
  ownActorIds: ['own'],
  isRestrictedByProject: false,
  isEnforced: true,
  allowSystemOwned: false,
  ...d
});

beforeEach(() => {
  vi.clearAllMocks();

  mocks.subspaceIdentityActor.findUnique.mockResolvedValue({ type: 'consumer' });
  mocks.coreIdentityActor.findUnique.mockResolvedValue({ id: 'other', type: 'consumer' });
});

describe('isOwnershipEnforced', () => {
  it('is off only when both flags allow access', () => {
    expect(
      isOwnershipEnforced({
        allowApiAccessToConsumerOwnedResources: true,
        allowMemberAccessToConsumerOwnedResources: true
      })
    ).toBe(false);
    expect(
      isOwnershipEnforced({
        allowApiAccessToConsumerOwnedResources: false,
        allowMemberAccessToConsumerOwnedResources: true
      })
    ).toBe(true);
    expect(
      isOwnershipEnforced({
        allowApiAccessToConsumerOwnedResources: true,
        allowMemberAccessToConsumerOwnedResources: false
      })
    ).toBe(true);
  });
});

describe('system-owned resources', () => {
  let systemOwned = { isSystemOwned: true, ownerActorOid: null };

  it('are never usable or visible, whatever the accessor', async () => {
    expect(await canUseOwnedResource(internalOwnershipAccessor, systemOwned)).toBe(false);
    expect(await canUseOwnedResource(accessor({ isEnforced: false }), systemOwned)).toBe(
      false
    );
    expect(canSeeOwnedResource(internalOwnershipAccessor, systemOwned)).toBe(false);
    expect(canSeeOwnedResource(accessor({ isEnforced: false }), systemOwned)).toBe(false);
  });

  it('are reachable only with the system accessor', async () => {
    expect(await canUseOwnedResource(systemOwnershipAccessor, systemOwned)).toBe(true);
    expect(canSeeOwnedResource(systemOwnershipAccessor, systemOwned)).toBe(true);
  });

  it('are filtered from lists unless explicitly included', () => {
    expect(ownedResourceWhere(internalOwnershipAccessor)).toEqual({
      AND: [{ isSystemOwned: false }]
    });
    expect(
      ownedResourceWhere(internalOwnershipAccessor, { includeSystemOwned: true })
    ).toEqual({
      AND: []
    });
    expect(ownedCoreResourceWhere(internalOwnershipAccessor)).toEqual({
      AND: [{ isSystemOwned: false }]
    });
  });
});

describe('owner-only visibility', () => {
  let hidden = { ownerActorOid: consumerOwnerOid, isOwnerOnlyVisible: true };

  it('hides the resource from non-owners when enforced', async () => {
    expect(canSeeOwnedResource(accessor(), hidden)).toBe(false);
    expect(await canUseOwnedResource(accessor(), hidden)).toBe(false);
    expect(() =>
      assertCanSeeOwnedResource(accessor(), hidden, { resource: 'provider.config', id: 'cfg' })
    ).toThrow();
  });

  it('keeps the resource visible to its owner', async () => {
    let owned = { ...hidden, ownerActorOid: ownConsumerOid };

    expect(canSeeOwnedResource(accessor(), owned)).toBe(true);
    expect(await canUseOwnedResource(accessor(), owned)).toBe(true);
  });

  it('has no effect when ownership is not enforced', async () => {
    let legacy = accessor({ isEnforced: false });

    expect(canSeeOwnedResource(legacy, hidden)).toBe(true);
    expect(await canUseOwnedResource(legacy, hidden)).toBe(true);
  });

  it('adds a list filter only when enforced', () => {
    expect(ownedResourceWhere(accessor({ isEnforced: false }), { ownership: 'all' })).toEqual({
      AND: [{ isSystemOwned: false }]
    });
    expect(ownedResourceWhere(accessor(), { ownership: 'all' })).toEqual({
      AND: [
        { isSystemOwned: false },
        {
          OR: [{ isOwnerOnlyVisible: false }, { ownerActorOid: { in: [ownConsumerOid] } }]
        }
      ]
    });
  });

  it('can only be switched on for owned resources when enforced', async () => {
    await expect(
      assertCanChangeOwnerOnlyVisibility(accessor({ isEnforced: false }), { id: 'r' }, true)
    ).rejects.toThrow('only available when ownership is enforced');
    await expect(
      assertCanChangeOwnerOnlyVisibility(accessor(), { id: 'r', ownerActorOid: null }, true)
    ).rejects.toThrow('no owner');
    await expect(
      assertCanChangeOwnerOnlyVisibility(
        accessor(),
        { id: 'r', ownerActorOid: ownConsumerOid },
        true
      )
    ).resolves.toBeUndefined();
  });

  it('can only be switched off by the owner', async () => {
    await expect(
      assertCanChangeOwnerOnlyVisibility(
        accessor(),
        { id: 'r', ownerActorOid: consumerOwnerOid, isOwnerOnlyVisible: true },
        false
      )
    ).rejects.toThrow('Only the owner');
    await expect(
      assertCanChangeOwnerOnlyVisibility(
        accessor(),
        { id: 'r', ownerActorOid: ownConsumerOid, isOwnerOnlyVisible: true },
        false
      )
    ).resolves.toBeUndefined();
  });
});

describe('ownership filter', () => {
  it('defaults to everything for legacy projects and to shared resources when enforced', () => {
    expect(ownedResourceWhere(accessor({ isEnforced: false }))).toEqual({
      AND: [{ isSystemOwned: false }]
    });

    let enforced = ownedResourceWhere(accessor());

    expect(enforced.AND).toHaveLength(3);
    expect(enforced.AND[2]).toEqual({
      OR: [
        { ownerActorOid: null },
        { ownerActor: { type: { notIn: ['consumer', 'organization_member'] } } }
      ]
    });
  });

  it('applies the usable filter on request', () => {
    let where = ownedResourceWhere(accessor(), { ownership: 'usable' });

    expect(where.AND).toHaveLength(3);
  });
});

describe('attaching owned resources', () => {
  let owned = { id: 'cfg', ownerActorOid: consumerOwnerOid };

  it('is unrestricted for legacy projects', async () => {
    await expect(
      assertCanAttachOwnedResources(accessor({ isEnforced: false }), { ownerActorOid: null }, [
        owned
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects owned children on an existing parent with another owner', async () => {
    await expect(
      assertCanAttachOwnedResources(accessor(), { ownerActorOid: null }, [owned])
    ).rejects.toThrow("can't be attached");
    await expect(
      assertCanAttachOwnedResources(accessor(), { ownerActorOid: ownConsumerOid }, [owned])
    ).rejects.toThrow("can't be attached");
  });

  it('allows matching owners, unowned children and new parents', async () => {
    await expect(
      assertCanAttachOwnedResources(accessor(), { ownerActorOid: consumerOwnerOid }, [owned])
    ).resolves.toBeUndefined();
    await expect(
      assertCanAttachOwnedResources(accessor(), { ownerActorOid: null }, [{ id: 'free' }])
    ).resolves.toBeUndefined();
    await expect(
      assertCanAttachOwnedResources(accessor(), null, [owned])
    ).resolves.toBeUndefined();
  });
});

describe('organization member owners', () => {
  it('enforces the owner lock in both databases', async () => {
    mocks.subspaceIdentityActor.findUnique.mockResolvedValue({ type: 'organization_member' });
    mocks.coreIdentityActor.findUnique.mockResolvedValue({
      id: 'other',
      type: 'organization_member'
    });
    let resource = { ownerActorOid: consumerOwnerOid, isOwnerLocked: true };

    expect(await canUseOwnedResource(accessor(), resource)).toBe(false);
    expect(await canUseCoreOwnedResource(accessor(), resource)).toBe(false);
    expect(
      await canUseOwnedResource(accessor({ ownActorOids: [consumerOwnerOid] }), resource)
    ).toBe(true);
  });

  it('prevents attaching another member’s resource to a shared parent', async () => {
    mocks.subspaceIdentityActor.findUnique.mockResolvedValue({ type: 'organization_member' });

    await expect(
      assertCanAttachOwnedResources(accessor(), { ownerActorOid: null }, [
        { id: 'cfg', ownerActorOid: consumerOwnerOid }
      ])
    ).rejects.toThrow("can't be attached");
  });
});
