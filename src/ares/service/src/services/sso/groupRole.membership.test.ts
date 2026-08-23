import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    ssoUserProfileGroup: { upsert: vi.fn(), deleteMany: vi.fn() },
    ssoUserProfileRole: { upsert: vi.fn(), deleteMany: vi.fn() }
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

vi.mock('../../db', () => ({
  db,
  withTransaction: vi.fn((handler: (transaction: typeof db) => Promise<unknown>) =>
    handler(db)
  )
}));

vi.mock('../../id', () => ({
  getId: vi.fn((type: string) => ({ oid: 100n, id: `${type}_generated` }))
}));

vi.mock('../../queues/syncCallback', () => ({
  markAresSsoTenantChanged: vi.fn(),
  markAresSsoTenantChangedForConnection: vi.fn()
}));

import { ssoGroupRoleService } from './groupRole';

let connection = { oid: 2n, id: 'sco_1', tenantOid: 6n } as any;
let userProfile = { oid: 50n, id: 'sup_1' } as any;

let groupOidByValue: Record<string, bigint> = { Engineering: 11n, Design: 12n };
let roleOidByValue: Record<string, bigint> = { admin: 21n, viewer: 22n };

describe('user profile membership replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(ssoGroupRoleService, 'upsertGroup').mockImplementation(
      async ({ value }: any) => ({ oid: groupOidByValue[value]! }) as any
    );
    vi.spyOn(ssoGroupRoleService, 'upsertRole').mockImplementation(
      async ({ value }: any) => ({ oid: roleOidByValue[value]! }) as any
    );
  });

  it('keeps group link ids stable by upserting on the membership pair', async () => {
    await ssoGroupRoleService.replaceUserProfileGroups({
      connection,
      userProfile,
      groups: ['Engineering', 'Design']
    });

    expect(db.ssoUserProfileGroup.upsert).toHaveBeenCalledWith({
      where: { userProfileOid_groupOid: { userProfileOid: 50n, groupOid: 11n } },
      create: {
        oid: 100n,
        id: 'ssoUserProfileGroup_generated',
        userProfileOid: 50n,
        groupOid: 11n
      },
      update: {}
    });
    expect(db.ssoUserProfileGroup.upsert).toHaveBeenCalledTimes(2);
  });

  it('removes only the group memberships that are gone', async () => {
    await ssoGroupRoleService.replaceUserProfileGroups({
      connection,
      userProfile,
      groups: ['Engineering']
    });

    expect(db.ssoUserProfileGroup.deleteMany).toHaveBeenCalledWith({
      where: { userProfileOid: 50n, groupOid: { notIn: [11n] } }
    });
  });

  it('clears every group membership when the payload is empty', async () => {
    await ssoGroupRoleService.replaceUserProfileGroups({
      connection,
      userProfile,
      groups: []
    });

    expect(db.ssoUserProfileGroup.upsert).not.toHaveBeenCalled();
    expect(db.ssoUserProfileGroup.deleteMany).toHaveBeenCalledWith({
      where: { userProfileOid: 50n, groupOid: { notIn: [] } }
    });
  });

  it('keeps role link ids stable and drops only removed roles', async () => {
    await ssoGroupRoleService.replaceUserProfileRoles({
      connection,
      userProfile,
      roles: ['admin']
    });

    expect(db.ssoUserProfileRole.upsert).toHaveBeenCalledWith({
      where: { userProfileOid_roleOid: { userProfileOid: 50n, roleOid: 21n } },
      create: {
        oid: 100n,
        id: 'ssoUserProfileRole_generated',
        userProfileOid: 50n,
        roleOid: 21n
      },
      update: {}
    });
    expect(db.ssoUserProfileRole.deleteMany).toHaveBeenCalledWith({
      where: { userProfileOid: 50n, roleOid: { notIn: [21n] } }
    });
  });

  it('deduplicates repeated values before writing memberships', async () => {
    await ssoGroupRoleService.replaceUserProfileGroups({
      connection,
      userProfile,
      groups: ['Engineering', 'Engineering']
    });

    expect(db.ssoUserProfileGroup.upsert).toHaveBeenCalledTimes(1);
  });
});
