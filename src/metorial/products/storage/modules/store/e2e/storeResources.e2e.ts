import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ResourceActor, Store } from '@metorial/db';
import {
  accessTagService,
  consumerSkillManageAccessRoles,
  consumerStoreManageAccessRoles,
  consumerStoreReadRoles,
  consumerStoreWriteRoles,
  getStoreResourceAccessWhere,
  type ResourceAuthorization,
  type RestrictedResourceActor,
  standaloneStoreResourceAccess,
  storeAccessGrantService,
  type StoreResourceAccessDefinition
} from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import {
  defineStoreResource,
  storeAccessService,
  storeParticipantBackfillSingleQueue,
  storeParticipantService,
  storeService
} from '../src';
import { consumerAuthorization, createStore, scopeOf } from './_fixtures';

let createActor = async (fixture: OrganizationFixture) =>
  await resourceActorService.upsertActor({
    project: fixture.project,
    input: {
      identifier: uniqueId('e2e-store-resource-actor'),
      name: 'E2E store resource actor'
    }
  });

let actorRow = async (store: Pick<Store, 'oid'>, actor: Pick<ResourceActor, 'oid'>) =>
  await db.storeParticipantActor.findUnique({
    where: { storeOid_resourceActorOid: { storeOid: store.oid, resourceActorOid: actor.oid } }
  });

let participantsOf = async (store: Pick<Store, 'oid'>) =>
  await db.storeParticipant.findMany({
    where: { storeOid: store.oid },
    include: { actors: { orderBy: { oid: 'asc' } } },
    orderBy: { oid: 'asc' }
  });

let legacyParticipantActorIds = async (fixture: OrganizationFixture, store: Store) =>
  (
    await firstPage(
      await storeParticipantService.listStoreParticipants({
        ...scopeOf(fixture),
        storeIds: [store.id]
      })
    )
  )
    .map(participant => participant.resourceActor.id)
    .sort();

let canRead = async (
  fixture: OrganizationFixture,
  store: Store,
  authorization: ResourceAuthorization
) => {
  try {
    await storeService.getStoreById({ ...scopeOf(fixture), authorization, storeId: store.id });
    return true;
  } catch (error: any) {
    if (error?.data?.code == 'forbidden') return false;
    throw error;
  }
};

