import { eventually, expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  cleanupFileUpload,
  filePurposeService,
  fileService,
  fileUploadService,
  listAbandonedFileUploads,
  maxUploadSize,
  sandboxImageBuildContextMaxBytes
} from '../src';
import {
  allByteValues,
  createStore,
  objectExists,
  privileged,
  scopeOf,
  seedPendingUpload
} from './_fixtures';

describe('module-file pending uploads', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createPendingUpload = (
    fixture: OrganizationFixture,
    input: { name?: string; size?: number; purpose?: string; storeId?: string }
  ) =>
    fileUploadService.createPendingUpload({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: input.purpose ?? 'generic',
      authorization: privileged,
      input: {
        name: input.name ?? `${uniqueId('pending')}.bin`,
        size: input.size ?? 16,
        store: input.storeId ? { id: input.storeId, path: '/upload.bin' } : undefined
      }
    });

  let complete = (fixture: OrganizationFixture, uploadId: string) =>
    fileUploadService.completePendingUpload({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      uploadId
    });

  let uploadCount = async (fixture: OrganizationFixture) =>
    await db.fileUpload.count({ where: { instanceOid: fixture.instance.oid } });

  it('validates a pending upload before asking storage for an upload URL', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let foreignStore = await createStore(otherFixture);
    let before = await uploadCount(fixture);

    let blankName = await expectServiceError(
      createPendingUpload(fixture, { name: '   ' }),
      'bad_request'
    );
    expect(blankName.message).toBe('File name is required');

    for (let size of [-1, 1.5, Number.NaN]) {
      let invalid = await expectServiceError(
        createPendingUpload(fixture, { size }),
        'bad_request'
      );
      expect(invalid.message).toMatch(/whole number of zero or more/);
    }

    let tooLarge = await expectServiceError(
      createPendingUpload(fixture, { size: maxUploadSize + 1 }),
      'bad_request'
    );
    expect(tooLarge.message).toMatch(/at most 2 GB/);

    await filePurposeService.ensureDocumentFilePurpose();
    let documentPurpose = await expectServiceError(
      createPendingUpload(fixture, { purpose: 'document' }),
      'bad_request'
    );
    expect(documentPurpose.message).toMatch(/Document purpose cannot be used/);

    await expectServiceError(
      createPendingUpload(fixture, { purpose: uniqueId('missing-purpose') }),
      'not_found'
    );

    let buildContext = await expectServiceError(
      createPendingUpload(fixture, {
        purpose: 'sandbox_image_build_context',
        size: sandboxImageBuildContextMaxBytes + 1
      }),
      'bad_request'
    );
    expect(buildContext.message).toMatch(/at most 50 MB/);

    await expectServiceError(
      createPendingUpload(fixture, { storeId: foreignStore.id }),
      'not_found'
    );

    expect(await uploadCount(fixture)).toBe(before);
  });

  it('creates a pending upload with a signed upload URL', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = `${uniqueId('signed')}.bin`;

    let { upload, uploadUrl } = await createPendingUpload(fixture, { name, size: 16 });

    expect(() => new URL(uploadUrl)).not.toThrow();
    expect(upload.fileName).toBe(name);
    expect(upload.fileSize).toBe(16);

    let row = await db.fileUpload.findFirst({ where: { id: upload.id } });
    expect(row?.instanceOid).toBe(fixture.instance.oid);
    expect(row?.storeId).toBe(upload.storeId);
  });

  it('completes an uploaded object into an active file holding the exact bytes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = allByteValues();
    let upload = await seedPendingUpload(fixture, {
      size: content.byteLength,
      content,
      name: `${uniqueId('binary')}.bin`
    });

    let file = await complete(fixture, upload.id);
    expect(file).toMatchObject({
      status: 'active',
      fileName: upload.fileName,
      fileSize: content.byteLength,
      fileType: 'application/octet-stream',
      storeId: upload.storeId,
      isReadOnly: false
    });
    expect(file.purpose.slug).toBe('generic');

    let stored = await db.fileUpload.findUniqueOrThrow({ where: { id: upload.id } });
    expect(stored.status).toBe('completed');
    expect(stored.fileOid).toBe(file.oid);
    expect(await db.filePendingContent.count({ where: { fileOid: file.oid } })).toBe(0);

    let downloaded = await fileService.downloadFileContent({ file });
    expect(new Uint8Array(downloaded)).toEqual(content);

    let again = await complete(fixture, upload.id);
    expect(again.id).toBe(file.id);
    expect(await db.file.count({ where: { storeId: upload.storeId } })).toBe(1);
  });

  it('discards an object whose size differs from the declared size', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let upload = await seedPendingUpload(fixture, { size: 10, content: 'short' });

    let mismatch = await expectServiceError(complete(fixture, upload.id), 'bad_request');
    expect(mismatch.message).toBe('Uploaded content is 5 bytes but 10 bytes were declared');
    expect(await objectExists(upload.storeId)).toBe(false);

    let stored = await db.fileUpload.findUniqueOrThrow({ where: { id: upload.id } });
    expect(stored.status).toBe('pending');
    expect(stored.fileOid).toBeNull();

    let retried = await expectServiceError(complete(fixture, upload.id), 'bad_request');
    expect(retried.message).toMatch(/No content has been uploaded/);
  });

  it('rejects completing an upload whose content never arrived', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let upload = await seedPendingUpload(fixture, { size: 4 });

    let error = await expectServiceError(complete(fixture, upload.id), 'bad_request');
    expect(error.message).toBe(`No content has been uploaded for file upload ${upload.id}`);
    expect(await db.file.count({ where: { storeId: upload.storeId } })).toBe(0);
  });

  it('rejects expired uploads', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let upload = await seedPendingUpload(fixture, {
      size: 4,
      content: 'late',
      expiresAt: new Date(Date.now() - 60_000)
    });

    let completed = await expectServiceError(complete(fixture, upload.id), 'bad_request');
    expect(completed.message).toBe(`File upload ${upload.id} has expired`);

    let canceled = await expectServiceError(
      fileUploadService.cancelPendingUpload({ ...scopeOf(fixture), uploadId: upload.id }),
      'bad_request'
    );
    expect(canceled.message).toBe(`File upload ${upload.id} has expired`);
    expect(await db.file.count({ where: { storeId: upload.storeId } })).toBe(0);
  });

  it('cancels an upload, refuses to complete it, and deletes its object', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let upload = await seedPendingUpload(fixture, { size: 6, content: 'cancel' });

    let canceled = await fileUploadService.cancelPendingUpload({
      ...scopeOf(fixture),
      uploadId: upload.id
    });
    expect(canceled.status).toBe('canceled');

    let completed = await expectServiceError(complete(fixture, upload.id), 'bad_request');
    expect(completed.message).toBe(
      `File upload ${upload.id} is canceled and can no longer be used`
    );

    await expectServiceError(
      fileUploadService.cancelPendingUpload({ ...scopeOf(fixture), uploadId: upload.id }),
      'bad_request'
    );

    await eventually(async () => expect(await objectExists(upload.storeId)).toBe(false));
    expect(await db.file.count({ where: { storeId: upload.storeId } })).toBe(0);
  });

  it('expires abandoned uploads and keeps the objects of completed ones', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let abandoned = await seedPendingUpload(fixture, {
      size: 9,
      content: 'abandoned',
      expiresAt: new Date(Date.now() - 60_000)
    });
    let fresh = await seedPendingUpload(fixture, { size: 5, content: 'fresh' });
    let finished = await seedPendingUpload(fixture, { size: 8, content: 'finished' });
    await complete(fixture, finished.id);

    let abandonedIds = (await listAbandonedFileUploads({ limit: 500 })).map(item => item.id);
    expect(abandonedIds).toContain(abandoned.id);
    expect(abandonedIds).not.toContain(fresh.id);
    expect(abandonedIds).not.toContain(finished.id);

    expect(await cleanupFileUpload({ fileUploadId: abandoned.id })).toBe(true);
    expect(
      (await db.fileUpload.findUniqueOrThrow({ where: { id: abandoned.id } })).status
    ).toBe('expired');
    await eventually(async () => expect(await objectExists(abandoned.storeId)).toBe(false));

    expect(await cleanupFileUpload({ fileUploadId: fresh.id })).toBe(false);
    expect(await cleanupFileUpload({ fileUploadId: finished.id })).toBe(false);
    expect(await objectExists(fresh.storeId)).toBe(true);
    expect(await objectExists(finished.storeId)).toBe(true);
  });

  it('hides pending uploads from other tenants', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let upload = await seedPendingUpload(fixture, { size: 7, content: 'private' });

    await expectServiceError(
      fileUploadService.getPendingUploadById({
        ...scopeOf(otherFixture),
        uploadId: upload.id
      }),
      'not_found'
    );
    await expectServiceError(complete(otherFixture, upload.id), 'not_found');
    await expectServiceError(
      fileUploadService.cancelPendingUpload({ ...scopeOf(otherFixture), uploadId: upload.id }),
      'not_found'
    );

    let stored = await db.fileUpload.findUniqueOrThrow({ where: { id: upload.id } });
    expect(stored.status).toBe('pending');

    let own = await fileUploadService.getPendingUploadById({
      ...scopeOf(fixture),
      uploadId: upload.id
    });
    expect(own.id).toBe(upload.id);
  });
});
