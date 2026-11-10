import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ResourceActor, Store } from '@metorial/db';
import {
  createResourceAuthorization,
  type ResourceAuthorization
} from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import {
  storeAccessService,
  storeItemService,
  storeParticipantService,
  storeService,
  storeTemplateService,
  storeVersionService
} from '../src';
import {
  addFile,
  consumerAuthorization,
  consumerProfileAuthorization,
  createStore,
  modifyItems,
  scopeOf,
  storePaths
} from './_fixtures';

let participantRow = async (store: Pick<Store, 'oid'>, actor: ResourceActor) =>
  await db.storeParticipantActor.findUnique({
    where: {
      storeOid_resourceActorOid: { storeOid: store.oid, resourceActorOid: actor.oid }
    }
  });

let participantPermissionsOf = async (
  fixture: OrganizationFixture,
  store: Store,
  actor: ResourceActor
) => {
  let participants = await firstPage(
    await storeParticipantService.listStoreResourceParticipants({ ...scopeOf(fixture), store })
  );
  let participant = participants.find(item => item.primaryResourceActorOid == actor.oid);
  if (!participant) return undefined;

  let permissions = await storeParticipantService.findParticipantPermissions({
    store,
    participants: [participant]
  });
  return permissions.get(participant.oid);
};

let readStore = (
  fixture: OrganizationFixture,
  store: Store,
  authorization: ResourceAuthorization
) => storeService.getStoreById({ ...scopeOf(fixture), authorization, storeId: store.id });

let listItemIds = async (
  fixture: OrganizationFixture,
  store: Store,
  authorization: ResourceAuthorization
) =>
  (
    await firstPage(
      await storeItemService.listStoreItems({
        ...scopeOf(fixture),
        authorization,
        storeId: store.id
      })
    )
  ).map(item => item.id);

let listStoreIds = async (
  fixture: OrganizationFixture,
  authorization: ResourceAuthorization,
  ids: string[]
) =>
  (
    await firstPage(await storeService.listStores({ ...scopeOf(fixture), authorization, ids }))
  ).map(store => store.id);