describe('module-store store participants', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('records one participant per actor next to the legacy permission row', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let creator = await createActor(fixture);

    let store = await createStore(fixture, { actor: creator });

    let [participant, ...rest] = await participantsOf(store);
    expect(rest).toEqual([]);
    expect(participant).toMatchObject({
      primaryResourceActorOid: creator.oid,
      consumerOid: null,
      roles: ['creator']
    });
    expect(participant!.lastActiveAt).not.toBeNull();
    expect(participant!.actors.map(row => row.resourceActorOid)).toEqual([creator.oid]);

    let row = await actorRow(store, creator);
    expect(row).toMatchObject({
      storeParticipantOid: participant!.oid,
      roles: ['creator']
    });
    expect(row!.permissions.sort()).toEqual(['content_read', 'content_write']);
    expect(await legacyParticipantActorIds(fixture, store)).toEqual([creator.id]);
  });

  it('keeps participation-only rows out of legacy participants and permissions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let viewer = await consumerAuthorization(fixture);

    await storeParticipantService.recordParticipation({
      store,
      actor: viewer.actor,
      roles: ['viewer']
    });

    let row = await actorRow(store, viewer.actor);
    expect(row!.id.startsWith('stpa_')).toBe(true);
    expect(row!.permissions).toEqual([]);
    expect(await legacyParticipantActorIds(fixture, store)).toEqual([]);
    await expectServiceError(
      storeParticipantService.getStoreParticipantById({
        ...scopeOf(fixture),
        storeParticipantId: row!.id
      }),
      'not_found'
    );
    expect(await canRead(fixture, store, viewer.authorization)).toBe(false);

    let participants = await firstPage(
      await storeParticipantService.listStoreResourceParticipants({
        ...scopeOf(fixture),
        store
      })
    );
    expect(participants.map(participant => participant.primaryResourceActor.id)).toEqual([
      viewer.actor.id
    ]);
    expect(participants[0]!.roles).toEqual(['viewer']);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: viewer.actor,
      permissions: ['content_read']
    });

    let granted = await actorRow(store, viewer.actor);
    expect(granted).toMatchObject({ id: row!.id, permissions: ['content_read'] });
    expect(await legacyParticipantActorIds(fixture, store)).toEqual([viewer.actor.id]);
  });

  it('merges roles, keeps the earliest creation and never moves activity backwards', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let actor = await createActor(fixture);
    let recent = new Date();
    let older = new Date(recent.getTime() - 86_400_000);

    await storeParticipantService.recordParticipation({
      store,
      actor,
      roles: ['viewer'],
      activeAt: recent
    });
    await storeParticipantService.recordParticipation({
      store,
      actor,
      roles: ['editor'],
      activeAt: older,
      createdAt: older
    });

    let [participant, ...rest] = await participantsOf(store);
    expect(rest).toEqual([]);
    expect(participant!.roles).toEqual(['editor', 'viewer']);
    expect(participant!.lastActiveAt).toEqual(recent);
    expect(participant!.createdAt).toEqual(older);
    expect(participant!.actors).toHaveLength(1);
    expect(participant!.actors[0]).toMatchObject({
      roles: ['editor', 'viewer'],
      lastActiveAt: recent
    });
  });

  it('returns deduplicated participants only for the requested store and tenant', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let actor = await createActor(fixture);
    let store = await createStore(fixture, { actor });
    let otherStore = await createStore(fixture);

    let [participant] = await firstPage(
      await storeParticipantService.listStoreResourceParticipants({
        ...scopeOf(fixture),
        store
      })
    );

    let byParticipantId = await storeParticipantService.getStoreResourceParticipantById({
      ...scopeOf(fixture),
      store,
      participantId: participant!.id
    });
    expect(byParticipantId.id).toBe(participant!.id);

    let row = await actorRow(store, actor);
    let byActorRowId = await storeParticipantService.getStoreResourceParticipantById({
      ...scopeOf(fixture),
      store,
      participantId: row!.id
    });
    expect(byActorRowId.id).toBe(participant!.id);

    await expectServiceError(
      storeParticipantService.getStoreResourceParticipantById({
        ...scopeOf(fixture),
        store: otherStore,
        participantId: participant!.id
      }),
      'not_found'
    );
    await expectServiceError(
      storeParticipantService.getStoreResourceParticipantById({
        ...scopeOf(other),
        store,
        participantId: participant!.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await storeParticipantService.listStoreResourceParticipants({
          ...scopeOf(fixture),
          store: otherStore
        })
      )
    ).toEqual([]);
  });

  it('backfills participants for legacy permission rows through the backfill queue', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let creator = await createActor(fixture);
    let reader = await createActor(fixture);
    let store = await createStore(fixture, { actor: creator });
    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: reader,
      permissions: ['content_read']
    });

    let lastActiveAt = new Date(Date.now() - 3_600_000);
    await db.storeParticipantActor.updateMany({
      where: { storeOid: store.oid },
      data: { storeParticipantOid: null, lastActiveAt }
    });
    await db.storeParticipant.deleteMany({ where: { storeOid: store.oid } });

    let legacyRows = await db.storeParticipantActor.findMany({
      where: { storeOid: store.oid }
    });
    expect(legacyRows).toHaveLength(2);

    for (let row of legacyRows) {
      await storeParticipantBackfillSingleQueue.add({ storeParticipantActorId: row.id });
    }

    await eventually(async () => {
      let rows = await db.storeParticipantActor.findMany({ where: { storeOid: store.oid } });
      expect(rows.every(row => row.storeParticipantOid != null)).toBe(true);
    });

    let participants = await participantsOf(store);
    expect(
      participants.map(participant => participant.primaryResourceActorOid).sort()
    ).toEqual([creator.oid, reader.oid].sort());
    let creatorParticipant = participants.find(
      participant => participant.primaryResourceActorOid == creator.oid
    );
    expect(creatorParticipant).toMatchObject({ roles: ['creator'], lastActiveAt });

    for (let row of legacyRows) {
      await storeParticipantService.recordParticipation({
        store,
        actor: { oid: row.resourceActorOid },
        roles: row.roles,
        activeAt: lastActiveAt,
        createdAt: row.createdAt
      });
    }
    let rerun = await participantsOf(store);
    expect(rerun.map(participant => participant.oid)).toEqual(
      participants.map(participant => participant.oid)
    );
    expect(
      rerun.find(participant => participant.oid == creatorParticipant!.oid)
    ).toMatchObject({
      roles: ['creator'],
      lastActiveAt
    });
    expect(await legacyParticipantActorIds(fixture, store)).toEqual(
      [creator.id, reader.id].sort()
    );
  });
});

