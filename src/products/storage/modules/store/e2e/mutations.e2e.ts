import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { Store } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import {
  addFile,
  captureFabric,
  createStore,
  expectConsistentItemCount,
  modifyItems,
  storePaths,
  uploadFile
} from './_fixtures';

let snapshotStore = async (store: Store) => {
  let row = await db.store.findUniqueOrThrow({ where: { id: store.id } });

  return {
    itemCount: row.itemCount,
    byteSize: row.byteSize,
    dirtyAt: row.dirtyAt,
    lastEditedAt: row.lastEditedAt,
    paths: await storePaths(store.id),
    directories: await db.storeDirectory.count({ where: { storeOid: store.oid } })
  };
};

let fileReferenceCount = async (file: { oid: bigint }) =>
  await db.fileReference.count({ where: { fileLink: { fileOid: file.oid } } });

let createStoreWithItems = async (fixture: OrganizationFixture) => {
  let store = await createStore(fixture);
  let one = await addFile(fixture, store, 'one.txt', { content: 'one' });
  let two = await addFile(fixture, store, 'two.txt', { content: 'two' });
  let locked = await addFile(fixture, store, 'locked/child.txt', { content: 'locked' });
  let lockedDirectory = await db.storeItem.findFirstOrThrow({
    where: { storeOid: store.oid, path: '/locked/' }
  });

  return { store, one, two, locked, lockedDirectory };
};

