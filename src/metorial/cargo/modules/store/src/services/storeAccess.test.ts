import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, getAccessTagFilterMock, getActorByIdMock } = vi.hoisted(() => ({
  db: {
    store: {
      findMany: vi.fn()
    },
    storeParticipant: {
      findMany: vi.fn()
    },
    skill: {
      findMany: vi.fn()
    }
  },
  getAccessTagFilterMock: vi.fn(),
  getActorByIdMock: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  withTransaction: vi.fn(async (fn: any) => await fn(db))
}));

vi.mock('@metorial/cargo-config/id', () => ({
  getId: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  consumerSkillReadRoles: ['consumer#instance.skill:read'],
  consumerSkillWriteRoles: ['consumer#instance.skill:write'],
  accessTagService: {
    getAccessTagFilter: getAccessTagFilterMock
  }
}));

vi.mock('@metorial/module-resource-tenant', () => ({
  resourceActorService: {
    getActorById: getActorByIdMock
  }
}));

import { storeAccessService, storeReadPermission, storeWritePermission } from './storeAccess';

let scope = {
  resourceTenant: { oid: 1n, id: 'rtn_1' },
  resourceGroup: { oid: 2n, id: 'rgr_1' }
};
let actor = { oid: 3n, id: 'rac_1' };
let store = { oid: 4n, id: 'store_1', access: 'private' };
let accessTags = [{ accessTagOid: 5n }];
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

    getActorByIdMock.mockResolvedValue(actor);
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
      actorId: actor.id,
      accessTags,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid]
    });

    expect(result.accessibleStoreOids).toEqual([store.oid]);
    let accessibleSkillQuery = db.skill.findMany.mock.calls[1]![0];
    expect(accessibleSkillQuery.where).toEqual(
      expect.objectContaining({
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

  it('does not turn a skill-group read grant into write access', async () => {
    await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      actorId: actor.id,
      accessTags,
      requiredPermission: storeWritePermission,
      storeOids: [store.oid]
    });

    let accessibleSkillQuery = db.skill.findMany.mock.calls[1]![0];
    expect(accessibleSkillQuery.where.OR).toEqual([
      { createdByResourceActorOid: actor.oid },
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
      actorId: actor.id,
      accessTags,
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
      actorId: actor.id,
      accessTags,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid]
    });

    expect(result.accessibleStoreOids).toEqual([store.oid]);
  });

  it('recognizes legacy consumer ownership through the native actor link', async () => {
    getActorByIdMock.mockResolvedValue({
      ...actor,
      consumerOid: 20n
    });

    await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      actorId: actor.id,
      accessTags,
      requiredPermission: storeWritePermission,
      storeOids: [store.oid]
    });

    let accessibleSkillQuery = db.skill.findMany.mock.calls[1]![0];
    expect(accessibleSkillQuery.where.OR).toContainEqual({
      createdByConsumerOid: 20n
    });
  });
});