describe('module-store store resource framework', () => {
  let org = useOrganization();

  let workspaceAccess = (kind: string): StoreResourceAccessDefinition => ({
    kind,
    policies: {
      read: {
        name: 'E2E Workspace Read',
        systemIdentifier: `${kind}_read`,
        roles: [...consumerStoreReadRoles]
      },
      write: {
        name: 'E2E Workspace Write',
        systemIdentifier: `${kind}_write`,
        roles: [...consumerStoreWriteRoles]
      },
      manage: {
        name: 'E2E Workspace Manage',
        systemIdentifier: `${kind}_manage`,
        roles: [...consumerSkillManageAccessRoles]
      }
    }
  });

  let defineWorkspace = () => {
    let kind = uniqueId('e2e_workspace').replace(/-/g, '_');
    let namePrefix = `${kind}:`;

    return {
      namePrefix,
      workspace: defineStoreResource({
        kind,
        access: workspaceAccess(kind),
        storeWhere: { name: { startsWith: namePrefix } }
      })
    };
  };

  let restrictedFor = async (fixture: OrganizationFixture) => {
    let accessTag = await accessTagService.createAccessTag({ instance: fixture.instance });
    let actor = await createActor(fixture);
    let authorization: ResourceAuthorization = {
      type: 'restricted',
      resourceActor: actor as RestrictedResourceActor,
      accessTags: [{ accessTagOid: accessTag.oid }]
    };

    return { accessTag, actor, authorization };
  };

  let levels = async (
    workspace: ReturnType<typeof defineStoreResource>,
    store: Store,
    authorization: ResourceAuthorization
  ) => {
    let granted: string[] = [];
    for (let level of ['read', 'write', 'manage'] as const) {
      if (await workspace.hasAccess({ store, authorization, level })) granted.push(level);
    }
    return granted;
  };

  it('grants, widens, narrows and revokes access per access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { namePrefix, workspace } = defineWorkspace();

    try {
      let store = await createStore(fixture, { name: `${namePrefix}${uniqueId('ws')}` });
      let alice = await restrictedFor(fixture);
      let bob = await restrictedFor(fixture);

      expect(await levels(workspace, store, alice.authorization)).toEqual([]);
      expect(
        await workspace.hasAccess({
          store,
          authorization: { type: 'privileged' },
          level: 'manage'
        })
      ).toBe(true);
      await expectServiceError(
        workspace.assertAccess({ store, authorization: alice.authorization, level: 'read' }),
        'forbidden'
      );

      await workspace.setAccessLevel({
        store,
        accessTagOids: [alice.accessTag.oid],
        level: 'write'
      });
      await workspace.grantAccessLevel({
        store,
        accessTagOids: [bob.accessTag.oid],
        level: 'read'
      });

      expect(await levels(workspace, store, alice.authorization)).toEqual(['read', 'write']);
      expect(await levels(workspace, store, bob.authorization)).toEqual(['read']);
      expect(
        (await workspace.listGrants({ store }))
          .map(grant => [grant.accessTagOid, grant.level])
          .sort()
      ).toEqual(
        [
          [alice.accessTag.oid, 'write'],
          [bob.accessTag.oid, 'read']
        ].sort()
      );

      await workspace.grantAccessLevel({
        store,
        accessTagOids: [bob.accessTag.oid],
        level: 'read'
      });
      await workspace.setAccessLevel({
        store,
        accessTagOids: [alice.accessTag.oid],
        level: 'manage'
      });
      expect(await levels(workspace, store, alice.authorization)).toEqual([
        'read',
        'write',
        'manage'
      ]);
      expect(
        await db.accessTagEntity.count({
          where: { storeOid: store.oid, accessTagOid: bob.accessTag.oid }
        })
      ).toBe(1);

      await workspace.setAccessLevel({
        store,
        accessTagOids: [alice.accessTag.oid],
        level: 'read'
      });
      expect(await levels(workspace, store, alice.authorization)).toEqual(['read']);

      await workspace.setAccessLevel({
        store,
        accessTagOids: [alice.accessTag.oid, bob.accessTag.oid],
        level: 'none'
      });
      expect(await levels(workspace, store, alice.authorization)).toEqual([]);
      expect(await levels(workspace, store, bob.authorization)).toEqual([]);
      expect(await workspace.listGrants({ store })).toEqual([]);
      expect(await db.accessTagEntity.count({ where: { storeOid: store.oid } })).toBe(0);
    } finally {
      workspace.unregister();
    }
  });

  it('rejects kinds whose access levels share a role', () => {
    let kind = uniqueId('e2e_overlap').replace(/-/g, '_');
    let access = workspaceAccess(kind);

    expect(() =>
      defineStoreResource({
        kind,
        access: {
          ...access,
          policies: {
            ...access.policies,
            manage: { ...access.policies.manage, roles: [...consumerStoreWriteRoles] }
          }
        },
        storeWhere: { name: { startsWith: `${kind}:` } }
      })
    ).toThrow(/consumer#instance.store:write/);
  });

  it('scopes grants to stores of its kind and keeps public access out of the kind', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { namePrefix, workspace } = defineWorkspace();

    try {
      let workspaceStore = await createStore(fixture, {
        name: `${namePrefix}${uniqueId('ws')}`,
        access: 'public_read'
      });
      let plainStore = await createStore(fixture, { access: 'public_read' });
      let alice = await restrictedFor(fixture);

      let readable = async () =>
        (
          await db.store.findMany({
            where: {
              oid: { in: [workspaceStore.oid, plainStore.oid] },
              AND: [
                await getStoreResourceAccessWhere({
                  accessTags: [{ accessTagOid: alice.accessTag.oid }],
                  level: 'read'
                })
              ]
            },
            select: { id: true }
          })
        )
          .map(store => store.id)
          .sort();

      expect(await readable()).toEqual([plainStore.id]);
      expect(await levels(workspace, plainStore, alice.authorization)).toEqual([]);

      await workspace.setAccessLevel({
        store: workspaceStore,
        accessTagOids: [alice.accessTag.oid],
        level: 'read'
      });
      await workspace.setAccessLevel({
        store: plainStore,
        accessTagOids: [alice.accessTag.oid],
        level: 'write'
      });

      expect(await readable()).toEqual([plainStore.id, workspaceStore.id].sort());
      expect(await levels(workspace, workspaceStore, alice.authorization)).toEqual(['read']);
      expect(await levels(workspace, plainStore, alice.authorization)).toEqual([]);

      workspace.unregister();

      await workspace.setAccessLevel({
        store: workspaceStore,
        accessTagOids: [alice.accessTag.oid],
        level: 'none'
      });
      expect(await readable()).toEqual([plainStore.id, workspaceStore.id].sort());
    } finally {
      workspace.unregister();
    }
  });

  it('records and returns participants through the resource', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { namePrefix, workspace } = defineWorkspace();

    try {
      let store = await createStore(fixture, { name: `${namePrefix}${uniqueId('ws')}` });
      let actor = await createActor(fixture);

      await workspace.participants.record({ store, actor, roles: ['editor'] });
      await workspace.participants.record({ store, actor, roles: ['viewer'] });

      let participants = await firstPage(
        await workspace.participants.list({ ...scopeOf(fixture), store })
      );
      expect(participants).toHaveLength(1);
      expect(participants[0]).toMatchObject({
        roles: ['editor', 'viewer'],
        primaryResourceActor: { id: actor.id }
      });

      let participant = await workspace.participants.get({
        ...scopeOf(fixture),
        store,
        participantId: participants[0]!.id
      });
      expect(participant.actors.map(row => row.resourceActor.id)).toEqual([actor.id]);
    } finally {
      workspace.unregister();
    }
  });
});

