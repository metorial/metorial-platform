import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  storeItemService,
  storeService,
  storeTemplateService,
  type StoreTemplateItemInput
} from '../src';
import {
  addFile,
  createDocument,
  createStore,
  expectConsistentItemCount,
  modifyItems,
  privileged,
  randomBytes,
  readItemContent,
  scopeOf,
  storePaths,
  uploadFile
} from './_fixtures';

let binaryContent = Buffer.concat([
  Buffer.from(Array.from({ length: 256 }, (_, index) => index)),
  Buffer.from(randomBytes(4096))
]);

let readmeContent = 'Grüße aus dem Template 🚀\r\nline two\n';

let documentContent = '# Intro\n\nWelcome to the template.';

let templateItems = (): StoreTemplateItemInput[] => [
  { type: 'directory', path: 'assets' },
  {
    type: 'file',
    path: '../../assets/logo.bin',
    content: binaryContent.toString('base64'),
    encoding: 'base64',
    mimeType: 'application/octet-stream'
  },
  { type: 'file', path: 'readme.txt', content: readmeContent, encoding: 'utf-8' },
  { type: 'file', path: 'empty.txt', content: '', encoding: 'utf-8' },
  {
    type: 'document',
    path: 'guide/intro.md',
    content: documentContent,
    encoding: 'utf-8',
    title: 'Intro'
  }
];

let instantiatedPaths = [
  '/',
  '/assets/',
  '/assets/logo.bin',
  '/empty.txt',
  '/guide/',
  '/guide/intro.md',
  '/readme.txt'
];

let createStandaloneTemplate = async (
  fixture: OrganizationFixture,
  items: StoreTemplateItemInput[] = templateItems()
) =>
  await storeTemplateService.createStoreTemplate({
    ...scopeOf(fixture),
    input: { name: uniqueId('template'), items }
  });

let instantiate = async (
  fixture: OrganizationFixture,
  templateId: string,
  input: {
    access?: 'private' | 'public_read' | 'public_write';
    titles?: Record<string, string>;
  } = {}
) =>
  await storeService.createStoreFromTemplate({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    authorization: privileged,
    input: {
      templateId,
      name: uniqueId('from-template'),
      access: input.access,
      documentTitleOverrides: input.titles
    }
  });

let itemAt = async (storeOid: bigint, path: string) =>
  await db.storeItem.findFirstOrThrow({ where: { storeOid, path } });

let waitForBackingSync = async (templateId: string, previousHash?: string | null) =>
  await eventually(
    async () => {
      let template = await db.storeTemplate.findUniqueOrThrow({ where: { id: templateId } });
      expect(template.hash).not.toBeNull();
      expect(template.hash).not.toBe(previousHash);

      let backing = await db.storeTemplateBacking.findFirstOrThrow({
        where: { storeTemplateOid: template.oid },
        include: { store: true }
      });
      expect(backing.lastSyncedHash).toBe(template.hash);

      return { template, backing };
    },
    { timeoutMs: 100_000, intervalMs: 500 }
  );

