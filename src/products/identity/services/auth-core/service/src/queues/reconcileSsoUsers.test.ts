import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, enqueueSsoUserChange, groupRoleService } = vi.hoisted(() => ({
  db: {
    ssoUser: { findUnique: vi.fn(), update: vi.fn() },
    ssoUserGroup: { upsert: vi.fn(), deleteMany: vi.fn() },
    ssoUserRole: { upsert: vi.fn(), deleteMany: vi.fn() }
  },
  enqueueSsoUserChange: vi.fn(),
  groupRoleService: { syncConnectionGroupRoot: vi.fn(), syncConnectionRoleRoot: vi.fn() }
}));

vi.mock('@lowerdeck/cron', () => ({ createCron: vi.fn(() => ({})) }));

vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn((processors: unknown[]) => processors),
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: (handler: unknown) => handler
  }))
}));

vi.mock('../db', () => ({
  db,
  withTransaction: vi.fn((handler: (transaction: typeof db) => Promise<unknown>) =>
    handler(db)
  )
}));

vi.mock('../id', () => ({
  getId: vi.fn((type: string) => ({ oid: 100n, id: `${type}_generated` }))
}));

vi.mock('./recordSsoUserChanges', () => ({ enqueueSsoUserChange }));

vi.mock('../services/sso/groupRole', () => ({ ssoGroupRoleService: groupRoleService }));

import { reconcileSingleSsoUserQueueProcessor } from './reconcileSsoUsers';

let reconcile = reconcileSingleSsoUserQueueProcessor as unknown as (data: {
  ssoUserId: string;
}) => Promise<void>;

let ownerProfile = (status: string) => ({
  oid: 50n,
  status,
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  groupLinks: [{ group: { oid: 5n, rootGroup: { oid: 11n } } }],
  roleLinks: [{ role: { oid: 6n, rootRole: { oid: 21n } } }]
});

describe('single SSO user reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.ssoUser.findUnique.mockResolvedValue({
      oid: 1n,
      id: 'ssu_1',
      ownerProfile: ownerProfile('active')
    });
  });

  it('keeps assignment link ids stable by upserting on the membership pair', async () => {
    await reconcile({ ssoUserId: 'ssu_1' });

    expect(db.ssoUserGroup.upsert).toHaveBeenCalledWith({
      where: { userOid_groupOid: { userOid: 1n, groupOid: 11n } },
      create: { oid: 100n, id: 'ssoUserGroup_generated', userOid: 1n, groupOid: 11n },
      update: {}
    });
    expect(db.ssoUserRole.upsert).toHaveBeenCalledWith({
      where: { userOid_roleOid: { userOid: 1n, roleOid: 21n } },
      create: { oid: 100n, id: 'ssoUserRole_generated', userOid: 1n, roleOid: 21n },
      update: {}
    });
  });

  it('removes only the assignments that are gone', async () => {
    await reconcile({ ssoUserId: 'ssu_1' });

    expect(db.ssoUserGroup.deleteMany).toHaveBeenCalledWith({
      where: { userOid: 1n, groupOid: { notIn: [11n] } }
    });
    expect(db.ssoUserRole.deleteMany).toHaveBeenCalledWith({
      where: { userOid: 1n, roleOid: { notIn: [21n] } }
    });
  });

  it('resolves a root group that has not been synced yet', async () => {
    db.ssoUser.findUnique.mockResolvedValue({
      oid: 1n,
      id: 'ssu_1',
      ownerProfile: {
        ...ownerProfile('active'),
        groupLinks: [{ group: { oid: 5n, rootGroup: null } }]
      }
    });
    groupRoleService.syncConnectionGroupRoot.mockResolvedValue({ rootGroup: { oid: 33n } });

    await reconcile({ ssoUserId: 'ssu_1' });

    expect(db.ssoUserGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userOid_groupOid: { userOid: 1n, groupOid: 33n } }
      })
    );
  });

  it('clears every assignment when the owner profile is deprovisioned', async () => {
    db.ssoUser.findUnique.mockResolvedValue({
      oid: 1n,
      id: 'ssu_1',
      ownerProfile: ownerProfile('deprovisioned')
    });

    await reconcile({ ssoUserId: 'ssu_1' });

    expect(db.ssoUserGroup.deleteMany).toHaveBeenCalledWith({ where: { userOid: 1n } });
    expect(db.ssoUserRole.deleteMany).toHaveBeenCalledWith({ where: { userOid: 1n } });
    expect(db.ssoUserGroup.upsert).not.toHaveBeenCalled();
    expect(db.ssoUserRole.upsert).not.toHaveBeenCalled();
  });

  it('announces the change so downstream mirrors resync', async () => {
    await reconcile({ ssoUserId: 'ssu_1' });

    expect(enqueueSsoUserChange).toHaveBeenCalledWith({
      ssoUserId: 'ssu_1',
      source: 'user_reconciled',
      scimOperationId: undefined
    });
  });
});