describe('module-store batched mutations', () => {
  let org = useOrganization();

  it('applies a batch in order, returns one result per operation and fires one audit event', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { store, one } = await createStoreWithItems(fixture);
    let fileA = await uploadFile(fixture);
    let fileB = await uploadFile(fixture);
    let modified = captureFabric('store.items.modified:after');

    let results;
    try {
      results = await modifyItems(fixture, store, [
        { type: 'add', path: 'batch' },
        { type: 'add', path: 'batch/a.txt', fileId: fileA.id },
        { type: 'add', path: 'b.txt', fileId: fileB.id },
        { type: 'modify', itemId: one.item.id, path: 'batch/one.txt' },
        { type: 'remove', itemId: one.item.id }
      ]);
    } finally {
      modified.stop();
    }

    expect(results.map(result => [result.type, result.item.path])).toEqual([
      ['add', '/batch/'],
      ['add', '/batch/a.txt'],
      ['add', '/b.txt'],
      ['modify', '/batch/one.txt'],
      ['remove', '/batch/one.txt']
    ]);
    expect(await storePaths(store.id)).toEqual([
      '/',
      '/b.txt',
      '/batch/',
      '/batch/a.txt',
      '/locked/',
      '/locked/child.txt',
      '/two.txt'
    ]);
    await expectConsistentItemCount(store.id);

    let events = modified.events.filter(event => event.store.id === store.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      skill: null,
      truncated: false,
      counts: { add: 3, modify: 1, remove: 1 }
    });
    expect(events[0]!.operations.find(operation => operation.type === 'modify')).toMatchObject(
      {
        path: '/batch/one.txt',
        previousPath: '/one.txt',
        itemId: one.item.id,
        fileId: one.file.id
      }
    );
  });

  it('rolls back every operation when a later operation fails', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { store, one, lockedDirectory } = await createStoreWithItems(fixture);
    let fresh = await uploadFile(fixture);
    let before = await snapshotStore(store);
    let modified = captureFabric('store.items.modified:after');

    try {
      await expectServiceError(
        modifyItems(fixture, store, [
          { type: 'add', path: 'new/deep/fresh.txt', fileId: fresh.id },
          { type: 'add', path: 'fresh-dir' },
          { type: 'modify', itemId: one.item.id, path: 'renamed.txt' },
          { type: 'remove', itemId: lockedDirectory.id }
        ]),
        'bad_request'
      );
    } finally {
      modified.stop();
    }

    expect(await snapshotStore(store)).toEqual(before);
    expect(await fileReferenceCount(fresh)).toBe(0);
    expect(await db.fileLink.count({ where: { fileOid: fresh.oid } })).toBe(0);
    expect(modified.events.filter(event => event.store.id === store.id)).toEqual([]);
  });

  it('rolls back when an operation conflicts with existing items or targets a missing item', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { store, one, two } = await createStoreWithItems(fixture);
    let fresh = await uploadFile(fixture);
    let before = await snapshotStore(store);

    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'three.txt', fileId: fresh.id },
        { type: 'modify', itemId: one.item.id, path: 'two.txt' }
      ]),
      'bad_request'
    );
    expect(await snapshotStore(store)).toEqual(before);

    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'remove', itemId: two.item.id },
        { type: 'add', path: 'four.txt', fileId: fresh.id },
        { type: 'remove', itemId: 'storeItem_missing' }
      ]),
      'not_found'
    );
    expect(await snapshotStore(store)).toEqual(before);
    expect(await fileReferenceCount(fresh)).toBe(0);
    expect(await db.fileReference.count({ where: { oid: two.item.referenceOid! } })).toBe(1);
  });

  it('rejects a batch with an invalid operation before applying any of it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { store } = await createStoreWithItems(fixture);
    let fresh = await uploadFile(fixture);
    let before = await snapshotStore(store);

    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'valid.txt', fileId: fresh.id },
        { type: 'add', path: '../..', fileId: fresh.id }
      ]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'valid.txt', fileId: fresh.id },
        { type: 'add', path: 'other.txt', fileId: 'file_missing' }
      ]),
      'not_found'
    );

    expect(await snapshotStore(store)).toEqual(before);
    expect(await fileReferenceCount(fresh)).toBe(0);
  });

  it('rejects more than 500 operations in one batch', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    await expectServiceError(
      modifyItems(
        fixture,
        store,
        Array.from({ length: 501 }, (_, index) => ({
          type: 'add' as const,
          path: `d${index}`
        }))
      ),
      'bad_request'
    );
    expect(await storePaths(store.id)).toEqual(['/']);
  });

  it('enforces the 1000 item limit without applying part of the batch', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    await db.store.update({ where: { id: store.id }, data: { itemCount: 999 } });

    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'fits' },
        { type: 'add', path: 'overflows' }
      ]),
      'bad_request'
    );

    expect(await storePaths(store.id)).toEqual(['/']);
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).itemCount).toBe(
      999
    );

    let [fits] = await modifyItems(fixture, store, [{ type: 'add', path: 'fits' }]);
    expect(fits!.item.path).toBe('/fits/');
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).itemCount).toBe(
      1000
    );
  });

  it('keeps the item count exact under concurrent batches', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let files = await Promise.all(
      Array.from({ length: 4 }, () => uploadFile(fixture, { content: uniqueId('c') }))
    );

    await Promise.all([
      ...Array.from({ length: 6 }, (_, index) =>
        modifyItems(fixture, store, [{ type: 'add', path: `concurrent-${index}/sub` }])
      ),
      ...files.map((file, index) =>
        modifyItems(fixture, store, [
          { type: 'add', path: `root-${index}.txt`, fileId: file.id }
        ])
      )
    ]);

    let row = await expectConsistentItemCount(store.id);
    expect(row.itemCount).toBe(1 + 6 * 2 + 4);
  });

  it('converges concurrent adds to the same path on a single item', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let first = await uploadFile(fixture, { content: 'first' });
    let second = await uploadFile(fixture, { content: 'second' });

    await Promise.all([
      modifyItems(fixture, store, [{ type: 'add', path: 'race.txt', fileId: first.id }]),
      modifyItems(fixture, store, [{ type: 'add', path: 'race.txt', fileId: second.id }])
    ]);

    let items = await db.storeItem.findMany({
      where: { storeOid: store.oid, path: '/race.txt' }
    });
    expect(items).toHaveLength(1);
    expect([first.oid, second.oid]).toContain(items[0]!.fileOid);
    expect(
      await db.fileReference.count({
        where: { entityType: 'store_item', entityId: items[0]!.id }
      })
    ).toBe(1);
    await expectConsistentItemCount(store.id);
  });

  it('caps the audited operations of a large batch and flags the truncation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let modified = captureFabric('store.items.modified:after');

    try {
      await modifyItems(
        fixture,
        store,
        Array.from({ length: 60 }, (_, index) => ({
          type: 'add' as const,
          path: `bulk-${index}`
        }))
      );
    } finally {
      modified.stop();
    }

    let event = modified.events.find(event => event.store.id === store.id);
    expect(event?.counts).toEqual({ add: 60, modify: 0, remove: 0 });
    expect(event?.operations).toHaveLength(50);
    expect(event?.truncated).toBe(true);
    await expectConsistentItemCount(store.id);
  });
});
