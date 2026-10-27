import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { documentService, flushDocumentDraft } from '@metorial/module-documents';
import { describe, expect, it } from 'vitest';
import { storeVersionService } from '../src';
import {
  addFile,
  createDocument,
  createStore,
  modifyItems,
  privileged,
  readFileContent,
  scopeOf,
  uploadFile
} from './_fixtures';

let sortedPaths = (items: { path: string }[]) => items.map(item => item.path).sort();

describe('module-store versions', () => {
  let org = useOrganization();

  it('snapshots the current tree and keeps the snapshot when the store changes later', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let a = await addFile(fixture, store, 'a.txt', { content: 'v1-a' });
    let b = await addFile(fixture, store, 'dir/b.txt', { content: 'v1-b' });

    let first = await storeVersionService.createStoreVersionSnapshotNow({ storeId: store.id });
    expect(first).toMatchObject({ didClearDirtyAt: true, alreadyExisted: false });
    expect(first.version).toMatchObject({
      kind: 'snapshot',
      storeId: store.id,
      versionNumber: 1,
      itemCount: 4
    });
    expect(sortedPaths(first.version.items)).toEqual(['/', '/a.txt', '/dir/', '/dir/b.txt']);
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).dirtyAt).toBeNull();

    let replacement = await uploadFile(fixture, { content: 'v2-a' });
    let c = await uploadFile(fixture, { content: 'v2-c' });
    await modifyItems(fixture, store, [
      { itemId: a.item.id, fileId: replacement.id },
      { type: 'remove', itemId: b.item.id },
      { type: 'add', path: 'c.txt', fileId: c.id }
    ]);
    expect(
      (await db.store.findUniqueOrThrow({ where: { id: store.id } })).dirtyAt
    ).not.toBeNull();

    let stored = await storeVersionService.getStoreVersionById({
      ...scopeOf(fixture),
      authorization: privileged,
      storeVersionId: first.version.id
    });
    expect(sortedPaths(stored.items)).toEqual(['/', '/a.txt', '/dir/', '/dir/b.txt']);
    let storedA = stored.items.find(item => item.path === '/a.txt')!;
    let storedB = stored.items.find(item => item.path === '/dir/b.txt')!;
    expect(storedA.fileId).toBe(a.file.id);
    expect((await readFileContent(fixture, storedA.fileId!)).toString('utf8')).toBe('v1-a');
    expect((await readFileContent(fixture, storedB.fileId!)).toString('utf8')).toBe('v1-b');

    let latest = await storeVersionService.getResolvedStoreVersion({
      ...scopeOf(fixture),
      authorization: privileged,
      storeId: store.id,
      storeVersionId: 'latest'
    });
    expect(latest).toMatchObject({ kind: 'latest', versionNumber: null, itemCount: 3 });
    expect(sortedPaths(latest.items)).toEqual(['/', '/a.txt', '/c.txt']);
    expect(latest.items.find(item => item.path === '/a.txt')?.fileId).toBe(replacement.id);

    let second = await storeVersionService.createStoreVersionSnapshotNow({
      storeId: store.id
    });
    expect(second.version.versionNumber).toBe(2);

    let versions = await firstPage(
      await storeVersionService.listStoreVersions({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: store.id
      })
    );
    expect(versions.map(version => version.versionNumber)).toEqual([2, 1]);

    let filtered = await firstPage(
      await storeVersionService.listStoreVersions({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: store.id,
        ids: [first.version.id]
      })
    );
    expect(filtered.map(version => version.id)).toEqual([first.version.id]);

    let resolved = await storeVersionService.getResolvedStoreVersion({
      ...scopeOf(fixture),
      authorization: privileged,
      storeId: store.id,
      storeVersionId: first.version.id
    });
    expect(sortedPaths(resolved.items)).toEqual(sortedPaths(stored.items));
  });

  it('pins document versions so that later document edits do not change a snapshot', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let document = await createDocument(fixture, {
      content: '# Original\n\noriginal body',
      store: { id: store.id, path: 'doc.md' }
    });

    let { version } = await storeVersionService.createStoreVersionSnapshotNow({
      storeId: store.id
    });
    let snapshotItem = version.items.find(item => item.path === '/doc.md')!;
    expect(snapshotItem).toMatchObject({
      kind: 'document',
      documentId: document.id,
      documentVersionId: document.currentVersion!.id
    });

    let current = await documentService.getDocumentById({
      ...scopeOf(fixture),
      authorization: privileged,
      documentId: document.id
    });
    await documentService.updateDocument({
      ...scopeOf(fixture),
      document: current,
      input: { content: '# Edited\n\nedited body', authorization: privileged }
    });
    await flushDocumentDraft({ documentId: document.id, force: true });

    let pinned = await db.documentVersion.findUniqueOrThrow({
      where: { id: snapshotItem.documentVersionId },
      include: { content: true }
    });
    expect(pinned.content.content).toBe('# Original\n\noriginal body');

    let latest = await storeVersionService.getLatestStoreVersion({
      ...scopeOf(fixture),
      authorization: privileged,
      storeId: store.id
    });
    let latestDocument = latest.items.find(item => item.path === '/doc.md')!;
    expect(latestDocument.documentVersionId).not.toBe(snapshotItem.documentVersionId);

    let reread = await storeVersionService.getStoreVersionById({
      ...scopeOf(fixture),
      authorization: privileged,
      storeVersionId: version.id
    });
    expect(reread.items.find(item => item.path === '/doc.md')?.documentVersionId).toBe(
      snapshotItem.documentVersionId
    );
  });

  it('creates a scheduled snapshot only for the dirtyAt it was queued with', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    expect(
      await storeVersionService.createStoreVersionSnapshot({
        storeId: store.id,
        expectedDirtyAt: new Date()
      })
    ).toBeNull();

    await addFile(fixture, store, 'dirty.txt');
    let { dirtyAt } = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(dirtyAt).not.toBeNull();

    expect(
      await storeVersionService.createStoreVersionSnapshot({
        storeId: store.id,
        expectedDirtyAt: new Date(dirtyAt!.getTime() - 1000)
      })
    ).toBeNull();
    expect(await db.storeVersion.count({ where: { storeOid: store.oid } })).toBe(0);

    let created = await storeVersionService.createStoreVersionSnapshot({
      storeId: store.id,
      expectedDirtyAt: dirtyAt!
    });
    expect(created).toMatchObject({ didClearDirtyAt: true, alreadyExisted: false });
    expect(created!.version).toMatchObject({ versionNumber: 1, sourceDirtyAt: dirtyAt });
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).dirtyAt).toBeNull();

    expect(
      await storeVersionService.createStoreVersionSnapshot({
        storeId: store.id,
        expectedDirtyAt: dirtyAt!
      })
    ).toBeNull();
    expect(await db.storeVersion.count({ where: { storeOid: store.oid } })).toBe(1);
  });

  it('snapshots an empty store and refuses versions of other stores or missing ids', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let otherStore = await createStore(fixture);

    let { version } = await storeVersionService.createStoreVersionSnapshotNow({
      storeId: store.id
    });
    expect(sortedPaths(version.items)).toEqual(['/']);
    expect(version.versionNumber).toBe(1);

    await expectServiceError(
      storeVersionService.getResolvedStoreVersion({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: otherStore.id,
        storeVersionId: version.id
      }),
      'not_found'
    );
    await expectServiceError(
      storeVersionService.getStoreVersionById({
        ...scopeOf(fixture),
        authorization: privileged,
        storeVersionId: 'storeVersion_missing'
      }),
      'not_found'
    );
    await expectServiceError(
      storeVersionService.createStoreVersionSnapshotNow({ storeId: 'store_missing' }),
      'not_found'
    );

    let otherVersions = await firstPage(
      await storeVersionService.listStoreVersions({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: otherStore.id
      })
    );
    expect(otherVersions).toEqual([]);
  });
});
