import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({ db: {} }));

import {
  effectiveOwnerActorOid,
  getConsumerOwnerActorId,
  mergeResourceOwners
} from './ownership';

describe('mergeResourceOwners', () => {
  it('takes the first owner and inherits any lock', () => {
    expect(
      mergeResourceOwners(
        { ownerActorOid: null, isOwnerLocked: false },
        { ownerActorOid: 5n, isOwnerLocked: false },
        { ownerActorOid: 6n, isOwnerLocked: true }
      )
    ).toEqual({ ownerActorOid: 5n, isOwnerLocked: true, isOwnerOnlyVisible: false });
  });

  it('is ownerless and unlocked without sources', () => {
    expect(mergeResourceOwners(null, undefined)).toEqual({
      ownerActorOid: null,
      isOwnerLocked: false,
      isOwnerOnlyVisible: false
    });
  });
});

describe('effectiveOwnerActorOid', () => {
  it('prefers the owner, then the identity actor, then the actor', () => {
    expect(
      effectiveOwnerActorOid({ ownerActorOid: 1n, identityActorOid: 2n, actorOid: 3n })
    ).toBe(1n);
    expect(effectiveOwnerActorOid({ identityActorOid: 2n, actorOid: 3n })).toBe(2n);
    expect(effectiveOwnerActorOid({ actorOid: 3n })).toBe(3n);
    expect(effectiveOwnerActorOid({})).toBeNull();
  });
});

describe('getConsumerOwnerActorId', () => {
  it('only returns an owner for consumer-created resources', () => {
    expect(
      getConsumerOwnerActorId({
        privateMetadata: { $owner: 'consumer' },
        identityActorId: 'a'
      })
    ).toBe('a');
    expect(
      getConsumerOwnerActorId({
        privateMetadata: { $owner: 'organization' },
        identityActorId: 'a'
      })
    ).toBeNull();
  });
});
