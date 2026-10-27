import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({ db: {} }));
vi.mock('@metorial-subspace/module-tenant/src/lib/metorialDb', () => ({ metorialDb: {} }));
vi.mock('@metorial-subspace/module-tenant/src/lib/metorialFacing', () => ({
  resolveMetorialFacing: vi.fn()
}));

import {
  canSeeOwnedResource,
  isOwnershipEnforced,
  ownedResourceWhere,
  type OwnershipAccessor
} from '@metorial-subspace/module-tenant/src/lib/ownershipAccess';

let accessor = (d: Partial<OwnershipAccessor> = {}): OwnershipAccessor => ({
  kind: 'member',
  ownActorOids: [7n],
  ownActorIds: ['act_7'],
  isRestrictedByProject: true,
  isEnforced: true,
  allowSystemOwned: false,
  ...d
});

let serialize = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));

let legacyAccessor = accessor({ isRestrictedByProject: false, isEnforced: false });

describe('provider config ownership filters', () => {
  it('keeps the legacy default list unfiltered apart from system-owned resources', () => {
    expect(ownedResourceWhere(legacyAccessor)).toEqual({ AND: [{ isSystemOwned: false }] });
  });

  it('defaults to shared resources when ownership is enforced', () => {
    let where = ownedResourceWhere(accessor());

    expect(where.AND).toContainEqual({ isSystemOwned: false });
    expect(serialize(where.AND)).toContain('"ownerActorOid":null');
  });

  it('returns owned resources for the all filter without a shared restriction', () => {
    let where = ownedResourceWhere(accessor(), { ownership: 'all' });

    expect(serialize(where.AND)).not.toContain('"ownerActorOid":null');
  });

  it('includes system-owned resources only when requested', () => {
    expect(ownedResourceWhere(legacyAccessor, { includeSystemOwned: true }).AND).toEqual([]);
  });
});

describe('provider config visibility', () => {
  let ownedOnlyVisible = { ownerActorOid: 7n, isOwnerOnlyVisible: true };

  it('hides owner-only resources from non-owners when enforced', () => {
    expect(canSeeOwnedResource(accessor({ ownActorOids: [8n] }), ownedOnlyVisible)).toBe(
      false
    );
  });

  it('shows owner-only resources to the owner', () => {
    expect(canSeeOwnedResource(accessor(), ownedOnlyVisible)).toBe(true);
  });

  it('ignores owner-only visibility when ownership is not enforced', () => {
    expect(canSeeOwnedResource(legacyAccessor, ownedOnlyVisible)).toBe(true);
  });

  it('always hides system-owned resources', () => {
    expect(canSeeOwnedResource(legacyAccessor, { isSystemOwned: true })).toBe(false);
    expect(
      canSeeOwnedResource(accessor({ allowSystemOwned: true }), { isSystemOwned: true })
    ).toBe(true);
  });
});

describe('ownership enforcement flag', () => {
  it('is off for legacy projects and on when either flag is disabled', () => {
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
  });
});
