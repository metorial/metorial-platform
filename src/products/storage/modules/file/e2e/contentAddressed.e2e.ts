import { hashBytes } from '@lowerdeck/hash/content';
import { ID } from '@metorial/db';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  cleanupDeletedFileStorage,
  deleteCargoObjectIfUnreferenced,
  fileLinkService,
  fileService,
  fileUploadService,
  getCargoFileContent,
  getCargoFilesBucketName,
  getStorage,
  uploadCargoFile
} from '../src';
import { streamedUploadHeadBytes } from '../src/lib/streamedFileWrite';
import {
  createStore,
  createWritableFile,
  objectExists,
  privileged,
  scopeOf,
  seedPendingUpload
} from './_fixtures';

let raceIterations = 50;

let uniqueBytes = (label: string) => new TextEncoder().encode(`${uniqueId(label)}\n`);

let writableUpload = (
  fixture: OrganizationFixture,
  input: { content: Uint8Array; fileName?: string; mimeType?: string }
) =>
  uploadCargoFile({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    purpose: 'generic',
    file: new Blob([input.content as BlobPart], {
      type: input.mimeType ?? 'application/octet-stream'
    }),
    fileName: input.fileName ?? `${uniqueId('cas')}.bin`,
    authorization: privileged
  });

let readContent = async (resolved: Awaited<ReturnType<typeof getCargoFileContent>>) => {
  if (resolved.type !== 'content') throw new Error(`Expected content, got ${resolved.type}`);
  return new Uint8Array(await new Response(resolved.content as BodyInit).arrayBuffer());
};

let expectStoredHashes = async (fileId: string, content: Uint8Array) => {
  let hashes = hashBytes(content);
  let row = await db.file.findUniqueOrThrow({ where: { id: fileId } });

  expect(row).toMatchObject({
    contentSha256: hashes.sha256,
    contentSha256StoreId: row.storeId,
    contentGitBlobSha: hashes.gitBlobSha,
    contentCrc32: BigInt(hashes.crc32)
  });
};

