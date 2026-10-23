import { generatePlainId } from '@lowerdeck/id';
import {
  eventually,
  expectServiceError,
  rejectionOf,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import {
  cleanupDeletedFileStorage,
  fileExpirationSingleQueue,
  fileLinkService,
  filePurposeService,
  fileService,
  getCargoFilesBucketName,
  getStorage,
  listDeletedFilesWithStorage,
  reconcileService
} from '../src';
import {
  createStore,
  createWritableFile,
  linkFile,
  objectExists,
  referenceLink,
  scopeOf
} from './_fixtures';

let putObject = async (content: string) => {
  let storeId = generatePlainId(20);
  await getStorage().putObject(getCargoFilesBucketName(), storeId, content, 'text/plain');
  return storeId;
};

let reconcileOne = async (
  fixture: OrganizationFixture,
  input: Parameters<typeof reconcileService.reconcileFiles>[0]['inputs'][number]
) => {
  let [item] = await reconcileService.reconcileFiles({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    inputs: [input]
  });
  return item!;
};

let listsForCleanup = async (fileId: string) => {
  let cursor: string | undefined;

  while (true) {
    let page = await listDeletedFilesWithStorage({ cursor, limit: 500 });
    if (page.some(file => file.id === fileId)) return true;
    if (page.length < 500) return false;
    cursor = page[page.length - 1]!.id;
  }
};

describe('module-file reconcile and background jobs', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('reconciles files, links and references idempotently and prunes what is gone', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let storeId = await putObject('reconciled');
    let fileId = await ID.generateId('file');
    let keepKey = `${uniqueId('keep')}_dev`;
    let dropKey = `${uniqueId('drop')}_dev`;
    let base = {
      id: fileId,
      storeId,
      purpose: 'generic',
      name: 'reconciled.dat',
      mimeType: 'text/plain',
      size: 10
    };

    let first = await reconcileOne(fixture, {
      ...base,
      links: [
        {
          key: keepKey,
          references: [
            { entityType: 'e2e_reconcile', entityId: 'keep' },
            { entityType: 'e2e_reconcile', entityId: 'drop' }
          ]
        },
        { key: dropKey }
      ]
    });
    expect(first.file).toMatchObject({ id: fileId, status: 'active', storeId });
    expect(first.links).toHaveLength(2);
    expect(first.links[0]!.references).toHaveLength(2);

    let second = await reconcileOne(fixture, {
      ...base,
      links: [
        {
          key: keepKey,
          references: [
            { entityType: 'e2e_reconcile', entityId: 'keep' },
            { entityType: 'e2e_reconcile', entityId: 'drop' }
          ]
        },
        { key: dropKey }
      ]
    });
    expect(second.links.map(item => item.link.id)).toEqual(
      first.links.map(item => item.link.id)
    );
    expect(second.links[0]!.references.map(reference => reference.id)).toEqual(
      first.links[0]!.references.map(reference => reference.id)
    );
    expect(await db.file.count({ where: { id: fileId } })).toBe(1);

    let keptReference = first.links[0]!.references[0]!;
    let pruned = await reconcileOne(fixture, {
      ...base,
      title: 'Pruned',
      links: [
        { key: keepKey, references: [{ entityType: 'e2e_reconcile', entityId: 'keep' }] }
      ]
    });
    expect(pruned.file.title).toBe('Pruned');
    expect(pruned.links[0]!.references.map(reference => reference.id)).toEqual([
      keptReference.id
    ]);
    expect(await db.fileLink.count({ where: { fileOid: first.file.oid } })).toBe(1);
    expect(await db.fileLink.count({ where: { key: dropKey } })).toBe(0);
    expect(
      await db.fileReference.count({ where: { fileLink: { fileOid: first.file.oid } } })
    ).toBe(1);

    let deleted = await reconcileOne(fixture, { ...base, status: 'deleted', links: [] });
    expect(deleted.file.status).toBe('deleted');
    expect(await db.fileLink.count({ where: { fileOid: first.file.oid } })).toBe(0);
    expect(
      await db.fileReference.count({ where: { fileLink: { fileOid: first.file.oid } } })
    ).toBe(0);
  });

  it('does not let another tenant take over a file by reconciling its id', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let file = await createWritableFile(fixture, { content: 'owned' });
    let foreignStoreId = await putObject('hijacked');

    await rejectionOf(
      reconcileOne(otherFixture, {
        id: file.id,
        storeId: foreignStoreId,
        purpose: 'generic',
        name: 'hijacked.dat',
        mimeType: 'text/plain',
        size: 8
      })
    );

    let unchanged = await db.file.findUniqueOrThrow({ where: { id: file.id } });
    expect(unchanged).toMatchObject({
      instanceOid: fixture.instance.oid,
      storeId: file.storeId,
      fileName: file.fileName
    });
  });

  it('upserts purposes by slug', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let slug = uniqueId('e2e-purpose');

    let [created] = await reconcileService.reconcilePurposes({
      inputs: [{ slug, name: 'E2E Purpose', ownerType: 'instance', canHaveLinks: false }]
    });
    expect(created).toMatchObject({ slug, name: 'E2E Purpose', canHaveLinks: false });

    let file = await fileService.createFile({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: slug,
      storeId: await putObject('purposed'),
      input: {
        name: 'purposed.dat',
        mimeType: 'text/plain',
        size: 8,
        authorization: { type: 'privileged' }
      }
    });
    await expectServiceError(
      fileLinkService.createFileLink({ ...scopeOf(fixture), file, input: {} }),
      'forbidden'
    );

    let [updated] = await reconcileService.reconcilePurposes({
      inputs: [{ slug, name: 'E2E Purpose v2', ownerType: 'instance', canHaveLinks: true }]
    });
    expect(updated!.id).toBe(created!.id);
    expect((await filePurposeService.getFilePurposeById({ id: slug })).name).toBe(
      'E2E Purpose v2'
    );

    let reloaded = await fileService.getFileById({
      ...scopeOf(fixture),
      fileId: file.id,
      authorization: { type: 'privileged' }
    });
    let link = await fileLinkService.createFileLink({
      ...scopeOf(fixture),
      file: reloaded,
      input: {}
    });
    expect(link.file.id).toBe(file.id);
  });

  it('cleans up deleted file storage only once no active file shares the object', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let storeId = await putObject('shared object');
    let shared = { storeId, purpose: 'generic', mimeType: 'text/plain', size: 13 };

    let [first, second] = await reconcileService.reconcileFiles({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      inputs: [
        { ...shared, id: await ID.generateId('file'), name: 'first.dat' },
        { ...shared, id: await ID.generateId('file'), name: 'second.dat' }
      ]
    });

    await fileService.deleteFile({ file: first!.file, auditScope: fixture.auditScope });
    expect(await cleanupDeletedFileStorage({ fileId: first!.file.id })).toBe(false);
    expect(await objectExists(storeId)).toBe(true);

    expect(await cleanupDeletedFileStorage({ fileId: second!.file.id })).toBe(false);

    await fileService.deleteFile({ file: second!.file, auditScope: fixture.auditScope });

    expect(await listsForCleanup(first!.file.id)).toBe(true);
    expect(await listsForCleanup(second!.file.id)).toBe(true);

    expect(await cleanupDeletedFileStorage({ fileId: second!.file.id })).toBe(true);
    await eventually(async () => expect(await objectExists(storeId)).toBe(false));
  });

  it('expires files and removes their links, references and store entries', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);

    let expiring = await createWritableFile(fixture, {
      store: { id: store.id, path: `/${uniqueId('expiring')}.dat` }
    });
    let fresh = await createWritableFile(fixture);
    let link = await linkFile(fixture, expiring);
    await referenceLink(fixture, link);

    await db.file.update({
      where: { oid: expiring.oid },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });
    await db.file.update({
      where: { oid: fresh.oid },
      data: { expiresAt: new Date(Date.now() + 60 * 60_000) }
    });

    await fileExpirationSingleQueue.add({ fileId: fresh.id }, { id: fresh.id });
    await fileExpirationSingleQueue.add({ fileId: expiring.id }, { id: expiring.id });

    await eventually(async () =>
      expect((await db.file.findUniqueOrThrow({ where: { oid: expiring.oid } })).status).toBe(
        'deleted'
      )
    );

    expect(await db.fileLink.count({ where: { fileOid: expiring.oid } })).toBe(0);
    expect(
      await db.fileReference.count({ where: { fileLink: { fileOid: expiring.oid } } })
    ).toBe(0);
    expect(
      await db.storeItem.count({ where: { storeOid: store.oid, fileOid: expiring.oid } })
    ).toBe(0);
    expect((await db.file.findUniqueOrThrow({ where: { oid: fresh.oid } })).status).toBe(
      'active'
    );
  });
});
