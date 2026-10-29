import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  getAccessTagFilterMock,
  isStoreResourceFlagEnabledMock,
  getStoreResourceAccessWhereMock,
  setAccessLevelMock
} = vi.hoisted(() => ({
  db: {
    store: {
      findMany: vi.fn()
    },
    storeParticipantActor: {
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn()
    },
    skill: {
      findMany: vi.fn()
    },
    consumerProfile: {
      findUnique: vi.fn()
    }
  },
  getAccessTagFilterMock: vi.fn(),
  isStoreResourceFlagEnabledMock: vi.fn(),
  getStoreResourceAccessWhereMock: vi.fn(),
  setAccessLevelMock: vi.fn()
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
  standaloneStoreResourceAccess: { kind: 'store' },
  assertResourceAuthorizationScope: vi.fn(),
  isStoreResourceFlagEnabled: isStoreResourceFlagEnabledMock,
  getStoreResourceAccessWhere: getStoreResourceAccessWhereMock,
  storeAccessGrantService: {
    setAccessLevel: setAccessLevelMock
  },
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
    isStoreResourceFlagEnabledMock.mockResolvedValue(false);
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
    db.storeParticipantActor.findMany.mockResolvedValue([]);
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
    db.storeParticipantActor.findMany.mockResolvedValue([participant]);
    db.storeParticipantActor.update.mockResolvedValue({
      ...participant,
      permissions: []
    });

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: [],
      overridePermissions: true
    });

    expect(db.storeParticipantActor.update).toHaveBeenCalled();
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
    db.storeParticipantActor.findMany.mockResolvedValue([
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
    db.storeParticipantActor.findMany.mockResolvedValue([
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

  it('does not grant public-read access to skill stores without a skill grant', async () => {
    db.store.findMany.mockResolvedValue([{ ...store, access: 'public_read' }]);
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
    expect(db.storeParticipantActor.update).not.toHaveBeenCalled();
  });

  it('grants public-read access to non-skill stores', async () => {
    db.store.findMany.mockResolvedValue([{ ...store, access: 'public_read' }]);
    db.storeParticipantActor.findMany.mockResolvedValue([
      {
        id: 'stp_1',
        storeOid: store.oid,
        resourceActorOid: actor.oid,
        permissions: []
      }
    ]);
    db.storeParticipantActor.update.mockImplementation(async ({ data }) => ({
      id: 'stp_1',
      storeOid: store.oid,
      resourceActorOid: actor.oid,
      permissions: data.permissions
    }));
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

describe('store access dual mode', () => {
  let consumerActor: any = { oid: 30n, id: 'rac_consumer', consumerProfileOid: 31n };
  let consumerAuthorization: any = {
    type: 'restricted',
    resourceActor: consumerActor,
    accessTags
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isStoreResourceFlagEnabledMock.mockResolvedValue(false);
    getAccessTagFilterMock.mockResolvedValue(accessTagFilter);
    getStoreResourceAccessWhereMock.mockResolvedValue({ marker: 'v2-access-where' });
    db.store.findMany.mockResolvedValue([store]);
    db.storeParticipantActor.findMany.mockResolvedValue([]);
    db.skill.findMany.mockResolvedValue([]);
    db.consumerProfile.findUnique.mockResolvedValue({
      organizationOid: 40n,
      personalConsumerGroup: { accessTagOid: 41n }
    });
    db.storeParticipantActor.upsert.mockImplementation(async ({ create }) => ({
      ...create,
      oid: 50n
    }));
    db.storeParticipantActor.create.mockImplementation(async ({ data }) => ({
      ...data,
      oid: 51n
    }));
    db.storeParticipantActor.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      storeOid: store.oid,
      resourceActorOid: consumerActor.oid,
      permissions: data.permissions
    }));
  });

  it('keeps the legacy computation when store-access-v2 is off', async () => {
    db.storeParticipantActor.findMany.mockResolvedValue([
      {
        id: 'stp_legacy',
        storeOid: store.oid,
        resourceActorOid: consumerActor.oid,
        permissions: [storeReadPermission]
      }
    ]);

    let result = await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization: consumerAuthorization,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid]
    });

    expect(result.accessibleStoreOids).toEqual([store.oid]);
    expect(getStoreResourceAccessWhereMock).not.toHaveBeenCalled();
  });

  it('resolves access through store grants when store-access-v2 is on', async () => {
    isStoreResourceFlagEnabledMock.mockResolvedValue(true);
    db.storeParticipantActor.findMany.mockResolvedValue([
      {
        id: 'stp_legacy',
        storeOid: store.oid,
        resourceActorOid: consumerActor.oid,
        permissions: [storeReadPermission]
      }
    ]);
    db.store.findMany.mockReset();
    db.store.findMany.mockResolvedValueOnce([store]).mockResolvedValueOnce([]);

    let result = await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization: consumerAuthorization,
      requiredPermission: storeWritePermission,
      storeOids: [store.oid]
    });

    expect(result.accessibleStoreOids).toEqual([]);
    expect(getStoreResourceAccessWhereMock).toHaveBeenCalledWith({
      accessTags,
      level: 'write'
    });
    expect(db.store.findMany.mock.calls[1]![0].where).toEqual({
      oid: { in: [store.oid] },
      AND: [{ marker: 'v2-access-where' }]
    });
    expect(db.storeParticipantActor.findMany).toHaveBeenCalled();
  });

  it('fills a participation-only row with default permissions', async () => {
    db.storeParticipantActor.findMany.mockResolvedValue([
      {
        id: 'stpa_1',
        storeOid: store.oid,
        resourceActorOid: consumerActor.oid,
        permissions: []
      }
    ]);

    await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization: consumerAuthorization,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid],
      defaultPermissions: [storeReadPermission]
    });

    expect(db.storeParticipantActor.update).toHaveBeenCalledWith({
      where: { id: 'stpa_1' },
      data: { permissions: [storeReadPermission] }
    });
  });

  it('leaves an existing legacy row alone when only defaults are given', async () => {
    db.storeParticipantActor.findMany.mockResolvedValue([
      {
        id: 'stp_1',
        storeOid: store.oid,
        resourceActorOid: consumerActor.oid,
        permissions: []
      }
    ]);

    await storeAccessService.resolveAccessibleStoreOids({
      ...scope,
      authorization: consumerAuthorization,
      requiredPermission: storeReadPermission,
      storeOids: [store.oid],
      defaultPermissions: [storeReadPermission]
    });

    expect(db.storeParticipantActor.update).not.toHaveBeenCalled();
    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });

  it('mirrors changed consumer permissions on standalone stores to the personal tag', async () => {
    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: consumerActor,
      permissions: [storeReadPermission, storeWritePermission]
    });

    expect(setAccessLevelMock).toHaveBeenCalledWith({
      store: { oid: store.oid, organizationOid: 40n },
      access: { kind: 'store' },
      accessTagOids: [41n],
      level: 'write'
    });
  });

  it('does not mirror skill stores or unchanged rows', async () => {
    db.store.findMany.mockResolvedValue([]);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: consumerActor,
      permissions: [storeReadPermission]
    });

    expect(setAccessLevelMock).not.toHaveBeenCalled();

    db.store.findMany.mockResolvedValue([store]);
    db.storeParticipantActor.findMany.mockResolvedValue([
      {
        id: 'stp_1',
        storeOid: store.oid,
        resourceActorOid: consumerActor.oid,
        permissions: [storeReadPermission]
      }
    ]);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: consumerActor,
      permissions: [storeReadPermission]
    });

    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });

  it('does not mirror organization actors', async () => {
    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: [storeReadPermission]
    });

    expect(db.consumerProfile.findUnique).not.toHaveBeenCalled();
    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });
});
