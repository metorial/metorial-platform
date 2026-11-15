import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, markAresSsoTenantChangedForConnection } = vi.hoisted(() => ({
  db: {
    ssoDirectoryGroup: { findUnique: vi.fn(), upsert: vi.fn() },
    ssoDirectoryRole: { findUnique: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    ssoConnectionRole: { findMany: vi.fn() },
    ssoGroup: { findMany: vi.fn() },
    ssoRole: { findMany: vi.fn() }
  },
  markAresSsoTenantChangedForConnection: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn((factory: any) => ({
      run: () => factory({ prisma: (handler: any) => handler({}) })
    }))
  }
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
  markAresSsoTenantChangedForConnection
}));

import { ssoGroupRoleService } from './groupRole';

let directory = {
  oid: 1n,
  id: 'directory_1',
  connectionOid: 2n,
  status: 'active'
} as any;

describe('directory group and role provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.ssoDirectoryGroup.findUnique.mockResolvedValue(null);
    db.ssoDirectoryRole.findUnique.mockResolvedValue(null);
    db.ssoDirectoryRole.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('stores an explicit directory-group association', async () => {
    let group = { oid: 3n, id: 'group_1', connectionOid: directory.connectionOid } as any;

    await ssoGroupRoleService.linkDirectoryGroup({ directory, group });

    expect(db.ssoDirectoryGroup.upsert).toHaveBeenCalledWith({
      where: {
        directoryOid_groupOid: {
          directoryOid: directory.oid,
          groupOid: group.oid
        }
      },
      create: {
        oid: 100n,
        id: 'ssoDirectoryGroup_generated',
        directoryOid: directory.oid,
        groupOid: group.oid
      },
      update: {}
    });
    expect(markAresSsoTenantChangedForConnection).toHaveBeenCalledWith({
      connectionOid: directory.connectionOid
    });
  });

  it('does not mark the tenant changed when the directory-group link already exists', async () => {
    let group = { oid: 3n, id: 'group_1', connectionOid: directory.connectionOid } as any;
    db.ssoDirectoryGroup.findUnique.mockResolvedValue({ oid: 9n, id: 'sdg_1' });

    await ssoGroupRoleService.linkDirectoryGroup({ directory, group });

    expect(db.ssoDirectoryGroup.upsert).not.toHaveBeenCalled();
    expect(markAresSsoTenantChangedForConnection).not.toHaveBeenCalled();
  });

  it('reconciles the persisted directory-role catalog', async () => {
    db.ssoConnectionRole.findMany.mockResolvedValue([{ oid: 4n }, { oid: 5n }]);

    await ssoGroupRoleService.reconcileDirectoryRoles({ directory });

    expect(db.ssoDirectoryRole.deleteMany).toHaveBeenCalledWith({
      where: {
        directoryOid: directory.oid,
        roleOid: { notIn: [4n, 5n] }
      }
    });
    expect(db.ssoDirectoryRole.upsert).toHaveBeenCalledTimes(2);
    expect(markAresSsoTenantChangedForConnection).toHaveBeenCalledWith({
      connectionOid: directory.connectionOid
    });
  });

  it('leaves the tenant revision untouched when the directory-role catalog is unchanged', async () => {
    db.ssoConnectionRole.findMany.mockResolvedValue([{ oid: 4n }]);
    db.ssoDirectoryRole.findUnique.mockResolvedValue({ oid: 10n });

    await ssoGroupRoleService.reconcileDirectoryRoles({ directory });

    expect(db.ssoDirectoryRole.upsert).not.toHaveBeenCalled();
    expect(markAresSsoTenantChangedForConnection).not.toHaveBeenCalled();
  });

  it('filters groups through stored directory provenance', async () => {
    db.ssoGroup.findMany.mockResolvedValue([]);

    let paginator = await ssoGroupRoleService.listRootGroups({
      tenant: { oid: 6n } as any,
      filters: { directoryIds: ['directory_1'] }
    });
    await paginator.run({} as any);

    expect(db.ssoGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              connectionGroups: {
                some: {
                  directories: {
                    some: { directory: { id: { in: ['directory_1'] } } }
                  }
                }
              }
            }
          ])
        })
      })
    );
  });
});
