import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  getStoreResourceAccessWhereMock,
  getStoreResourceKindAccessWhereMock,
  hasOrganizationMemberSkillAccessMock,
  listAccessTagGrantsMock,
  setAccessLevelMock,
  recordParticipationMock
} = vi.hoisted(() => ({
  db: {
    store: { findMany: vi.fn() },
    storeParticipantActor: { findMany: vi.fn() },
    consumerProfile: { findUnique: vi.fn() }
  },
  getStoreResourceAccessWhereMock: vi.fn(),
  getStoreResourceKindAccessWhereMock: vi.fn(),
  hasOrganizationMemberSkillAccessMock: vi.fn(async () => false),
  listAccessTagGrantsMock: vi.fn(),
  setAccessLevelMock: vi.fn(),
  recordParticipationMock: vi.fn()
}));

vi.mock('../lib/storeResource', () => ({
  skillStoreResource: { hasAccess: vi.fn() }
}));

vi.mock('./storeParticipant', () => ({
  storeParticipantService: { recordParticipationSafely: recordParticipationMock }
}));

vi.mock('@metorial/db', () => ({
  withTransaction: vi.fn(async (fn: any) => await fn(db))
}));

vi.mock('@metorial/module-access', () => ({
  skillStoreResourceKind: { kind: 'skill' },
  standaloneStoreResourceAccess: { kind: 'store' },
  storeResourceAccessLevels: ['read', 'write', 'manage'],
  hasOrganizationMemberSkillAccess: hasOrganizationMemberSkillAccessMock,
  getStoreResourceKindAccessWhere: getStoreResourceKindAccessWhereMock,
  getStoreResourceAccessWhere: getStoreResourceAccessWhereMock,
  assertResourceAuthorizationScope: vi.fn(),
  storeAccessGrantService: {
    listAccessTagGrants: listAccessTagGrantsMock,
    setAccessLevel: setAccessLevelMock
  }
}));

import { storeAccessService, storeReadPermission, storeWritePermission } from './storeAccess';

let scope: any = {
  project: { oid: 6n, id: 'prj_1' },
  instance: { oid: 7n, id: 'ins_1' }
};
let accessTags = [{ accessTagOid: 5n }];
let organizationActor: any = { oid: 3n, id: 'rac_org', organizationActorOid: 9n };
let consumerActor: any = { oid: 30n, id: 'rac_consumer', consumerProfileOid: 31n };
let consumerAuthorization: any = {
  type: 'restricted',
  resourceActor: consumerActor,
  accessTags
};

type StoreRow = { oid: bigint; access: string; skill: { oid: bigint } | null };

let standaloneStore: StoreRow = { oid: 4n, access: 'private', skill: null };
let skillStore: StoreRow = { oid: 8n, access: 'private', skill: { oid: 80n } };

let mockStores = (d: { stores: StoreRow[]; accessible?: bigint[] }) => {
  db.store.findMany.mockImplementation(async ({ where }: any) => {
    let requested: bigint[] = where.oid.in;
    let rows = d.stores.filter(store => requested.includes(store.oid));

    if (where.AND) {
      return rows
        .filter(store => (d.accessible ?? []).includes(store.oid))
        .map(store => ({ oid: store.oid }));
    }
    if (where.skill)
      return rows.filter(store => !store.skill).map(store => ({ oid: store.oid }));
    return rows;
  });
};

let resolve = (d: { storeOids: bigint[]; requiredPermission?: any } & Record<string, any>) =>
  storeAccessService.resolveAccessibleStoreOids({
    ...scope,
    authorization: consumerAuthorization,
    requiredPermission: storeReadPermission,
    ...d
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockStores({ stores: [standaloneStore, skillStore] });
  db.storeParticipantActor.findMany.mockResolvedValue([]);
  db.consumerProfile.findUnique.mockResolvedValue({
    organizationOid: 40n,
    personalConsumerGroup: { accessTagOid: 41n }
  });
  listAccessTagGrantsMock.mockResolvedValue([]);
  getStoreResourceAccessWhereMock.mockResolvedValue({ marker: 'store-access-where' });
});

