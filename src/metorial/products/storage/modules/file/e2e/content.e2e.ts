import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  fileLinkService,
  filePurposeService,
  fileService,
  flushPendingFileContent,
  maxDirectUploadSize,
  purposeSlugs,
  sandboxImageBuildContextMaxBytes,
  uploadCargoFile
} from '../src';
import { pendingFileContentConfig } from '../src/lib/pendingFileContent';
import {
  allByteValues,
  createWritableFile,
  objectExists,
  privileged,
  scopeOf,
  uploadBytes
} from './_fixtures';

describe('module-file content', () => {
  let org = useOrganization();

  let directUpload = (
    fixture: OrganizationFixture,
    input: { file: Blob; fileName: string; purpose?: string }
  ) =>
    uploadCargoFile({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: input.purpose ?? 'generic',
      file: input.file,
      fileName: input.fileName,
      authorization: privileged
    });

  let createSizedFile = (fixture: OrganizationFixture, purpose: string, size: number) =>
    fileService.createFile({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose,
      storeId: uniqueId('sized-object'),
      input: {
        name: `${uniqueId('sized')}.tar`,
        mimeType: 'application/x-tar',
        size,
        authorization: privileged
      }
    });

  it('round-trips binary content through object storage byte for byte', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = allByteValues();

    let file = await uploadBytes(fixture, { content, name: `${uniqueId('bytes')}.bin` });
    expect(file.fileSize).toBe(256);
    expect(file.fileType).toBe('application/octet-stream');
    expect(await db.filePendingContent.count({ where: { fileOid: file.oid } })).toBe(0);

    expect(await fileService.resolveFileContentSource({ file })).toMatchObject({
      type: 'object',
      key: file.storeId
    });
    expect(new Uint8Array(await fileService.downloadFileContent({ file }))).toEqual(content);
  });

  it('round-trips empty files, buffered and in object storage', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let text = await uploadBytes(fixture, {
      content: '',
      name: `${uniqueId('empty')}.txt`,
      mimeType: 'text/plain'
    });
    expect(text.fileSize).toBe(0);
    expect(await fileService.resolveFileContentSource({ file: text })).toMatchObject({
      type: 'inline'
    });
    expect((await fileService.downloadFileContent({ file: text })).byteLength).toBe(0);

    let binary = await uploadBytes(fixture, {
      content: new Uint8Array(0),
      name: `${uniqueId('empty')}.bin`
    });
    expect(binary.fileSize).toBe(0);
    expect(await objectExists(binary.storeId)).toBe(true);
    expect((await fileService.downloadFileContent({ file: binary })).byteLength).toBe(0);
  });

  it('buffers small text files until their content is flushed to object storage', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = `# notes\n\n${uniqueId('buffered')} ünïcödé ✓`;

    let file = await uploadBytes(fixture, {
      content,
      name: `${uniqueId('notes')}.md`,
      mimeType: 'text/markdown'
    });
    expect(file.fileSize).toBe(Buffer.byteLength(content));
    expect(await objectExists(file.storeId)).toBe(false);

    expect(await flushPendingFileContent({ fileId: file.id })).toBe(false);
    expect(await db.filePendingContent.count({ where: { fileOid: file.oid } })).toBe(1);

    await db.filePendingContent.update({
      where: { fileOid: file.oid },
      data: { flushAfter: new Date(Date.now() - 1000) }
    });
    expect(await flushPendingFileContent({ fileId: file.id })).toBe(true);

    expect(await db.filePendingContent.count({ where: { fileOid: file.oid } })).toBe(0);
    expect(await objectExists(file.storeId)).toBe(true);
    expect(await fileService.resolveFileContentSource({ file })).toMatchObject({
      type: 'object',
      key: file.storeId
    });
    expect((await fileService.downloadFileContent({ file })).toString('utf8')).toBe(content);
  });

  it('stores text files at the buffering limit in object storage right away', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = 'a'.repeat(pendingFileContentConfig.maxBufferedFileSize);

    let file = await uploadBytes(fixture, {
      content,
      name: `${uniqueId('large')}.txt`,
      mimeType: 'text/plain'
    });

    expect(await db.filePendingContent.count({ where: { fileOid: file.oid } })).toBe(0);
    expect(await objectExists(file.storeId)).toBe(true);
    expect((await fileService.downloadFileContent({ file })).byteLength).toBe(content.length);
  });

  it('assembles byte-stream uploads from their chunks', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chunks = [Uint8Array.of(0, 1, 2), new Uint8Array(0), Uint8Array.of(253, 254, 255)];

    let file = await fileService.createUploadedFileFromByteStream({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: 'generic',
      content: (async function* () {
        yield* chunks;
      })(),
      input: { name: `${uniqueId('stream')}.bin`, authorization: privileged }
    });

    expect(file.fileSize).toBe(6);
    expect(file.isReadOnly).toBe(true);
    expect([...(await fileService.downloadFileContent({ file }))]).toEqual([
      0, 1, 2, 253, 254, 255
    ]);
  });

  it('rejects direct uploads above the direct upload limit with a hint', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let oversized = new Blob(['x']);
    Object.defineProperty(oversized, 'size', { value: maxDirectUploadSize + 1 });
    let name = `${uniqueId('oversized')}.bin`;

    let error = await expectServiceError(
      directUpload(fixture, { file: oversized, fileName: name }),
      'bad_request'
    );
    expect(error.message).toMatch(/at most 100 MB/);
    expect(error.hint).toMatch(/get_upload_url/);
    expect(await db.file.count({ where: { fileName: name } })).toBe(0);
  });

  it('keeps direct uploads writable and clears buffered content on delete', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = uniqueId('direct');

    let file = await directUpload(fixture, {
      file: new Blob([content], { type: 'text/plain' }),
      fileName: `${uniqueId('direct')}.txt`
    });
    expect(file.isReadOnly).toBe(false);
    expect(file.fileType).toMatch(/^text\/plain/);
    expect((await fileService.downloadFileContent({ file })).toString('utf8')).toBe(content);

    let deleted = await fileService.deleteFile({ file, auditScope: fixture.auditScope });
    expect(deleted.status).toBe('deleted');
    expect(deleted.storeId).toBe('');
    expect(await db.filePendingContent.count({ where: { fileOid: file.oid } })).toBe(0);
  });

  it('registers every file purpose and resolves purposes by id or slug', async () => {
    for (let slug of purposeSlugs) {
      let purpose = await filePurposeService.getFilePurposeById({ id: slug });
      expect(purpose.slug).toBe(slug);
      expect((await filePurposeService.getFilePurposeById({ id: purpose.id })).slug).toBe(
        slug
      );
    }

    let generic = await filePurposeService.ensureGenericFilePurpose();
    expect(generic).toMatchObject({
      slug: 'generic',
      ownerType: 'instance',
      canHaveLinks: true
    });

    await expectServiceError(
      filePurposeService.getFilePurposeById({ id: uniqueId('purpose') }),
      'not_found'
    );
  });

  it('enforces purpose rules on size, links and the document purpose', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    await filePurposeService.ensureDocumentFilePurpose();

    let document = await expectServiceError(
      uploadBytes(fixture, { content: 'doc', name: 'doc.bin', purpose: 'document' }),
      'bad_request'
    );
    expect(document.message).toMatch(/Document purpose cannot be used/);

    let tooLarge = await expectServiceError(
      createSizedFile(
        fixture,
        'sandbox_image_build_context',
        sandboxImageBuildContextMaxBytes + 1
      ),
      'bad_request'
    );
    expect(tooLarge.message).toMatch(/at most 50 MB/);

    let atLimit = await createSizedFile(
      fixture,
      'sandbox_image_build_context',
      sandboxImageBuildContextMaxBytes
    );
    expect(atLimit.fileSize).toBe(sandboxImageBuildContextMaxBytes);

    let link = await expectServiceError(
      fileLinkService.createFileLink({ ...scopeOf(fixture), file: atLimit, input: {} }),
      'forbidden'
    );
    expect(link.message).toBe('File purpose does not allow creating links');
    expect(await db.fileLink.count({ where: { fileOid: atLimit.oid } })).toBe(0);

    let generic = await createSizedFile(
      fixture,
      'generic',
      sandboxImageBuildContextMaxBytes + 1
    );
    expect(generic.status).toBe('active');
  });

  it('does not restrict MIME types per purpose', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let file = await uploadBytes(fixture, {
      content: 'MZ',
      name: `${uniqueId('program')}.exe`,
      mimeType: 'application/x-msdownload',
      purpose: 'chat_message_attachment'
    });

    expect(file.fileType).toBe('application/x-msdownload');
    expect(file.purpose.slug).toBe('chat_message_attachment');
  });

  it('protects read-only and deleted files from changes and downloads', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let readOnly = await uploadBytes(fixture, { content: 'read only' });
    let updateReadOnly = await expectServiceError(
      fileService.updateFile({ file: readOnly, input: { title: 'nope' } }),
      'forbidden'
    );
    expect(updateReadOnly.message).toBe(`File ${readOnly.id} is read-only`);
    await expectServiceError(
      fileService.deleteFile({ file: readOnly, auditScope: fixture.auditScope }),
      'forbidden'
    );
    expect((await db.file.findUniqueOrThrow({ where: { id: readOnly.id } })).status).toBe(
      'active'
    );

    let writable = await createWritableFile(fixture);
    let deleted = await fileService.deleteFile({
      file: writable,
      auditScope: fixture.auditScope
    });
    expect(deleted.storeId).toBe(writable.storeId);

    for (let call of [
      () => fileService.downloadFileContent({ file: deleted }),
      () => fileService.resolveFileContentSource({ file: deleted }),
      () => fileService.updateFile({ file: deleted, input: { title: 'gone' } }),
      () => fileService.deleteFile({ file: deleted, auditScope: fixture.auditScope })
    ]) {
      let error = await expectServiceError(call(), 'forbidden');
      expect(error.message).toBe('Cannot perform this action on a deleted file');
    }
  });
});
