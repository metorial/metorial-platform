import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, reconcileSingleSsoUserQueue, ssoGroupRoleService } = vi.hoisted(() => ({
  db: {
    ssoDirectory: { findUnique: vi.fn() },
    ssoConnectionGroup: { findFirst: vi.fn(), delete: vi.fn() },
    ssoGroup: { deleteMany: vi.fn() },
    ssoDirectoryUserProfile: { findFirst: vi.fn(), findMany: vi.fn() },
    ssoUserProfileGroup: {
      findMany: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn()
    },
    ssoUserProfile: { findFirst: vi.fn(), update: vi.fn() }
  },
  reconcileSingleSsoUserQueue: { add: vi.fn() },
  ssoGroupRoleService: {
    upsertGroup: vi.fn(),
    linkDirectoryGroup: vi.fn(),
    reconcileDirectoryRoles: vi.fn(),
    replaceUserProfileGroups: vi.fn(),
    replaceUserProfileRoles: vi.fn()
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('../../db', () => ({ db }));

vi.mock('../../id', () => ({
  getId: vi.fn((type: string) => ({ oid: 100n, id: `${type}_generated` }))
}));

vi.mock('../../queues/reconcileSsoUsers', () => ({
  reconcileSingleSsoUserQueue
}));

vi.mock('./groupRole', () => ({
  ssoGroupRoleService
}));

vi.mock('./identity', () => ({
  ssoIdentityService: {
    upsertUser: vi.fn(),
    linkDirectoryUserProfile: vi.fn(),
    setUserOwnerProfile: vi.fn()
  }
}));

import { ssoDirectorySyncService } from './directorySync';
import { ssoIdentityService } from './identity';

let directory = {
  oid: 1n,
  id: 'directory_1',
  connectionOid: 2n
} as any;

let group = {
  oid: 3n,
  id: 'group_1',
  connectionOid: directory.connectionOid,
  value: 'Developers'
} as any;

let makeDirectoryLink = (index: number, externalId: string) => ({
  oid: BigInt(10 + index),
  externalId,
  userProfileOid: BigInt(20 + index),
  userProfile: {
    oid: BigInt(20 + index),
    email: `user-${index}@example.com`,
    user: { id: `user_${index}` }
  }
});

let makeMembership = (index: number, externalId: string) => {
  let link = makeDirectoryLink(index, externalId);
  return {
    oid: BigInt(30 + index),
    userProfileOid: link.userProfileOid,
    userProfile: link.userProfile
  };
};

describe('SCIM directory group membership replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.ssoUserProfileGroup.findMany.mockImplementation(async (args: any) => {
      if (args.where?.userProfileOid) {
        return [{ group: { value: group.value } }];
      }
      return [];
    });
    db.ssoDirectoryUserProfile.findMany.mockImplementation(async (args: any) => {
      if (args.where?.externalId?.not === null) {
        return [];
      }
      return [];
    });
    db.ssoConnectionGroup.findFirst.mockResolvedValue(null);
  });

  it('treats members on a full group PUT as an authoritative replacement', async () => {
    let members = [{ value: 'external_1' }, { value: 'external_2' }];
    db.ssoDirectory.findUnique.mockResolvedValue({
      ...directory,
      connection: { oid: directory.connectionOid }
    });
    ssoGroupRoleService.upsertGroup.mockResolvedValue(group);
    let replaceDirectoryGroupMembers = vi
      .spyOn(ssoDirectorySyncService, 'replaceDirectoryGroupMembers')
      .mockResolvedValue([]);

    await ssoDirectorySyncService.handleDirectorySyncEvent({
      directory,
      event: {
        event: 'group.updated',
        data: { id: group.value, name: 'Developers' }
      } as any,
      scimOperationId: 'scim_operation_1',
      scimRequest: {
        method: 'PUT',
        resourceType: 'groups',
        body: { displayName: 'Developers', members }
      }
    });

    expect(replaceDirectoryGroupMembers).toHaveBeenCalledWith({
      directory: expect.objectContaining({ oid: directory.oid }),
      group,
      members,
      scimOperationId: 'scim_operation_1'
    });
    expect(ssoGroupRoleService.upsertGroup).toHaveBeenCalledWith({
      connection: expect.objectContaining({ oid: directory.connectionOid }),
      value: 'Developers',
      displayName: 'Developers',
      metadata: {
        raw: { id: group.value, name: 'Developers' }
      }
    });

    replaceDirectoryGroupMembers.mockRestore();
  });

  it('removes every connection group when a SCIM user is deprovisioned', async () => {
    let profile = {
      oid: 20n,
      userOid: 30n,
      ownerDirectoryOid: directory.oid
    };
    let user = { oid: profile.userOid, id: 'user_1' };
    let directoryWithConnection = {
      ...directory,
      connection: { oid: directory.connectionOid, tenant: { oid: 4n } }
    };
    db.ssoDirectory.findUnique.mockResolvedValue(directoryWithConnection);
    db.ssoDirectoryUserProfile.findFirst.mockResolvedValue({
      userProfile: profile
    });
    db.ssoUserProfile.update.mockResolvedValue(profile);
    vi.mocked(ssoIdentityService.upsertUser).mockResolvedValue(user as any);

    await ssoDirectorySyncService.syncUserFromDirectoryEvent({
      directory,
      event: {
        event: 'user.updated',
        data: {
          id: 'external_1',
          email: 'user@example.com',
          first_name: 'User',
          last_name: 'Example',
          active: false
        }
      } as any
    });

    expect(ssoGroupRoleService.replaceUserProfileGroups).toHaveBeenCalledWith({
      connection: directoryWithConnection.connection,
      userProfile: profile,
      groups: []
    });
    expect(db.ssoUserProfile.update).toHaveBeenCalledWith({
      where: { oid: profile.oid },
      data: {
        groups: [],
        isGroupRoleMemberReconciled: true
      }
    });
  });

  it('merges and removes an existing directory-only UUID group', async () => {
    let legacyProfile = makeDirectoryLink(0, 'external_1').userProfile;
    db.ssoConnectionGroup.findFirst.mockResolvedValue({
      oid: 4n,
      rootGroupOid: 5n,
      userProfiles: [{ userProfileOid: legacyProfile.oid, userProfile: legacyProfile }]
    });

    await ssoDirectorySyncService.normalizeLegacyDirectoryGroup({
      directory,
      group,
      legacyGroupValue: 'ad97994f-1153-47ac-8f80-819c001a6714',
      scimOperationId: 'scim_operation_1'
    });

    expect(db.ssoUserProfileGroup.upsert).toHaveBeenCalledWith({
      where: {
        userProfileOid_groupOid: {
          userProfileOid: legacyProfile.oid,
          groupOid: group.oid
        }
      },
      create: {
        oid: 100n,
        id: 'ssoUserProfileGroup_generated',
        userProfileOid: legacyProfile.oid,
        groupOid: group.oid
      },
      update: {}
    });
    expect(db.ssoConnectionGroup.delete).toHaveBeenCalledWith({ where: { oid: 4n } });
    expect(db.ssoGroup.deleteMany).toHaveBeenCalledWith({
      where: {
        oid: 5n,
        connectionGroups: { none: {} },
        users: { none: {} }
      }
    });
  });

  it('adds every member from a full group resource and refreshes the profiles', async () => {
    let memberIds = ['external_1', 'external_2', 'external_3'];
    let links = memberIds.map((externalId, index) => makeDirectoryLink(index, externalId));

    db.ssoDirectoryUserProfile.findMany.mockImplementation(async (args: any) => {
      if (args.where?.externalId?.in) return links;
      return links.map(link => ({
        externalId: link.externalId,
        userProfile: { email: link.userProfile.email }
      }));
    });

    let members = await ssoDirectorySyncService.replaceDirectoryGroupMembers({
      directory,
      group,
      members: memberIds.map(value => ({ value })),
      scimOperationId: 'scim_operation_1'
    });

    expect(db.ssoUserProfileGroup.upsert).toHaveBeenCalledTimes(3);
    expect(db.ssoUserProfile.update).toHaveBeenCalledTimes(3);
    expect(reconcileSingleSsoUserQueue.add).toHaveBeenCalledTimes(3);
    expect(reconcileSingleSsoUserQueue.add).toHaveBeenCalledWith({
      ssoUserId: 'user_0',
      source: 'directory_group_membership_changed',
      scimOperationId: 'scim_operation_1'
    });
    expect(members).toEqual([
      { value: 'external_1', display: 'user-0@example.com' },
      { value: 'external_2', display: 'user-1@example.com' },
      { value: 'external_3', display: 'user-2@example.com' }
    ]);
  });

  it('removes members omitted from a later full group resource', async () => {
    let memberIds = ['external_1', 'external_2'];
    let links = memberIds.map((externalId, index) => makeDirectoryLink(index, externalId));
    let existingMemberships = [
      makeMembership(0, 'external_1'),
      makeMembership(1, 'external_2'),
      makeMembership(2, 'external_3')
    ];

    db.ssoDirectoryUserProfile.findMany.mockImplementation(async (args: any) => {
      if (args.where?.externalId?.in) return links;
      return [];
    });
    db.ssoUserProfileGroup.findMany.mockImplementation(async (args: any) => {
      if (args.where?.userProfileOid) return [];
      return existingMemberships;
    });

    await ssoDirectorySyncService.replaceDirectoryGroupMembers({
      directory,
      group,
      members: memberIds.map(value => ({ value }))
    });

    expect(db.ssoUserProfileGroup.delete).toHaveBeenCalledTimes(1);
    expect(db.ssoUserProfileGroup.delete).toHaveBeenCalledWith({
      where: { oid: existingMemberships[2].oid }
    });
    expect(db.ssoUserProfileGroup.upsert).not.toHaveBeenCalled();
    expect(reconcileSingleSsoUserQueue.add).toHaveBeenCalledWith({
      ssoUserId: 'user_2',
      source: 'directory_group_membership_changed',
      scimOperationId: undefined
    });
  });

  it('clears all memberships when the full group resource has no members', async () => {
    let existingMemberships = [
      makeMembership(0, 'external_1'),
      makeMembership(1, 'external_2')
    ];
    db.ssoUserProfileGroup.findMany.mockImplementation(async (args: any) => {
      if (args.where?.userProfileOid) return [];
      return existingMemberships;
    });

    await ssoDirectorySyncService.replaceDirectoryGroupMembers({
      directory,
      group,
      members: []
    });

    expect(db.ssoUserProfileGroup.delete).toHaveBeenCalledTimes(2);
    expect(db.ssoUserProfileGroup.upsert).not.toHaveBeenCalled();
    expect(reconcileSingleSsoUserQueue.add).toHaveBeenCalledTimes(2);
  });

  it('deduplicates repeated member ids', async () => {
    let link = makeDirectoryLink(0, 'external_1');
    db.ssoDirectoryUserProfile.findMany.mockImplementation(async (args: any) => {
      if (args.where?.externalId?.in) return [link];
      return [];
    });

    await ssoDirectorySyncService.replaceDirectoryGroupMembers({
      directory,
      group,
      members: [{ value: 'external_1' }, { value: 'external_1' }]
    });

    expect(db.ssoDirectoryUserProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          externalId: { in: ['external_1'] }
        })
      })
    );
    expect(db.ssoUserProfileGroup.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown users before changing existing memberships', async () => {
    let link = makeDirectoryLink(0, 'external_1');
    db.ssoDirectoryUserProfile.findMany.mockResolvedValue([link]);

    await expect(
      ssoDirectorySyncService.replaceDirectoryGroupMembers({
        directory,
        group,
        members: [{ value: 'external_1' }, { value: 'missing_external_id' }]
      })
    ).rejects.toThrow('SCIM group references unknown users');

    expect(db.ssoUserProfileGroup.findMany).not.toHaveBeenCalled();
    expect(db.ssoUserProfileGroup.delete).not.toHaveBeenCalled();
    expect(db.ssoUserProfileGroup.upsert).not.toHaveBeenCalled();
  });
});