describe('store access resolution', () => {
  it('gives privileged actors every relevant store without writing grants', async () => {
    let result = await resolve({
      authorization: { type: 'privileged', resourceActor: organizationActor },
      requiredPermission: storeWritePermission,
      storeOids: [standaloneStore.oid, skillStore.oid],
      defaultPermissions: [storeReadPermission]
    });

    expect(result.accessibleStoreOids).toEqual([standaloneStore.oid, skillStore.oid]);
    expect(setAccessLevelMock).not.toHaveBeenCalled();
    expect(recordParticipationMock).not.toHaveBeenCalled();
  });

  it('resolves restricted access only through store grants', async () => {
    mockStores({ stores: [standaloneStore, skillStore], accessible: [skillStore.oid] });

    let result = await resolve({
      requiredPermission: storeWritePermission,
      storeOids: [standaloneStore.oid, skillStore.oid]
    });

    expect(result.relevantStoreOids).toEqual([standaloneStore.oid, skillStore.oid]);
    expect(result.accessibleStoreOids).toEqual([skillStore.oid]);
    expect(getStoreResourceAccessWhereMock).toHaveBeenCalledWith({
      accessTags,
      level: 'write'
    });
    expect(db.store.findMany).toHaveBeenCalledWith({
      where: {
        oid: { in: [standaloneStore.oid, skillStore.oid] },
        AND: [{ marker: 'store-access-where' }]
      },
      select: { oid: true }
    });
    expect(db.storeParticipantActor.findMany).not.toHaveBeenCalled();
    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });

  it('lets consumers with organization member access write skill stores they can read', async () => {
    hasOrganizationMemberSkillAccessMock.mockResolvedValueOnce(true);
    getStoreResourceKindAccessWhereMock.mockResolvedValueOnce({ marker: 'skill-read-where' });
    mockStores({ stores: [skillStore], accessible: [skillStore.oid] });

    let result = await resolve({
      requiredPermission: storeWritePermission,
      storeOids: [skillStore.oid]
    });

    expect(result.accessibleStoreOids).toEqual([skillStore.oid]);
    expect(getStoreResourceKindAccessWhereMock).toHaveBeenCalledWith({
      kind: { kind: 'skill' },
      accessTags,
      level: 'read'
    });
    expect(db.store.findMany).toHaveBeenCalledWith({
      where: {
        oid: { in: [skillStore.oid] },
        AND: [{ OR: [{ marker: 'store-access-where' }, { marker: 'skill-read-where' }] }]
      },
      select: { oid: true }
    });
  });

  it('returns nothing for restricted access without an actor', async () => {
    let result = await resolve({
      authorization: { type: 'restricted', accessTags },
      storeOids: [standaloneStore.oid]
    });

    expect(result.accessibleStoreOids).toEqual([]);
    expect(getStoreResourceAccessWhereMock).not.toHaveBeenCalled();
  });

  it('records participation on readable public stores but not on public skill stores', async () => {
    let publicStore = { ...standaloneStore, access: 'public_read' };
    let publicSkillStore = { ...skillStore, access: 'public_read' };
    mockStores({ stores: [publicStore, publicSkillStore], accessible: [publicStore.oid] });

    let result = await resolve({ storeOids: [publicStore.oid, publicSkillStore.oid] });

    expect(result.accessibleStoreOids).toEqual([publicStore.oid]);
    expect(recordParticipationMock).toHaveBeenCalledTimes(1);
    expect(recordParticipationMock).toHaveBeenCalledWith({
      store: { oid: publicStore.oid },
      actor: consumerActor
    });
    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });

  it('does not record participation on a public-read store for a write check', async () => {
    mockStores({ stores: [{ ...standaloneStore, access: 'public_read' }] });

    await resolve({
      requiredPermission: storeWritePermission,
      storeOids: [standaloneStore.oid]
    });

    expect(recordParticipationMock).not.toHaveBeenCalled();
  });
});