describe('module-store templates', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('validates standalone template input', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('invalid-template');
    let store = await createStore(fixture);
    let invalidItems: StoreTemplateItemInput[][] = [
      [{ type: 'directory', path: 'dir', content: 'x', encoding: 'utf-8' }],
      [{ type: 'file', path: 'no-encoding.txt', content: 'x' }],
      [{ type: 'file', path: 'no-content.txt', encoding: 'utf-8' }],
      [{ type: 'file', path: 'titled.txt', content: 'x', encoding: 'utf-8', title: 'Title' }],
      [
        {
          type: 'document',
          path: 'typed.md',
          content: 'x',
          encoding: 'utf-8',
          mimeType: 'text/markdown'
        }
      ],
      [{ type: 'document', path: 'blank.md', content: 'x', encoding: 'utf-8', title: '   ' }],
      [
        { type: 'file', path: 'same.txt', content: 'a', encoding: 'utf-8' },
        { type: 'file', path: '/./same.txt', content: 'b', encoding: 'utf-8' }
      ],
      [{ type: 'file', path: '../', content: 'x', encoding: 'utf-8' }]
    ];

    for (let items of invalidItems) {
      await expectServiceError(
        storeTemplateService.createStoreTemplate({
          ...scopeOf(fixture),
          input: { name, items }
        }),
        'bad_request'
      );
    }

    await expectServiceError(
      storeTemplateService.createStoreTemplate({
        ...scopeOf(fixture),
        input: { name: '   ', items: [] }
      }),
      'bad_request'
    );
    await expectServiceError(
      storeTemplateService.createStoreTemplate({
        ...scopeOf(fixture),
        input: { name, items: [], storeId: store.id }
      }),
      'bad_request'
    );
    await expectServiceError(
      storeTemplateService.createStoreTemplate({ ...scopeOf(fixture), input: { name } }),
      'bad_request'
    );
    await expectServiceError(
      storeTemplateService.createStoreTemplate({
        instance: fixture.instance,
        input: { name, items: [] }
      }),
      'bad_request'
    );
    await expectServiceError(
      storeTemplateService.createStoreTemplate({
        ...scopeOf(fixture),
        input: { name, storeId: 'store_missing' }
      }),
      'not_found'
    );

    expect(await db.storeTemplate.count({ where: { name } })).toBe(0);
  });

  it('creates a standalone template with normalized paths and gets and lists it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let template = await createStandaloneTemplate(fixture);

    expect(template).toMatchObject({
      type: 'standalone',
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      sourceStoreOid: null
    });
    expect(template.items.map(item => [item.path, item.kind, item.encoding]).sort()).toEqual(
      [
        ['/assets/', 'directory', null],
        ['/assets/logo.bin', 'file', 'base64'],
        ['/empty.txt', 'file', 'utf_8'],
        ['/guide/intro.md', 'document', 'utf_8'],
        ['/readme.txt', 'file', 'utf_8']
      ].sort()
    );

    let fetched = await storeTemplateService.getStoreTemplateById({
      ...scopeOf(fixture),
      storeTemplateId: template.id
    });
    expect(fetched.items).toHaveLength(5);

    let listed = await firstPage(
      await storeTemplateService.listStoreTemplates({
        ...scopeOf(fixture),
        ids: [template.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([template.id]);
  });

  it('instantiates a store from a standalone template with byte-exact content', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createStandaloneTemplate(fixture);

    let store = await instantiate(fixture, template.id, { access: 'private' });

    expect(store).toMatchObject({
      parentStoreTemplateOid: template.oid,
      parentStoreOid: null,
      cloneType: null,
      access: 'public_read'
    });
    expect(await storePaths(store.id)).toEqual(instantiatedPaths);
    await expectConsistentItemCount(store.id);

    let logo = await itemAt(store.oid, '/assets/logo.bin');
    let logoContent = await readItemContent(fixture, logo.id);
    expect(Buffer.compare(logoContent, binaryContent)).toBe(0);

    let readme = await itemAt(store.oid, '/readme.txt');
    expect((await readItemContent(fixture, readme.id)).toString('utf8')).toBe(readmeContent);

    let empty = await itemAt(store.oid, '/empty.txt');
    expect((await readItemContent(fixture, empty.id)).byteLength).toBe(0);

    let intro = await storeItemService.getStoreItemById({
      ...scopeOf(fixture),
      authorization: privileged,
      itemId: (await itemAt(store.oid, '/guide/intro.md')).id
    });
    expect(intro.kind).toBe('document');
    expect(intro.document?.title).toBe('Intro');
    expect(intro.document?.content.content).toBe(documentContent);

    let fromTemplate = await firstPage(
      await storeService.listStores({
        ...scopeOf(fixture),
        authorization: privileged,
        parentStoreTemplateIds: [template.id]
      })
    );
    expect(fromTemplate.map(item => item.id)).toEqual([store.id]);
  });

  it('applies document title overrides when instantiating', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createStandaloneTemplate(fixture);

    let store = await instantiate(fixture, template.id, {
      titles: { '/guide/intro.md': 'Overridden' }
    });

    let intro = await storeItemService.getStoreItemById({
      ...scopeOf(fixture),
      authorization: privileged,
      itemId: (await itemAt(store.oid, '/guide/intro.md')).id
    });
    expect(intro.document?.title).toBe('Overridden');
    expect(intro.document?.content.content).toMatch(/^# Overridden/);
  });

  it('keeps instantiated stores unchanged when the template changes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createStandaloneTemplate(fixture);
    let store = await instantiate(fixture, template.id);

    let updated = await storeTemplateService.updateStoreTemplate({
      ...scopeOf(fixture),
      storeTemplate: template,
      input: {
        name: uniqueId('renamed-template'),
        items: [{ type: 'file', path: 'readme.txt', content: 'changed', encoding: 'utf-8' }]
      }
    });
    expect(updated.items.map(item => item.path)).toEqual(['/readme.txt']);
    expect(updated.items[0]?.content).toBe('changed');

    expect(await storePaths(store.id)).toEqual(instantiatedPaths);
    let readme = await itemAt(store.oid, '/readme.txt');
    expect((await readItemContent(fixture, readme.id)).toString('utf8')).toBe(readmeContent);
  });

  it('syncs a read-only backing store for the template instance through the queues', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createStandaloneTemplate(fixture);

    let { backing } = await waitForBackingSync(template.id);
    expect(backing.store).toMatchObject({
      isReadOnly: true,
      isTemplateBacking: true,
      access: 'public_read',
      parentStoreTemplateOid: template.oid,
      instanceOid: fixture.instance.oid
    });
    expect((await storePaths(backing.store.id)).filter(path => path !== '/')).toEqual(
      instantiatedPaths.filter(path => path !== '/')
    );

    let logo = await itemAt(backing.store.oid, '/assets/logo.bin');
    expect(Buffer.compare(await readItemContent(fixture, logo.id), binaryContent)).toBe(0);

    let fetched = await storeTemplateService.getStoreTemplateById({
      ...scopeOf(fixture),
      storeTemplateId: template.id
    });
    expect(fetched.storeId).toBe(backing.store.id);

    let listed = await firstPage(
      await storeService.listStores({
        ...scopeOf(fixture),
        authorization: privileged,
        parentStoreTemplateIds: [template.id]
      })
    );
    expect(listed).toEqual([]);

    await expectServiceError(
      modifyItems(fixture, backing.store, [{ type: 'add', path: 'intruder' }]),
      'bad_request'
    );

    let synced = await db.storeTemplate.findUniqueOrThrow({ where: { id: template.id } });
    await storeTemplateService.updateStoreTemplate({
      ...scopeOf(fixture),
      storeTemplate: fetched,
      input: {
        items: [
          ...templateItems().filter(item => item.path !== 'readme.txt'),
          { type: 'file', path: 'readme.txt', content: 'updated readme', encoding: 'utf-8' }
        ]
      }
    });

    await waitForBackingSync(template.id, synced.hash);
    let readme = await itemAt(backing.store.oid, '/readme.txt');
    expect((await readItemContent(fixture, readme.id)).toString('utf8')).toBe(
      'updated readme'
    );

    await storeTemplateService.deleteStoreTemplate({
      ...scopeOf(fixture),
      storeTemplateId: template.id
    });
    expect(await db.store.findUnique({ where: { id: backing.store.id } })).toBeNull();
    expect(await db.storeTemplate.findUnique({ where: { id: template.id } })).toBeNull();
  }, 240_000);

  it('instantiates a linked template by duplicating its source store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let source = await createStore(fixture);
    let { item: sourceFile, file } = await addFile(fixture, source, 'data/file.txt', {
      content: 'linked content'
    });
    await createDocument(fixture, {
      content: '# Linked doc',
      store: { id: source.id, path: 'doc.md' }
    });
    let template = await storeTemplateService.createStoreTemplate({
      ...scopeOf(fixture),
      input: { name: uniqueId('linked-template'), storeId: source.id }
    });
    expect(template).toMatchObject({ type: 'linked_store', sourceStoreOid: source.oid });

    let store = await instantiate(fixture, template.id);

    expect(store).toMatchObject({
      parentStoreOid: source.oid,
      parentStoreTemplateOid: template.oid,
      cloneType: 'duplicate',
      access: 'public_read'
    });
    expect(await storePaths(store.id)).toEqual(await storePaths(source.id));
    await expectConsistentItemCount(store.id);

    let replacement = await uploadFile(fixture, { content: 'changed at source' });
    await modifyItems(fixture, source, [{ itemId: sourceFile.id, fileId: replacement.id }]);

    let copied = await itemAt(store.oid, '/data/file.txt');
    expect(copied.fileOid).toBe(file.oid);
    expect((await readItemContent(fixture, copied.id)).toString('utf8')).toBe(
      'linked content'
    );

    let copiedDocument = await itemAt(store.oid, '/doc.md');
    let sourceDocument = await itemAt(source.oid, '/doc.md');
    expect(copiedDocument.documentOid).not.toBe(sourceDocument.documentOid);

    await expectServiceError(
      storeTemplateService.updateStoreTemplate({
        ...scopeOf(fixture),
        storeTemplate: await storeTemplateService.getStoreTemplateById({
          ...scopeOf(fixture),
          storeTemplateId: template.id
        }),
        input: { items: [] }
      }),
      'bad_request'
    );
  });

  it('keeps template-instantiated stores readable by everyone in the instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createStandaloneTemplate(fixture, []);
    let store = await instantiate(fixture, template.id);

    let updated = await storeService.updateStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      store,
      input: { access: 'private' }
    });
    expect(updated.access).toBe('public_read');

    let writable = await storeService.updateStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      store: updated,
      input: { access: 'public_write' }
    });
    expect(writable.access).toBe('public_write');
  });

  it.fails(
    'deletes a store instantiated from a template (bug: deleteStore treats parentStoreTemplateOid as a template link and no caller can pass allowLinkedStoreTemplateDelete)',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let template = await createStandaloneTemplate(fixture, []);
      let store = await instantiate(fixture, template.id);

      await storeService.deleteStore({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        store
      });

      expect(await db.store.findUnique({ where: { id: store.id } })).toBeNull();
    }
  );

  it('validates template updates', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createStandaloneTemplate(fixture, []);

    await expectServiceError(
      storeTemplateService.updateStoreTemplate({
        ...scopeOf(fixture),
        storeTemplate: template,
        input: {}
      }),
      'bad_request'
    );
    await expectServiceError(
      storeTemplateService.updateStoreTemplate({
        ...scopeOf(fixture),
        storeTemplate: template,
        input: { name: '  ' }
      }),
      'bad_request'
    );
    await expectServiceError(
      storeTemplateService.updateStoreTemplate({
        ...scopeOf(fixture),
        storeTemplate: template,
        input: {
          items: [
            { type: 'file', path: 'dup.txt', content: 'a', encoding: 'utf-8' },
            { type: 'file', path: 'dup.txt', content: 'b', encoding: 'utf-8' }
          ]
        }
      }),
      'bad_request'
    );

    expect(
      await db.storeTemplateItem.count({ where: { storeTemplateOid: template.oid } })
    ).toBe(0);
  });

  it('isolates templates from another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let template = await createStandaloneTemplate(fixture, [
      { type: 'file', path: 'secret.txt', content: 'secret', encoding: 'utf-8' }
    ]);
    let name = uniqueId('stolen');

    await expectServiceError(
      storeTemplateService.getStoreTemplateById({
        ...scopeOf(other),
        storeTemplateId: template.id
      }),
      'not_found'
    );

    let listed = await firstPage(
      await storeTemplateService.listStoreTemplates({ ...scopeOf(other) })
    );
    expect(listed.map(item => item.id)).not.toContain(template.id);

    await expectServiceError(
      storeService.createStoreFromTemplate({
        ...scopeOf(other),
        auditScope: other.auditScope,
        authorization: privileged,
        input: { templateId: template.id, name }
      }),
      'bad_request'
    );
    expect(await db.store.count({ where: { name } })).toBe(0);

    await expectServiceError(
      storeTemplateService.updateStoreTemplate({
        ...scopeOf(other),
        storeTemplate: template,
        input: { name }
      }),
      'bad_request'
    );
    await expectServiceError(
      storeTemplateService.deleteStoreTemplate({
        ...scopeOf(other),
        storeTemplateId: template.id
      }),
      'not_found'
    );

    let row = await db.storeTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(row.name).toBe(template.name);
  });

  it("refuses to link another organization's store into a template", async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let store = await createStore(fixture);
    let name = uniqueId('cross-tenant-template');

    await expectServiceError(
      storeTemplateService.createStoreTemplate({
        ...scopeOf(other),
        input: { name, storeId: store.id }
      }),
      'bad_request'
    );

    expect(await db.storeTemplate.count({ where: { name } })).toBe(0);
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).access).toBe(
      'private'
    );
  });
});
