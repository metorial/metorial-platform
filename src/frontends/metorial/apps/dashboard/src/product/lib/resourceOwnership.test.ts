import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  access: {
    data: null as { restrictedForCaller: boolean } | null,
    error: null as Error | null
  }
}));

vi.mock('@metorial/state', () => ({
  useCurrentInstance: () => ({ data: { id: 'ins_1' } }),
  useCurrentOrganization: () => ({ data: { member: { id: 'mem_1' } } }),
  useBoot: () => ({ data: { consumers: [{ id: 'con_1' }] }, error: null }),
  useOwnershipAccess: () => state.access
}));

import {
  getResourceOwnershipAccess,
  useResourceOwnershipAccess,
  type OwnedResource
} from './resourceOwnership';

let caller = {
  organizationMemberId: 'mem_1',
  consumerIds: ['con_1'],
  restrictedForCaller: true
};

let memberResource: OwnedResource = {
  access: {
    source: null,
    type: 'owner_locked',
    visibility: 'owner',
    owner: {
      type: 'organization_member',
      name: 'Member',
      email: 'member@example.com',
      imageUrl: null,
      organizationMember: { id: 'mem_1' },
      consumer: { id: 'con_1', profileId: 'cpf_1', portalId: null }
    }
  }
};

describe('resource access ownership', () => {
  it('recognizes the current member without an actor ID', () => {
    expect(
      getResourceOwnershipAccess(memberResource, { ...caller, consumerIds: [] })
    ).toMatchObject({ canUse: true, isOwn: true, isConsumerOwned: true });
  });

  it('recognizes the owning consumer across profiles', () => {
    let resource: OwnedResource = {
      access: {
        ...memberResource.access!,
        owner: {
          ...memberResource.access!.owner!,
          type: 'consumer',
          organizationMember: undefined
        }
      }
    };

    expect(
      getResourceOwnershipAccess(resource, { ...caller, organizationMemberId: undefined })
    ).toMatchObject({
      canUse: true,
      isOwn: true
    });
  });

  it('does not confuse a dashboard member with a separate portal actor of the same user', () => {
    let resource: OwnedResource = {
      access: {
        ...memberResource.access!,
        owner: {
          ...memberResource.access!.owner!,
          type: 'consumer',
          organizationMember: undefined
        }
      }
    };

    expect(getResourceOwnershipAccess(resource, caller)).toMatchObject({
      canUse: false,
      isOwn: false
    });
  });

  it('blocks another member from using an owner-locked resource', () => {
    expect(
      getResourceOwnershipAccess(memberResource, {
        organizationMemberId: 'mem_2',
        consumerIds: ['con_2'],
        restrictedForCaller: false
      })
    ).toMatchObject({ canUse: false, isOwn: false });
  });

  it('keeps unlocked resources subject to project access restrictions', () => {
    let resource: OwnedResource = {
      access: { ...memberResource.access!, type: 'public', visibility: 'anyone' }
    };
    let otherCaller = {
      organizationMemberId: 'mem_2',
      consumerIds: [],
      restrictedForCaller: true
    };

    expect(getResourceOwnershipAccess(resource, otherCaller).canUse).toBe(false);
    expect(
      getResourceOwnershipAccess(resource, { ...otherCaller, restrictedForCaller: false })
        .canUse
    ).toBe(true);
  });

  it('allows shared resources', () => {
    expect(
      getResourceOwnershipAccess(
        { access: { source: null, type: 'public', visibility: 'anyone', owner: null } },
        caller
      )
    ).toEqual({ canUse: true, isOwn: false, isConsumerOwned: false });
  });
});

describe('ownership lookup readiness', () => {
  beforeEach(() => {
    state.access = { data: null, error: null };
  });

  it('does not permit an owned resource before ownership access is loaded', () => {
    expect(useResourceOwnershipAccess(memberResource)).toMatchObject({
      canUse: false,
      isLoading: true
    });
  });

  it('does not treat a failed ownership lookup as permission', () => {
    state.access.error = new Error('Forbidden');

    expect(useResourceOwnershipAccess(memberResource)).toMatchObject({
      canUse: false,
      isLoading: false
    });
  });

  it('permits the owner after access has loaded', () => {
    state.access.data = { restrictedForCaller: true };

    expect(useResourceOwnershipAccess(memberResource)).toMatchObject({
      canUse: true,
      isOwn: true,
      isLoading: false
    });
  });
});