describe('module-file content-addressed storage', () => {
  let org = useOrganization();

  it('stores identical uploads under one content-addressed key with their hashes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = uniqueBytes('shared');
    let key = `sha256/${hashBytes(content).sha256}`;

    let first = await writableUpload(fixture, { content });
    let second = await fileService.createUploadedFile({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: 'generic',
      file: new Blob([content as BlobPart]),
      input: { name: `${uniqueId('readonly')}.bin`, authorization: privileged }
    });
    let streamed = await fileService.createUploadedFileFromByteStream({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: 'generic',
      content: (async function* () {
        yield content.subarray(0, 3);
        yield content.subarray(3);
      })(),
      input: { name: `${uniqueId('stream')}.bin`, authorization: privileged }
    });

    expect([first.storeId, second.storeId, streamed.storeId]).toEqual([key, key, key]);
    expect(await objectExists(key)).toBe(true);

    for (let file of [first, second, streamed]) await expectStoredHashes(file.id, content);
  });

  it('keeps a shared object until the last file using it is deleted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = uniqueBytes('refcount');

    let first = await writableUpload(fixture, { content });
    let second = await writableUpload(fixture, { content });
    expect(second.storeId).toBe(first.storeId);

    await fileService.deleteFile({ file: first, auditScope: fixture.auditScope });
    expect(await cleanupDeletedFileStorage({ fileId: first.id })).toBe(false);
    expect(
      await deleteCargoObjectIfUnreferenced({
        bucket: getCargoFilesBucketName(),
        key: first.storeId
      })
    ).toBe(false);
    expect(await objectExists(first.storeId)).toBe(true);
    expect(Buffer.from(await fileService.downloadFileContent({ file: second }))).toEqual(
      Buffer.from(content)
    );

    await fileService.deleteFile({ file: second, auditScope: fixture.auditScope });
    expect(await cleanupDeletedFileStorage({ fileId: second.id })).toBe(true);
    await eventually(async () => expect(await objectExists(second.storeId)).toBe(false));
  });

  it('never leaves an active file without its object when uploads race deletes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let survivors: Awaited<ReturnType<typeof writableUpload>>[] = [];

    for (let iteration = 0; iteration < raceIterations; iteration++) {
      let content = uniqueBytes(`race-${iteration}`);
      let doomed = await writableUpload(fixture, { content });

      let [, survivor] = await Promise.all([
        (async () => {
          await fileService.deleteFile({ file: doomed, auditScope: fixture.auditScope });
          await deleteCargoObjectIfUnreferenced({
            bucket: getCargoFilesBucketName(),
            key: doomed.storeId
          }).catch(() => false);
        })(),
        writableUpload(fixture, { content })
      ]);

      expect(survivor.storeId).toBe(doomed.storeId);
      expect(await objectExists(survivor.storeId), `iteration ${iteration}`).toBe(true);
      expect(await cleanupDeletedFileStorage({ fileId: doomed.id })).toBe(false);

      survivors.push(survivor);
    }

    for (let survivor of survivors) {
      let active = await db.file.findUniqueOrThrow({ where: { id: survivor.id } });
      expect(active.status).toBe('active');
      expect(await objectExists(active.storeId)).toBe(true);
    }

    for (let survivor of survivors) {
      await fileService.deleteFile({ file: survivor, auditScope: fixture.auditScope });
      await cleanupDeletedFileStorage({ fileId: survivor.id });
    }

    await eventually(async () => {
      for (let survivor of survivors) expect(await objectExists(survivor.storeId)).toBe(false);
    });
  });

  it('serves a shared object with each file’s own name and content type', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = uniqueBytes('served');

    let image = await writableUpload(fixture, {
      content,
      fileName: `${uniqueId('picture')}.png`,
      mimeType: 'image/png'
    });
    let archive = await writableUpload(fixture, {
      content,
      fileName: `${uniqueId('bundle')}.zip`,
      mimeType: 'application/zip'
    });
    expect(archive.storeId).toBe(image.storeId);

    let object = await getStorage().headObject(getCargoFilesBucketName(), image.storeId);
    expect(object.content_type).toBe('application/octet-stream');

    for (let file of [image, archive]) {
      let link = await fileLinkService.createFileLink({
        ...scopeOf(fixture),
        file,
        input: {}
      });
      let resolved = await getCargoFileContent({ fileId: file.id, key: link.key });

      expect(resolved.file).toMatchObject({ id: file.id, fileName: file.fileName });
      if (resolved.type !== 'content') throw new Error('expected content');
      expect(resolved.metadata.contentType).toBe(file.fileType);
      expect(await readContent(resolved)).toEqual(content);
    }
  });

  it('hashes signed-URL and stream uploads in the background', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let signedContent = uniqueBytes('signed');

    let upload = await seedPendingUpload(fixture, {
      size: signedContent.byteLength,
      content: signedContent,
      name: `${uniqueId('signed')}.bin`
    });
    let signed = await fileUploadService.completePendingUpload({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      uploadId: upload.id
    });
    expect(signed.storeId).toBe(upload.storeId);
    expect(signed.storeId.startsWith('sha256/')).toBe(false);

    let streamContent = uniqueBytes('produced');
    let pending = await fileService.createPendingUploadForStream();
    await getStorage().putObject(getCargoFilesBucketName(), pending.storeId, streamContent);
    let produced = await fileService.completePendingUploadForStream({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: 'generic',
      storeId: pending.storeId,
      input: { name: `${uniqueId('export')}.zip`, authorization: privileged }
    });

    await eventually(async () => {
      await expectStoredHashes(signed.id, signedContent);
      await expectStoredHashes(produced.id, streamContent);
    });
  });

  it('streams a byte stream too large to buffer to a unique key and hashes it in the background', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let size = streamedUploadHeadBytes + 3 * 1024 * 1024 + 17;
    let content = new Uint8Array(size);
    for (let i = 0; i < size; i++) content[i] = (i * 31 + 7) % 256;
    content.set(uniqueBytes('large'));

    let file = await fileService.createUploadedFileFromByteStream({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: 'generic',
      content: (async function* () {
        for (let offset = 0; offset < size; offset += 1024 * 1024 + 3) {
          yield content.subarray(offset, offset + 1024 * 1024 + 3);
        }
      })(),
      input: {
        name: `${uniqueId('large')}.bin`,
        mimeType: 'application/x-large',
        authorization: privileged
      }
    });

    expect(file.storeId.startsWith('sha256/')).toBe(false);
    expect(file.fileSize).toBe(BigInt(size));
    expect(file.fileType).toBe('application/x-large');
    expect(
      await db.filePendingContent.findUnique({ where: { fileOid: file.oid } })
    ).toBeNull();

    let hashes = hashBytes(content);
    let stored = await getStorage().getObjectDigests(getCargoFilesBucketName(), file.storeId);
    expect(stored.digests).toEqual({
      size,
      sha256: hashes.sha256,
      crc32: hashes.crc32,
      git_blob_sha1: hashes.gitBlobSha
    });
    expect(Buffer.from(await fileService.downloadFileContent({ file })).equals(content)).toBe(
      true
    );

    await eventually(async () => await expectStoredHashes(file.id, content));
  });

  it('does not hash a produced archive whose caller opts out', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let produce = async (skipContentHashes: boolean) => {
      let content = uniqueBytes('archive');
      let pending = await fileService.createPendingUploadForStream();
      await getStorage().putObject(getCargoFilesBucketName(), pending.storeId, content);
      let file = await fileService.completePendingUploadForStream({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        purpose: 'generic',
        storeId: pending.storeId,
        skipContentHashes,
        input: { name: `${uniqueId('export')}.zip`, authorization: privileged }
      });
      return { file, content };
    };

    let skipped = await produce(true);
    let hashed = await produce(false);

    await eventually(async () => {
      await expectStoredHashes(hashed.file.id, hashed.content);
    });
    expect(await db.file.findUniqueOrThrow({ where: { id: skipped.file.id } })).toMatchObject({
      contentSha256: null,
      contentGitBlobSha: null,
      contentCrc32: null
    });
  });

  it('backfills missing hashes for files in skill stores only', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    await db.skill.create({
      data: {
        id: await ID.generateId('skill'),
        name: uniqueId('Backfill Skill'),
        storeId: store.id,
        skillEntityId: uniqueId('skill-entity'),
        organizationOid: fixture.organization.oid,
        projectOid: fixture.project.oid,
        instanceOid: fixture.instance.oid,
        storeOid: store.oid
      }
    });

    let legacyContent = uniqueId('legacy');
    let legacy = await createWritableFile(fixture, {
      content: legacyContent,
      store: { id: store.id, path: `/${uniqueId('legacy')}.dat` }
    });
    let partialContent = uniqueId('sha-only');
    let partial = await createWritableFile(fixture, {
      content: partialContent,
      store: { id: store.id, path: `/${uniqueId('partial')}.dat` }
    });
    await db.file.update({
      where: { oid: partial.oid },
      data: { contentSha256: 'stale', contentSha256StoreId: partial.storeId }
    });
    let outside = await createWritableFile(fixture, { content: uniqueId('outside') });

    await fileService.requestContentHashBackfill({ instance: fixture.instance });

    await eventually(async () => {
      await expectStoredHashes(legacy.id, new TextEncoder().encode(legacyContent));
      await expectStoredHashes(partial.id, new TextEncoder().encode(partialContent));
    });

    let untouched = await db.file.findUniqueOrThrow({ where: { id: outside.id } });
    expect(untouched.contentGitBlobSha).toBeNull();
  });
});
