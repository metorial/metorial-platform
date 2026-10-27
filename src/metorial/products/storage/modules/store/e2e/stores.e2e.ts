import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import {
  storeItemService,
  storeParticipantService,
  storeService,
  storeTemplateService,
  storeVersionService
} from '../src';
import {
  addFile,
  captureFabric,
  createStore,
  expectConsistentItemCount,
  modifyItems,
  privileged,
  scopeOf,
  storePaths
} from './_fixtures';

describe('module-store stores', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a store with a root directory and persists its defaults', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('store');

    let store = await createStore(fixture, { name });

    let row = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(row).toMatchObject({
      name,
      access: 'private',
      cloneType: null,
      itemCount: 1,
      isReadOnly: false,
      isTemplateBacking: false,
      dirtyAt: null,
      parentStoreOid: null,
      parentStoreTemplateOid: null,
      createdByResourceActorOid: null,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid
    });
    expect(await storePaths(store.id)).toEqual(['/']);
    expect(await db.storeDirectory.count({ where: { storeOid: row.oid, path: '/' } })).toBe(1);
  });

  it('honors a requested access level and custom id', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let id = await ID.generateId('store');

    let store = await storeService.createStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      input: { id, name: uniqueId('store'), access: 'public_write' }
    });

    expect(store).toMatchObject({ id, access: 'public_write' });
  });

  it('rejects a clone type for a store that is not a clone', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('store');

    await expectServiceError(
      storeService.createStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        input: { name, cloneType: 'duplicate' }
      }),
      'bad_request'
    );
    expect(await db.store.count({ where: { name } })).toBe(0);
  });

  it('gets and lists stores, filtered by id', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createStore(fixture);
    let second = await createStore(fixture);

    let fetched = await storeService.getStoreById({
      ...scopeOf(fixture),
      authorization: privileged,
      storeId: first.id
    });
    expect(fetched.id).toBe(first.id);

    let filtered = await firstPage(
      await storeService.listStores({
        ...scopeOf(fixture),
        authorization: privileged,
        ids: [first.id]
      })
    );
    expect(filtered.map(store => store.id)).toEqual([first.id]);

    let all = await firstPage(
      await storeService.listStores({ ...scopeOf(fixture), authorization: privileged })
    );
    expect(all.map(store => store.id)).toEqual(expect.arrayContaining([first.id, second.id]));

    let none = await firstPage(
      await storeService.listStores({
        ...scopeOf(fixture),
        authorization: privileged,
        ids: []
      })
    );
    expect(none).toEqual([]);

    await expectServiceError(
      storeService.getStoreById({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: 'store_does_not_exist'
      }),
      'not_found'
    );
  });

  it('updates name and access, bumps lastEditedAt and fires store.updated:after', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let updatedEvents = captureFabric('store.updated:after');
    let renamed = uniqueId('renamed');

    try {
      let updated = await storeService.updateStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        store,
        input: { name: renamed, access: 'public_read' }
      });
      expect(updated).toMatchObject({ name: renamed, access: 'public_read' });
    } finally {
      updatedEvents.stop();
    }

    let row = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(row).toMatchObject({ name: renamed, access: 'public_read' });
    expect(row.lastEditedAt.getTime()).toBeGreaterThanOrEqual(store.lastEditedAt.getTime());

    let event = updatedEvents.events.find(event => event.store.id === store.id);
    expect(event?.previousStore.name).toBe(store.name);
    expect(event?.store.name).toBe(renamed);
    expect(event?.auditScope).toBe(fixture.auditScope);
  });

  it('rejects an update without fields', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    await expectServiceError(
      storeService.updateStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        store,
        input: {}
      }),
      'bad_request'
    );
  });

  it('fires store.created:after and store.deleted:after', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = captureFabric('store.created:after');
    let deleted = captureFabric('store.deleted:after');

    try {
      let store = await createStore(fixture);
      await storeService.deleteStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        store
      });

      expect(created.events.filter(event => event.store.id === store.id)).toHaveLength(1);
      expect(deleted.events.filter(event => event.store.id === store.id)).toHaveLength(1);
      expect(created.events.find(event => event.store.id === store.id)?.store.itemCount).toBe(
        1
      );
    } finally {
      created.stop();
      deleted.stop();
    }
  });

  it('deletes a store with its tree and versions and asynchronously drops its file references', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let { file, item } = await addFile(fixture, store, 'docs/readme.txt');
    await storeVersionService.createStoreVersionSnapshotNow({ storeId: store.id });

    let reference = await db.fileReference.findFirstOrThrow({
      where: { entityType: 'store_item', entityId: item.id }
    });

    let deleted = await storeService.deleteStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      store
    });
    expect(deleted.id).toBe(store.id);

    expect(await db.store.findUnique({ where: { id: store.id } })).toBeNull();
    expect(await db.storeItem.count({ where: { storeOid: store.oid } })).toBe(0);
    expect(await db.storeDirectory.count({ where: { storeOid: store.oid } })).toBe(0);
    expect(await db.storeVersion.count({ where: { storeOid: store.oid } })).toBe(0);

    await expectServiceError(
      storeService.getStoreById({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: store.id
      }),
      'not_found'
    );

    await eventually(
      async () => {
        expect(await db.fileReference.findUnique({ where: { id: reference.id } })).toBeNull();
        expect(
          await db.fileLink.findUnique({ where: { oid: reference.fileLinkOid } })
        ).toBeNull();
      },
      { timeoutMs: 90_000 }
    );

    let fileRow = await db.file.findUniqueOrThrow({ where: { id: file.id } });
    expect(fileRow.status).toBe('active');
  }, 120_000);

  it('rejects updates, deletes and item changes on a read-only store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createStore(fixture);
    let store = await db.store.update({
      where: { id: created.id },
      data: { isReadOnly: true }
    });

    await expectServiceError(
      storeService.updateStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        store,
        input: { name: uniqueId('renamed') }
      }),
      'bad_request'
    );
    await expectServiceError(
      storeService.deleteStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        store
      }),
      'bad_request'
    );
    await expectServiceError(modifyItems(fixture, store, [{ path: 'nope' }]), 'bad_request');

    let permissions = await storeService.getStorePermissions({
      ...scopeOf(fixture),
      authorization: privileged,
      store
    });
    expect(permissions).toMatchObject({
      hasFullAccess: false,
      permissions: ['content_read'],
      writableStoreIds: []
    });

    let row = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(row.name).toBe(created.name);
    expect(await storePaths(store.id)).toEqual(['/']);
  });

  it('refuses to delete the source store of a linked template until the template is gone', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let template = await storeTemplateService.createStoreTemplate({
      ...scopeOf(fixture),
      input: { name: uniqueId('linked-template'), storeId: store.id }
    });

    let linkedStore = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(linkedStore.access).toBe('public_read');

    await expectServiceError(
      storeService.deleteStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        store: linkedStore
      }),
      'bad_request'
    );
    expect(await db.store.findUnique({ where: { id: store.id } })).not.toBeNull();

    await storeTemplateService.deleteStoreTemplate({
      ...scopeOf(fixture),
      storeTemplateId: template.id
    });

    await storeService.deleteStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      store: linkedStore
    });
    expect(await db.store.findUnique({ where: { id: store.id } })).toBeNull();
  });

  it('clones a store with its explicit directories and files without coupling the two', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let source = await createStore(fixture, { access: 'public_read' });
    await modifyItems(fixture, source, [{ type: 'add', path: 'empty-dir' }]);
    let { file, item } = await addFile(fixture, source, 'docs/a.txt');

    let clone = await storeService.cloneStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      store: source,
      input: { name: uniqueId('clone') }
    });

    expect(clone).toMatchObject({
      cloneType: 'sync_until_change',
      parentStoreOid: source.oid,
      access: 'public_read'
    });
    expect(clone.dirtyAt).not.toBeNull();
    expect(await storePaths(clone.id)).toEqual(await storePaths(source.id));
    await expectConsistentItemCount(clone.id);

    let clonedFile = await db.storeItem.findFirstOrThrow({
      where: { storeOid: clone.oid, path: '/docs/a.txt' }
    });
    expect(clonedFile.id).not.toBe(item.id);
    expect(clonedFile.fileOid).toBe(file.oid);
    expect(clonedFile.referenceOid).not.toBe(item.referenceOid);

    let children = await firstPage(
      await storeService.listStores({
        ...scopeOf(fixture),
        authorization: privileged,
        parentStoreIds: [source.id]
      })
    );
    expect(children.map(store => store.id)).toEqual([clone.id]);

    await modifyItems(fixture, clone, [{ type: 'remove', itemId: clonedFile.id }]);
    expect(await storePaths(source.id)).toContain('/docs/a.txt');
    expect(await storePaths(clone.id)).not.toContain('/docs/a.txt');
  });

  it('isolates stores, items, versions and participants from another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let store = await createStore(fixture, { access: 'public_write' });
    let { item } = await addFile(fixture, store, 'secret.txt');
    let { version } = await storeVersionService.createStoreVersionSnapshotNow({
      storeId: store.id
    });

    await expectServiceError(
      storeService.getStoreById({
        ...scopeOf(other),
        authorization: privileged,
        storeId: store.id
      }),
      'not_found'
    );

    let listed = await firstPage(
      await storeService.listStores({ ...scopeOf(other), authorization: privileged })
    );
    expect(listed.map(row => row.id)).not.toContain(store.id);

    let listedByIds = await firstPage(
      await storeService.listStores({
        ...scopeOf(other),
        authorization: privileged,
        ids: [store.id]
      })
    );
    expect(listedByIds).toEqual([]);

    await expectServiceError(
      storeItemService.getStoreItemById({
        ...scopeOf(other),
        authorization: privileged,
        itemId: item.id
      }),
      'not_found'
    );

    let items = await firstPage(
      await storeItemService.listStoreItems({
        ...scopeOf(other),
        authorization: privileged,
        storeId: store.id,
        types: ['file', 'document', 'directory']
      })
    );
    expect(items).toEqual([]);

    await expectServiceError(
      storeVersionService.listStoreVersions({
        ...scopeOf(other),
        authorization: privileged,
        storeId: store.id
      }),
      'not_found'
    );
    await expectServiceError(
      storeVersionService.getStoreVersionById({
        ...scopeOf(other),
        authorization: privileged,
        storeVersionId: version.id
      }),
      'not_found'
    );
    await expectServiceError(
      storeVersionService.getLatestStoreVersion({
        ...scopeOf(other),
        authorization: privileged,
        storeId: store.id
      }),
      'not_found'
    );

    let participants = await firstPage(
      await storeParticipantService.listStoreParticipants({
        ...scopeOf(other),
        storeIds: [store.id]
      })
    );
    expect(participants).toEqual([]);
  });
});