describe('store access defaults', () => {
  it('grants default permissions on the personal tag when the consumer has no grant', async () => {
    await resolve({
      storeOids: [standaloneStore.oid],
      defaultPermissions: [storeReadPermission]
    });

    expect(listAccessTagGrantsMock).toHaveBeenCalledWith({
      storeOids: [standaloneStore.oid],
      organizationOid: 40n,
      access: { kind: 'store' },
      accessTagOids: [41n]
    });
    expect(setAccessLevelMock).toHaveBeenCalledWith({
      store: { oid: standaloneStore.oid, organizationOid: 40n },
      access: { kind: 'store' },
      accessTagOids: [41n],
      level: 'read'
    });
    expect(recordParticipationMock).toHaveBeenCalledWith({
      store: { oid: standaloneStore.oid },
      actor: consumerActor
    });
  });

  it('keeps an existing grant when only defaults are given', async () => {
    listAccessTagGrantsMock.mockResolvedValue([
      { storeOid: standaloneStore.oid, accessTagOid: 41n, level: 'write' }
    ]);

    await resolve({
      storeOids: [standaloneStore.oid],
      defaultPermissions: [storeReadPermission]
    });

    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });

  it('replaces an existing grant when permissions are overridden', async () => {
    listAccessTagGrantsMock.mockResolvedValue([
      { storeOid: standaloneStore.oid, accessTagOid: 41n, level: 'write' }
    ]);

    await resolve({
      storeOids: [standaloneStore.oid],
      defaultPermissions: [storeReadPermission],
      overridePermissions: true
    });

    expect(setAccessLevelMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'read' })
    );
  });

  it('removes the grant when permissions are overridden with none', async () => {
    listAccessTagGrantsMock.mockResolvedValue([
      { storeOid: standaloneStore.oid, accessTagOid: 41n, level: 'read' }
    ]);

    await resolve({ storeOids: [standaloneStore.oid], overridePermissions: true });

    expect(setAccessLevelMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'none' })
    );
  });

  it('never writes grants for skill stores', async () => {
    await resolve({
      storeOids: [skillStore.oid],
      defaultPermissions: [storeReadPermission],
      overridePermissions: true
    });

    expect(db.store.findMany).toHaveBeenCalledWith({
      where: { oid: { in: [skillStore.oid] }, skill: { is: null } },
      select: { oid: true }
    });
    expect(listAccessTagGrantsMock).not.toHaveBeenCalled();
    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });
});

describe('ensureActorStorePermissions', () => {
  it('raises a consumer grant to write', async () => {
    listAccessTagGrantsMock.mockResolvedValue([
      { storeOid: standaloneStore.oid, accessTagOid: 41n, level: 'read' }
    ]);

    await storeAccessService.ensureActorStorePermissions({
      store: standaloneStore,
      actor: consumerActor,
      permissions: [storeReadPermission, storeWritePermission]
    });

    expect(setAccessLevelMock).toHaveBeenCalledWith({
      store: { oid: standaloneStore.oid, organizationOid: 40n },
      access: { kind: 'store' },
      accessTagOids: [41n],
      level: 'write'
    });
  });

  it('does not lower a consumer grant without an override', async () => {
    listAccessTagGrantsMock.mockResolvedValue([
      { storeOid: standaloneStore.oid, accessTagOid: 41n, level: 'write' }
    ]);

    await storeAccessService.ensureActorStorePermissions({
      store: standaloneStore,
      actor: consumerActor,
      permissions: [storeReadPermission]
    });

    expect(setAccessLevelMock).not.toHaveBeenCalled();
  });

  it('does not write grants for organization actors', async () => {
    await storeAccessService.ensureActorStorePermissions({
      store: standaloneStore,
      actor: organizationActor,
      permissions: [storeReadPermission]
    });

    expect(db.consumerProfile.findUnique).not.toHaveBeenCalled();
    expect(setAccessLevelMock).not.toHaveBeenCalled();
    expect(recordParticipationMock).toHaveBeenCalledWith({
      store: { oid: standaloneStore.oid },
      actor: organizationActor
    });
  });

  it('does not record participation again for a linked participant', async () => {
    db.storeParticipantActor.findMany.mockResolvedValue([{ storeOid: standaloneStore.oid }]);

    await storeAccessService.ensureActorStorePermissions({
      store: standaloneStore,
      actor: consumerActor,
      permissions: [storeReadPermission]
    });

    expect(db.storeParticipantActor.findMany).toHaveBeenCalledWith({
      where: {
        storeOid: { in: [standaloneStore.oid] },
        resourceActorOid: consumerActor.oid,
        storeParticipantOid: { not: null }
      },
      select: { storeOid: true }
    });
    expect(recordParticipationMock).not.toHaveBeenCalled();
  });
});
