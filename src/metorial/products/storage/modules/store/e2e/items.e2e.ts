import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { computeStoreByteSize, getStoreByteSize, storeItemService } from '../src';
import {
  addFile,
  createDocument,
  createStore,
  expectConsistentItemCount,
  modifyItems,
  privileged,
  randomBytes,
  readFileContent,
  readItemContent,
  scopeOf,
  storePaths,
  uploadFile
} from './_fixtures';

describe('module-store items', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('adds a text file under auto-created directories and round-trips its content', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let content = `todo ${uniqueId('content')}\nsecond line`;

    let { file, item } = await addFile(fixture, store, 'notes/2026/todo.txt', { content });

    expect(item).toMatchObject({ kind: 'file', path: '/notes/2026/todo.txt' });
    expect(item.parentDirectory?.path).toBe('/notes/2026/');
    expect(item.fileOid).toBe(file.oid);
    expect((await readItemContent(fixture, item.id)).toString('utf8')).toBe(content);

    expect(await storePaths(store.id)).toEqual([
      '/',
      '/notes/',
      '/notes/2026/',
      '/notes/2026/todo.txt'
    ]);
    let directories = await db.storeDirectory.findMany({
      where: { storeOid: store.oid, path: { not: '/' } },
      orderBy: { path: 'asc' }
    });
    expect(directories.map(directory => [directory.path, directory.isAutoCreated])).toEqual([
      ['/notes/', true],
      ['/notes/2026/', true]
    ]);

    let reference = await db.fileReference.findFirstOrThrow({
      where: { entityType: 'store_item', entityId: item.id },
      include: { fileLink: true }
    });
    expect(reference.oid).toBe(item.referenceOid);
    expect(reference.fileLink.fileOid).toBe(file.oid);

    let row = await expectConsistentItemCount(store.id);
    expect(row.itemCount).toBe(4);
    expect(row.dirtyAt).not.toBeNull();
    expect(row.lastEditedAt.getTime()).toBeGreaterThanOrEqual(store.lastEditedAt.getTime());

    let fetched = await storeItemService.getStoreItemById({
      ...scopeOf(fixture),
      authorization: privileged,
      itemId: item.id
    });
    expect(fetched.store.id).toBe(store.id);

    let contentItems = await firstPage(
      await storeItemService.listStoreItems({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: store.id
      })
    );
    expect(contentItems.map(entry => entry.id)).toEqual([item.id]);

    let children = await firstPage(
      await storeItemService.listStoreItems({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: store.id,
        parentDirectoryIds: [item.parentDirectory!.id],
        types: ['file', 'document', 'directory']
      })
    );
    expect(children.map(entry => entry.id)).toEqual([item.id]);
  });

  it('round-trips 2 MB of binary content through object storage', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let content = randomBytes(2 * 1024 * 1024);

    let { file, item } = await addFile(fixture, store, 'blobs/random.bin', {
      name: `${uniqueId('random')}.bin`,
      content,
      mimeType: 'application/octet-stream'
    });

    expect(file.fileSize).toBe(content.byteLength);
    expect(
      await db.filePendingContent.findUnique({ where: { fileOid: file.oid } })
    ).toBeNull();

    let downloaded = await readItemContent(fixture, item.id);
    expect(downloaded.byteLength).toBe(content.byteLength);
    expect(Buffer.compare(downloaded, Buffer.from(content))).toBe(0);
  });

  it('stores an empty text file', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    let { file, item } = await addFile(fixture, store, 'empty.txt', { content: '' });

    expect(file.fileSize).toBe(0);
    expect((await readItemContent(fixture, item.id)).byteLength).toBe(0);
  });

  it('stores an empty binary file in object storage', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    let { file, item } = await addFile(fixture, store, 'empty.bin', {
      name: `${uniqueId('empty')}.bin`,
      content: new Uint8Array(0),
      mimeType: 'application/octet-stream'
    });

    expect(file.fileSize).toBe(0);
    expect((await readItemContent(fixture, item.id)).byteLength).toBe(0);
  });

  it('attaches a document at a nested path and exposes its markdown content', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let content = `# Intro\n\n${uniqueId('body')}`;

    let document = await createDocument(fixture, {
      content,
      store: { id: store.id, path: 'guides/intro.md' }
    });

    let item = await db.storeItem.findFirstOrThrow({
      where: { storeOid: store.oid, path: '/guides/intro.md' }
    });
    expect(item).toMatchObject({ kind: 'document', documentOid: document.oid });

    let fetched = await storeItemService.getStoreItemById({
      ...scopeOf(fixture),
      authorization: privileged,
      itemId: item.id
    });
    expect(fetched.document?.content.content).toBe(content);

    let documents = await firstPage(
      await storeItemService.listStoreItems({
        ...scopeOf(fixture),
        authorization: privileged,
        storeId: store.id,
        types: ['document']
      })
    );
    expect(documents.map(entry => entry.id)).toEqual([item.id]);
    await expectConsistentItemCount(store.id);
  });

  it('replaces the file behind a path when another file is added at the same path', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let first = await addFile(fixture, store, 'shared.txt', { content: 'first' });
    let second = await uploadFile(fixture, { content: 'second' });

    let [result] = await modifyItems(fixture, store, [
      { type: 'add', path: '/shared.txt', fileId: second.id }
    ]);

    expect(result!.item.id).toBe(first.item.id);
    expect(result!.item.fileOid).toBe(second.oid);
    expect((await readItemContent(fixture, first.item.id)).toString('utf8')).toBe('second');
    expect(
      await db.fileReference.findUnique({ where: { oid: first.item.referenceOid! } })
    ).toBeNull();
    expect(await storePaths(store.id)).toEqual(['/', '/shared.txt']);
    await expectConsistentItemCount(store.id);
  });

  it('moves a file and prunes the auto-created directories it leaves empty', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let { item } = await addFile(fixture, store, 'old/deep/file.txt', { content: 'moving' });

    let [result] = await modifyItems(fixture, store, [
      { type: 'modify', itemId: item.id, path: 'new/file.txt' }
    ]);

    expect(result!.item).toMatchObject({ id: item.id, path: '/new/file.txt' });
    expect(await storePaths(store.id)).toEqual(['/', '/new/', '/new/file.txt']);
    expect(
      await db.storeDirectory.count({
        where: { storeOid: store.oid, path: { startsWith: '/old/' } }
      })
    ).toBe(0);
    expect((await readItemContent(fixture, item.id)).toString('utf8')).toBe('moving');
    await expectConsistentItemCount(store.id);
  });

  it('swaps the file behind an item while keeping its path', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let { item } = await addFile(fixture, store, 'swap.txt', { content: 'before' });
    let replacement = await uploadFile(fixture, { content: 'after' });

    let [result] = await modifyItems(fixture, store, [
      { itemId: item.id, fileId: replacement.id }
    ]);

    expect(result).toMatchObject({ type: 'modify' });
    expect(result!.item).toMatchObject({ path: '/swap.txt', fileOid: replacement.oid });
    expect(result!.item.referenceOid).not.toBe(item.referenceOid);
    expect(
      await db.fileReference.findUnique({ where: { oid: item.referenceOid! } })
    ).toBeNull();
    expect((await readItemContent(fixture, item.id)).toString('utf8')).toBe('after');
  });

  it('keeps explicitly created directories when their last child is removed', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let [directory] = await modifyItems(fixture, store, [{ type: 'add', path: 'keep' }]);
    let { item } = await addFile(fixture, store, 'keep/child.txt');

    expect(directory!.item).toMatchObject({ kind: 'directory', path: '/keep/' });

    await modifyItems(fixture, store, [{ type: 'remove', itemId: item.id }]);
    expect(await storePaths(store.id)).toEqual(['/', '/keep/']);

    await modifyItems(fixture, store, [{ itemId: directory!.item.id }]);
    expect(await storePaths(store.id)).toEqual(['/']);
    expect(await db.storeDirectory.count({ where: { storeOid: store.oid } })).toBe(1);
    await expectConsistentItemCount(store.id);
  });

  it('renames an empty directory and refuses to move one with children', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let [empty] = await modifyItems(fixture, store, [{ type: 'add', path: 'empty' }]);
    let [full] = await modifyItems(fixture, store, [{ type: 'add', path: 'full' }]);
    await addFile(fixture, store, 'full/child.txt');

    let [renamed] = await modifyItems(fixture, store, [
      { type: 'modify', itemId: empty!.item.id, path: 'nested/renamed' }
    ]);
    expect(renamed!.item.path).toBe('/nested/renamed/');

    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'modify', itemId: full!.item.id, path: 'moved' }]),
      'bad_request'
    );
    expect(await storePaths(store.id)).toEqual([
      '/',
      '/full/',
      '/full/child.txt',
      '/nested/',
      '/nested/renamed/'
    ]);
    await expectConsistentItemCount(store.id);
  });

  it('protects the root directory and non-empty directories', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let root = await db.storeItem.findFirstOrThrow({
      where: { storeOid: store.oid, path: '/' }
    });
    await addFile(fixture, store, 'dir/child.txt');
    let directory = await db.storeItem.findFirstOrThrow({
      where: { storeOid: store.oid, path: '/dir/' }
    });

    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'remove', itemId: root.id }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'modify', itemId: root.id, path: 'elsewhere' }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'remove', itemId: directory.id }]),
      'bad_request'
    );

    let file = await uploadFile(fixture);
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'modify', itemId: directory.id, fileId: file.id }]),
      'bad_request'
    );
    expect(await storePaths(store.id)).toEqual(['/', '/dir/', '/dir/child.txt']);
  });

  it('validates operation shapes before touching the store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let { item } = await addFile(fixture, store, 'existing.txt');
    let file = await uploadFile(fixture);
    let document = await createDocument(fixture, { content: '# Loose document' });

    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'remove', itemId: item.id, path: 'x.txt' }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'modify', path: 'x.txt' }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'add', fileId: file.id }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'both.txt', fileId: file.id, documentId: document.id }
      ]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'remove', itemId: 'storeItem_missing' }]),
      'not_found'
    );
    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'missing.txt', fileId: 'file_missing' }
      ]),
      'not_found'
    );
    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'missing.md', documentId: 'document_missing' }
      ]),
      'not_found'
    );

    expect(await storePaths(store.id)).toEqual(['/', '/existing.txt']);
  });

  it('normalizes traversal, absolute and backslash paths into the store root', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let cases: [string, string][] = [
      ['../../etc/passwd.txt', '/etc/passwd.txt'],
      ['/absolute/file.txt', '/absolute/file.txt'],
      ['a/./b/../c.txt', '/a/b/c.txt'],
      ['..\\..\\windows\\evil.txt', '/windows/evil.txt'],
      ['....//...//dots.txt', '/dots.txt'],
      ['  spaced  / name .txt ', '/spaced/name .txt'],
      ['we<i>rd|na:me?*.txt', '/weirdname.txt'],
      ['nul\u0000byte\r\n.txt', '/nulbyte.txt'],
      ['//double//slashes//f.txt', '/double/slashes/f.txt']
    ];

    for (let [input, expected] of cases) {
      let file = await uploadFile(fixture);
      let [result] = await modifyItems(fixture, store, [
        { type: 'add', path: input, fileId: file.id }
      ]);

      expect(result!.item.path, input).toBe(expected);
    }

    let paths = await storePaths(store.id);
    for (let path of paths) {
      expect(path.startsWith('/')).toBe(true);
      expect(path.split('/').some(segment => /^\.+$/.test(segment))).toBe(false);
      expect(path).not.toMatch(/[\\\u0000]/);
    }

    let [traversalDirectory] = await modifyItems(fixture, store, [
      { type: 'add', path: '../../' }
    ]);
    expect(traversalDirectory!.item.path).toBe('/');
    await expectConsistentItemCount(store.id);
  });

  it('rejects file paths that normalize to no file name', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let file = await uploadFile(fixture);

    for (let path of ['', '   ', '../..', '///', './.', '日本語', '?*<>']) {
      await expectServiceError(
        modifyItems(fixture, store, [{ type: 'add', path, fileId: file.id }]),
        'bad_request'
      );
    }

    expect(await storePaths(store.id)).toEqual(['/']);
  });

  it.fails(
    'keeps files whose names differ only in non-ASCII characters apart (bug: normalizeStorePath strips them, so the second add silently replaces the first)',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let store = await createStore(fixture);

      let first = await addFile(fixture, store, 'résumé.txt', { content: 'first' });
      let second = await addFile(fixture, store, 'rèsumè.txt', { content: 'second' });

      expect(second.item.id).not.toBe(first.item.id);
      expect((await readItemContent(fixture, first.item.id)).toString('utf8')).toBe('first');
    }
  );

  it('rejects a file and a directory with the same name', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let [directory] = await modifyItems(fixture, store, [{ type: 'add', path: 'docs' }]);
    let [emptyDirectory] = await modifyItems(fixture, store, [{ type: 'add', path: 'empty' }]);
    let readme = await addFile(fixture, store, 'readme');
    let other = await addFile(fixture, store, 'other.txt');
    let file = await uploadFile(fixture);
    let before = await storePaths(store.id);

    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'add', path: 'docs', fileId: file.id }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'add', path: 'readme/' }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'readme/nested.txt', fileId: file.id }
      ]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'modify', itemId: other.item.id, path: 'docs' }]),
      'bad_request'
    );
    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'modify', itemId: emptyDirectory!.item.id, path: 'readme' }
      ]),
      'bad_request'
    );

    expect(directory!.item.path).toBe('/docs/');
    expect(readme.item.path).toBe('/readme');
    expect(await storePaths(store.id)).toEqual(before);
    await expectConsistentItemCount(store.id);
  });

  it('refuses files and documents of another organization and deleted files', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let store = await createStore(fixture);
    let foreignFile = await uploadFile(other, { content: 'foreign secret' });
    let foreignDocument = await createDocument(other, { content: '# Foreign' });
    let deletedFile = await uploadFile(fixture);
    await db.file.update({ where: { oid: deletedFile.oid }, data: { status: 'deleted' } });

    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'stolen.txt', fileId: foreignFile.id }
      ]),
      'not_found'
    );
    await expectServiceError(
      modifyItems(fixture, store, [
        { type: 'add', path: 'stolen.md', documentId: foreignDocument.id }
      ]),
      'not_found'
    );
    await expectServiceError(
      modifyItems(fixture, store, [{ type: 'add', path: 'gone.txt', fileId: deletedFile.id }]),
      'not_found'
    );

    expect(await storePaths(store.id)).toEqual(['/']);
    expect((await readFileContent(other, foreignFile.id)).toString('utf8')).toBe(
      'foreign secret'
    );
  });

  it('tracks the byte size of stored files once it has been computed', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    expect(await getStoreByteSize({ storeOid: store.oid })).toBe(0n);

    let { item } = await addFile(fixture, store, 'sized.txt', { content: '12345' });
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).byteSize).toBe(5n);

    let larger = await uploadFile(fixture, { content: '1234567890' });
    await modifyItems(fixture, store, [{ itemId: item.id, fileId: larger.id }]);
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).byteSize).toBe(10n);
    expect(await computeStoreByteSize({ storeOid: store.oid })).toBe(10n);

    await modifyItems(fixture, store, [{ type: 'remove', itemId: item.id }]);
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).byteSize).toBe(0n);
    expect(await computeStoreByteSize({ storeOid: store.oid })).toBe(0n);
  });
});
