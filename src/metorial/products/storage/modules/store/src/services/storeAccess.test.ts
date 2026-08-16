import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, getAccessTagFilterMock } = vi.hoisted(() => ({
  db: {
    store: {
      findMany: vi.fn()
    },
    storeParticipant: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    skill: {
      findMany: vi.fn()
    }
  },
  getAccessTagFilterMock: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  withTransaction: vi.fn(async (fn: any) => await fn(db)),
  ID: {
    generateId: vi.fn(async () => 'storeParticipant_generated')
  }
}));

vi.mock('@metorial/module-access', () => ({
  consumerSkillReadRoles: ['consumer#instance.skill:read'],
  consumerSkillWriteRoles: ['consumer#instance.skill:write'],
  assertResourceAuthorizationScope: vi.fn(),
  accessTagService: {
    getAccessTagFilter: getAccessTagFilterMock
  }
}));

import { storeAccessService, storeReadPermission, storeWritePermission } from './storeAccess';

let scope: any = {
  project: { oid: 6n, id: 'prj_1' },
  instance: { oid: 7n, id: 'ins_1' }
};
let actor: any = { oid: 3n, id: 'rac_1' };
let store = { oid: 4n, id: 'store_1', access: 'private' };
let accessTags = [{ accessTagOid: 5n }];
let authorization: any = {
  type: 'restricted',
  resourceActor: actor,
  accessTags
};
let accessTagFilter = {
  some: {
    accessTagOid: { in: [5n] },
    accessTagPolicy: {
      roles: {
        hasSome: ['consumer#instance.skill:read']
      }
    }
  }
};

describe('native consumer skill store access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessTagFilterMock.mockImplementation(async ({ roles }) => ({
      ...accessTagFilter,
      some: {
        ...accessTagFilter.some,
        accessTagPolicy: {
          roles: {
            hasSome: roles
          }
        }
      }
    }));
    db.store.findMany.mockResolvedValue([store]);
    db.storeParticipant.findMany.mockResolvedValue([]);
    db.skill.findMany
      .mockResolvedValueOnce([{ storeOid: store.oid }])
      .mockResolvedValueOnce([{ storeOid: store.oid }]);
  });

  it('allows reads inherited from an active skill group', async () => {
    let result = await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid]
    });

    expect(result.accessibleStoreOids).toEqual([store.oid]);
    let accessibleSkillQuery = db.skill.findMany.mock.calls[1]![0];
    expect(accessibleSkillQuery.where).toEqual(
      expect.objectContaining({
        projectOid: scope.project.oid,
        instanceOid: scope.instance.oid,
        status: 'active',
        OR: expect.arrayContaining([
          {
            skillGroupItems: {
              some: {
                status: 'active',
                skillGroup: {
                  status: 'active',
                  accessTagEntities: accessTagFilter
                }
              }
            }
          }
        ])
      })
    );
  });

  it('updates observational participant permissions without policy cleanup', async () => {
    let participant = {
      id: 'stp_1',
      storeOid: store.oid,
      resourceActorOid: actor.oid,
      permissions: [storeReadPermission]
    };
    db.storeParticipant.findMany.mockResolvedValue([participant]);
    db.storeParticipant.update.mockResolvedValue({
      ...participant,
      permissions: []
    });

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: [],
      overridePermissions: true
    });

    expect(db.storeParticipant.update).toHaveBeenCalled();
  });

  it('does not turn a skill-group read grant into write access', async () => {
    await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization,
      requiredPermission: storeWritePermission,
      storeOids: [store.oid]
    });

    let accessibleSkillQuery = db.skill.findMany.mock.calls[1]![0];
    expect(accessibleSkillQuery.where.OR).toEqual([
      {
        accessTagEntities: {
          ...accessTagFilter,
          some: {
            ...accessTagFilter.some,
            accessTagPolicy: {
              roles: {
                hasSome: ['consumer#instance.skill:write']
              }
            }
          }
        }
      }
    ]);
  });

  it('ignores stale consumer participants after an access-tag grant is revoked', async () => {
    db.storeParticipant.findMany.mockResolvedValue([
      {
        storeOid: store.oid,
        resourceActorOid: actor.oid,
        permissions: [storeReadPermission]
      }
    ]);
    db.skill.findMany
      .mockReset()
      .mockResolvedValueOnce([{ storeOid: store.oid }])
      .mockResolvedValueOnce([]);

    let result = await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid]
    });

    expect(result.accessibleStoreOids).toEqual([]);
  });

  it('retains participant access for non-skill stores', async () => {
    db.storeParticipant.findMany.mockResolvedValue([
      {
        storeOid: store.oid,
        resourceActorOid: actor.oid,
        permissions: [storeReadPermission]
      }
    ]);
    db.skill.findMany.mockReset().mockResolvedValue([]);

    let result = await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid]
    });

    expect(result.accessibleStoreOids).toEqual([store.oid]);
  });

  it('allows privileged actors to write private stores', async () => {
    let result = await storeAccessService.assertStoreAccessForStore({
      ...scope,
      authorization: {
        type: 'privileged',
        resourceActor: actor
      },
      requiredPermission: storeWritePermission,
      store
    });

    expect(result.accessibleStoreOids).toEqual([store.oid]);
  });

  it('does not recognize creator columns as skill access', async () => {
    authorization = {
      ...authorization,
      resourceActor: {
        ...actor,
        consumerOid: 20n
      }
    };

    await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization,
      requiredPermission: storeWritePermission,
      storeOids: [store.oid]
    });

    let accessibleSkillQuery = db.skill.findMany.mock.calls[1]![0];
    expect(accessibleSkillQuery.where.OR).not.toContainEqual({
      createdByResourceActorOid: actor.oid
    });
    expect(accessibleSkillQuery.where.OR).not.toContainEqual({
      createdByConsumerOid: 20n
    });
  });
});