describe('module-store access', () => {
  let org = useOrganization();
  let member = useMember(org);
  let otherOrg = useOrganization();

  it('denies restricted consumers every operation on a private store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let { item } = await addFile(fixture, store, 'secret.txt', { content: 'secret' });
    let { actor, authorization } = await consumerAuthorization(fixture);

    await expectServiceError(readStore(fixture, store, authorization), 'forbidden');
    expect(await listStoreIds(fixture, authorization, [store.id])).toEqual([]);
    await expectServiceError(
      storeItemService.getStoreItemById({
        ...scopeOf(fixture),
        authorization,
        itemId: item.id
      }),
      'forbidden'
    );
    expect(await listItemIds(fixture, store, authorization)).toEqual([]);
    await expectServiceError(
      storeVersionService.listStoreVersions({
        ...scopeOf(fixture),
        authorization,
        storeId: store.id
      }),
      'forbidden'
    );
    await expectServiceError(
      storeVersionService.getResolvedStoreVersion({
        ...scopeOf(fixture),
        authorization,
        storeId: store.id,
        storeVersionId: 'latest'
      }),
      'forbidden'
    );
    await expectServiceError(
      storeService.cloneStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization,
        store,
        input: { name: uniqueId('stolen') }
      }),
      'forbidden'
    );

    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'add', path: 'intruder' }], authorization),
      'forbidden'
    );
    await expectServiceError(
      storeService.updateStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization,
        store,
        input: { access: 'public_write' }
      }),
      'forbidden'
    );
    await expectServiceError(
      storeService.deleteStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization,
        store
      }),
      'forbidden'
    );

    let permissions = await storeService.getStorePermissions({
      ...scopeOf(fixture),
      authorization,
      store
    });
    expect(permissions).toMatchObject({
      actorId: actor.id,
      hasFullAccess: false,
      permissions: [],
      readableStoreIds: [],
      writableStoreIds: []
    });

    let row = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(row.access).toBe('private');
    expect(await storePaths(store.id)).toEqual(['/', '/secret.txt']);
    expect(await participantRow(store, actor)).toBeNull();
  });

  it('lets consumers read but not write a public_read store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture, { access: 'public_read' });
    let { item } = await addFile(fixture, store, 'shared.txt', { content: 'shared' });
    let { actor, authorization } = await consumerAuthorization(fixture);

    expect((await readStore(fixture, store, authorization)).id).toBe(store.id);
    expect(await listStoreIds(fixture, authorization, [store.id])).toEqual([store.id]);
    expect(await listItemIds(fixture, store, authorization)).toEqual([item.id]);

    let fetched = await storeItemService.getStoreItemById({
      ...scopeOf(fixture),
      authorization,
      itemId: item.id
    });
    expect(fetched.path).toBe('/shared.txt');

    let latest = await storeVersionService.getResolvedStoreVersion({
      ...scopeOf(fixture),
      authorization,
      storeId: store.id,
      storeVersionId: 'latest'
    });
    expect(latest.items.map(entry => entry.path)).toContain('/shared.txt');

    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'remove', itemId: item.id }], authorization),
      'forbidden'
    );
    expect(await storePaths(store.id)).toEqual(['/', '/shared.txt']);

    let permissions = await storeService.getStorePermissions({
      ...scopeOf(fixture),
      authorization,
      store
    });
    expect(permissions).toMatchObject({
      hasFullAccess: false,
      permissions: ['content_read'],
      readableStoreIds: [store.id],
      writableStoreIds: []
    });
    expect(await participantRow(store, actor)).not.toBeNull();
  });

  it('lets consumers write a public_write store and attributes their edits', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture, { access: 'public_write' });
    let { actor, authorization } = await consumerAuthorization(fixture);

    let [result] = await storeService.modifyStoreItems({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization,
      actor,
      store,
      operations: [{ type: 'add', path: 'consumer-dir' }]
    });
    expect(result!.item).toMatchObject({
      path: '/consumer-dir/',
      lastModifiedByResourceActorOid: actor.oid
    });

    let permissions = await storeService.getStorePermissions({
      ...scopeOf(fixture),
      authorization,
      store
    });
    expect(permissions).toMatchObject({
      hasFullAccess: true,
      permissions: ['content_read', 'content_write'],
      writableStoreIds: [store.id]
    });
    expect(await participantRow(store, actor)).not.toBeNull();
  });

  it('rejects resource actors that belong to another project', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let foreign = await consumerAuthorization(other);
    let store = await createStore(fixture, { access: 'public_write' });
    let name = uniqueId('foreign-actor-store');

    await expectServiceError(
      createStore(fixture, { name, actor: foreign.actor }),
      'bad_request'
    );
    expect(await db.store.count({ where: { name } })).toBe(0);

    await expectServiceError(readStore(fixture, store, foreign.authorization), 'bad_request');
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'add', path: 'foreign' }], foreign.authorization),
      'bad_request'
    );

    let template = await storeTemplateService.createStoreTemplate({
      ...scopeOf(fixture),
      input: { name: uniqueId('template'), items: [] }
    });
    await expectServiceError(
      storeService.createStoreFromTemplate({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: createResourceAuthorization({ restricted: false }),
        input: { templateId: template.id, name, actor: foreign.actor }
      }),
      'bad_request'
    );
    expect(await db.store.count({ where: { name } })).toBe(0);

    expect(await storePaths(store.id)).toEqual(['/']);
    expect(await participantRow(store, foreign.actor)).toBeNull();
  });

  it('attributes member edits to the member resource actor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let memberFixture = await loadOrganizationFixture({ ...org.ids, userId: member.user.id });
    expect(memberFixture.member.id).not.toBe(fixture.member.id);

    let memberActor = await resourceActorService.ensureOrganizationActor({
      project: memberFixture.project,
      organizationActorOid: memberFixture.member.actor.oid
    });
    let authorization = createResourceAuthorization({
      restricted: false,
      resourceActor: memberActor
    });

    let store = await createStore(memberFixture, { actor: memberActor });
    let file = await addFile(fixture, store, 'owner.txt', { content: 'by owner' });
    let [result] = await storeService.modifyStoreItems({
      ...scopeOf(memberFixture),
      auditScope: memberFixture.auditScope,
      authorization,
      actor: memberActor,
      store,
      operations: [{ type: 'add', path: 'member-dir' }]
    });

    expect(result!.item.lastModifiedByResourceActorOid).toBe(memberActor.oid);

    let byMember = await firstPage(
      await storeItemService.listStoreItems({
        ...scopeOf(fixture),
        authorization,
        storeId: store.id,
        types: ['file', 'document', 'directory'],
        lastModifiedByActorIds: [memberActor.id]
      })
    );
    expect(byMember.map(item => item.id)).toEqual([result!.item.id]);
    expect(byMember.map(item => item.id)).not.toContain(file.item.id);

    let row = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(row.createdByResourceActorOid).toBe(memberActor.oid);
  });

  it('revokes public access once a store becomes private again', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture, { access: 'public_read' });
    let { actor, authorization } = await consumerAuthorization(fixture);

    await readStore(fixture, store, authorization);
    expect(await participantRow(store, actor)).not.toBeNull();

    let privateStore = await storeService.updateStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: createResourceAuthorization({ restricted: false }),
      store,
      input: { access: 'private' }
    });
    expect(privateStore.access).toBe('private');

    await expectServiceError(readStore(fixture, privateStore, authorization), 'forbidden');
  });
});

