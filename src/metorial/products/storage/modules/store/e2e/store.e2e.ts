import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import { storeItemService, storeService } from '../src';

let authorization = createResourceAuthorization({ restricted: false });

let createStore = async (fixture: OrganizationFixture, name = uniqueId('store')) =>
  await storeService.createStore({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name }
  });

describe('module-store', () => {
  let org = useOrganization();

  it('creates, gets, lists and updates a store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('store');

    let store = await createStore(fixture, name);
    expect(store.name).toBe(name);
    expect(store.access).toBe('private');
    expect(store.cloneType).toBeNull();

    let fetched = await storeService.getStoreById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      storeId: store.id
    });
    expect(fetched.id).toBe(store.id);

    let listed = await firstPage(
      await storeService.listStores({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        ids: [store.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([store.id]);

    let renamed = uniqueId('renamed-store');
    let updated = await storeService.updateStore({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      store: fetched,
      input: { name: renamed, access: 'public_read' }
    });
    expect(updated.name).toBe(renamed);
    expect(updated.access).toBe('public_read');

    let emptyUpdate = await rejectionOf(
      storeService.updateStore({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        authorization,
        store: updated,
        input: {}
      })
    );
    expect(emptyUpdate.message).toMatch(/At least one store field/);
  });

  it('adds, lists and removes directory items', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    let [added] = await storeService.modifyStoreItems({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      store,
      operations: [{ type: 'add', path: 'docs/guides' }]
    });
    expect(added?.type).toBe('add');
    expect(added?.item.kind).toBe('directory');
    expect(added?.item.path).toBe('/docs/guides/');

    let directories = await firstPage(
      await storeItemService.listStoreItems({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        storeId: store.id,
        types: ['directory']
      })
    );
    expect(directories.map(item => item.path)).toEqual(
      expect.arrayContaining(['/', '/docs/', '/docs/guides/'])
    );

    let fetched = await storeItemService.getStoreItemById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      itemId: added!.item.id
    });
    expect(fetched.store.id).toBe(store.id);

    let [removed] = await storeService.modifyStoreItems({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      store,
      operations: [{ type: 'remove', itemId: added!.item.id }]
    });
    expect(removed?.type).toBe('remove');

    let remaining = await firstPage(
      await storeItemService.listStoreItems({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        storeId: store.id,
        types: ['directory']
      })
    );
    expect(remaining.map(item => item.id)).not.toContain(added!.item.id);
  });

  it('deletes a store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    let deleted = await storeService.deleteStore({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      store
    });
    expect(deleted.id).toBe(store.id);

    await expect(
      storeService.getStoreById({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        storeId: store.id
      })
    ).rejects.toThrow();
    expect(await db.store.findUnique({ where: { id: store.id } })).toBeNull();
  });
});