describe('module-store standalone store grants', () => {
  let org = useOrganization();

  let levelsOf = async (store: Store, accessTagOid: bigint) => {
    let granted: string[] = [];

    for (let level of ['read', 'write', 'manage'] as const) {
      let where = await getStoreResourceAccessWhere({ accessTags: [{ accessTagOid }], level });
      let match = await db.store.findFirst({
        where: { oid: store.oid, AND: [where] },
        select: { oid: true }
      });
      if (match) granted.push(level);
    }

    return granted;
  };

  let grant = async (
    fixture: OrganizationFixture,
    store: Store,
    accessTagOid: bigint,
    level: 'read' | 'write' | 'manage' | 'none'
  ) =>
    await storeAccessGrantService.setAccessLevel({
      store: { oid: store.oid, organizationOid: fixture.project.organizationOid },
      access: standaloneStoreResourceAccess,
      accessTagOids: [accessTagOid],
      level
    });

  it('does not treat write access as manage access', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let accessTag = await accessTagService.createAccessTag({ instance: fixture.instance });

    expect(await levelsOf(store, accessTag.oid)).toEqual([]);

    await grant(fixture, store, accessTag.oid, 'read');
    expect(await levelsOf(store, accessTag.oid)).toEqual(['read']);

    await grant(fixture, store, accessTag.oid, 'write');
    expect(await levelsOf(store, accessTag.oid)).toEqual(['read', 'write']);

    await grant(fixture, store, accessTag.oid, 'manage');
    expect(await levelsOf(store, accessTag.oid)).toEqual(['read', 'write', 'manage']);

    await grant(fixture, store, accessTag.oid, 'write');
    expect(await levelsOf(store, accessTag.oid)).toEqual(['read', 'write']);

    await grant(fixture, store, accessTag.oid, 'none');
    expect(await levelsOf(store, accessTag.oid)).toEqual([]);
  });

  it('gives each level its own roles', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let accessTag = await accessTagService.createAccessTag({ instance: fixture.instance });

    await grant(fixture, store, accessTag.oid, 'manage');

    let policies = await db.accessTagPolicy.findMany({
      where: {
        organizationOid: fixture.project.organizationOid,
        systemIdentifier: {
          in: ['consumer_store_read', 'consumer_store_write', 'consumer_store_manage_access']
        }
      }
    });

    expect(
      Object.fromEntries(policies.map(policy => [policy.systemIdentifier, policy.roles]))
    ).toEqual({
      consumer_store_read: [...consumerStoreReadRoles],
      consumer_store_write: [...consumerStoreWriteRoles],
      consumer_store_manage_access: [...consumerStoreManageAccessRoles]
    });
  });

  it('repairs a manage policy that was created with the write roles', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let writer = await accessTagService.createAccessTag({ instance: fixture.instance });
    let manager = await accessTagService.createAccessTag({ instance: fixture.instance });

    await grant(fixture, store, manager.oid, 'manage');
    await db.accessTagPolicy.updateMany({
      where: {
        organizationOid: fixture.project.organizationOid,
        systemIdentifier: 'consumer_store_manage_access'
      },
      data: { roles: [...consumerStoreWriteRoles] }
    });

    await grant(fixture, store, writer.oid, 'write');

    let repaired = await db.accessTagPolicy.findFirstOrThrow({
      where: {
        organizationOid: fixture.project.organizationOid,
        systemIdentifier: 'consumer_store_manage_access'
      }
    });
    expect(repaired.roles).toEqual([...consumerStoreManageAccessRoles]);
    expect(await levelsOf(store, writer.oid)).toEqual(['read', 'write']);
    expect(await levelsOf(store, manager.oid)).toEqual(['read', 'write', 'manage']);
  });
});