describe('module-store consumer store grants', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('grants, widens and revokes access through the personal access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let store = await createStore(fixture);
    let { actor, authorization } = await consumerProfileAuthorization(fixture);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: ['content_read']
    });
    expect((await readStore(fixture, store, authorization)).id).toBe(store.id);
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'add', path: 'dir' }], authorization),
      'forbidden'
    );
    expect(await participantPermissionsOf(fixture, store, actor)).toEqual(['content_read']);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: ['content_write']
    });
    expect(await participantPermissionsOf(fixture, store, actor)).toEqual([
      'content_read',
      'content_write'
    ]);
    await modifyItems(fixture, store, [{ type: 'add', path: 'dir' }], authorization);
    expect(await storePaths(store.id)).toEqual(['/', '/dir/']);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: ['content_read']
    });
    expect(await participantPermissionsOf(fixture, store, actor)).toEqual([
      'content_read',
      'content_write'
    ]);

    let participants = await firstPage(
      await storeParticipantService.listStoreResourceParticipants({
        ...scopeOf(fixture),
        store
      })
    );
    expect(participants.map(participant => participant.primaryResourceActor.id)).toEqual([
      actor.id
    ]);
    let participant = await storeParticipantService.getStoreResourceParticipantById({
      ...scopeOf(fixture),
      store,
      participantId: participants[0]!.id
    });
    expect(participant).toMatchObject({
      storeOid: store.oid,
      primaryResourceActorOid: actor.oid
    });
    await expectServiceError(
      storeParticipantService.getStoreResourceParticipantById({
        ...scopeOf(other),
        store,
        participantId: participants[0]!.id
      }),
      'not_found'
    );

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: [],
      overridePermissions: true
    });
    expect(await participantPermissionsOf(fixture, store, actor)).toEqual([]);
    await expectServiceError(readStore(fixture, store, authorization), 'forbidden');
    expect(await participantRow(store, actor)).not.toBeNull();
    expect(
      await db.storeParticipantActor.count({
        where: { storeOid: store.oid, resourceActorOid: actor.oid }
      })
    ).toBe(1);
  });

  it('gives the creating consumer full access to its private store and nobody else', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let creator = await consumerProfileAuthorization(fixture);
    let stranger = await consumerProfileAuthorization(fixture);

    let store = await createStore(fixture, { actor: creator.actor });

    expect(store).toMatchObject({
      access: 'private',
      createdByResourceActorOid: creator.actor.oid
    });
    expect(await participantPermissionsOf(fixture, store, creator.actor)).toEqual([
      'content_read',
      'content_write'
    ]);
    expect((await participantRow(store, creator.actor))?.roles).toEqual(['creator']);

    await modifyItems(fixture, store, [{ type: 'add', path: 'mine' }], creator.authorization);
    expect((await readStore(fixture, store, creator.authorization)).id).toBe(store.id);

    await expectServiceError(readStore(fixture, store, stranger.authorization), 'forbidden');
    expect(await listStoreIds(fixture, stranger.authorization, [store.id])).toEqual([]);
    expect(await participantPermissionsOf(fixture, store, stranger.actor)).toBeUndefined();

    let createdBy = await firstPage(
      await storeService.listStores({
        ...scopeOf(fixture),
        authorization: createResourceAuthorization({ restricted: false }),
        createdByActorIds: [creator.actor.id]
      })
    );
    expect(createdBy.map(item => item.id)).toEqual([store.id]);
  });

  it('applies default permissions once and keeps an existing grant', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let { actor, authorization } = await consumerProfileAuthorization(fixture);

    await storeAccessService.assertStoreAccessForStore({
      ...scopeOf(fixture),
      authorization,
      store,
      requiredPermission: 'content_read',
      defaultPermissions: ['content_read']
    });
    expect(await participantPermissionsOf(fixture, store, actor)).toEqual(['content_read']);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor,
      permissions: ['content_read', 'content_write']
    });
    await storeAccessService.assertStoreAccessForStore({
      ...scopeOf(fixture),
      authorization,
      store,
      requiredPermission: 'content_write',
      defaultPermissions: ['content_read']
    });
    expect(await participantPermissionsOf(fixture, store, actor)).toEqual([
      'content_read',
      'content_write'
    ]);
  });

  it('reports organization actors as having full permissions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let memberActor = await resourceActorService.ensureOrganizationActor({
      project: fixture.project,
      organizationActorOid: fixture.member.actor.oid
    });
    let store = await createStore(fixture, { actor: memberActor });

    expect(await participantPermissionsOf(fixture, store, memberActor)).toEqual([
      'content_read',
      'content_write'
    ]);
  });
});
