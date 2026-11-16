import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import {
  createSignedFileDownloadKey,
  fileDownloadService,
  fileLinkService,
  fileService,
  getCargoFileContent
} from '../src';
import {
  allByteValues,
  createWritableFile,
  linkFile,
  scopeOf,
  uploadBytes
} from './_fixtures';

let readContent = async (resolved: Awaited<ReturnType<typeof getCargoFileContent>>) => {
  if (resolved.type !== 'content') throw new Error(`Expected content, got ${resolved.type}`);
  return new Uint8Array(await new Response(resolved.content as BodyInit).arrayBuffer());
};

describe('module-file links', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('serves a link only for its own file and only until it expires', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = allByteValues();
    let file = await uploadBytes(fixture, { content });
    let otherFile = await uploadBytes(fixture, { content: 'other file' });

    let link = await linkFile(fixture, file, {
      expiresAt: new Date(Date.now() + 60 * 60_000)
    });
    expect(link.key).toMatch(/_dev$/);
    expect(link.file.id).toBe(file.id);
    expect(
      await readContent(await getCargoFileContent({ fileId: file.id, key: link.key }))
    ).toEqual(content);

    await expectServiceError(
      getCargoFileContent({ fileId: otherFile.id, key: link.key }),
      'not_found'
    );
    await expectServiceError(
      fileLinkService.getFileLinkByKey({ fileId: otherFile.id, key: link.key }),
      'not_found'
    );

    await fileLinkService.updateFileLinkExpiry({
      fileLink: link,
      expiresAt: new Date(Date.now() - 1000)
    });
    let expired = await expectServiceError(
      getCargoFileContent({ fileId: file.id, key: link.key }),
      'bad_request'
    );
    expect(expired.message).toBe('Link has expired');

    await fileLinkService.updateFileLinkExpiry({
      fileLink: link,
      expiresAt: new Date(Date.now() + 60_000)
    });
    let renewed = await getCargoFileContent({ fileId: file.id, key: link.key });
    expect(renewed.link.expiresAt).toBeInstanceOf(Date);
    expect(await readContent(renewed)).toEqual(content);
  });

  it('revokes links and stops resolving the links of deleted files', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let revokedFile = await createWritableFile(fixture);
    let revoked = await linkFile(fixture, revokedFile);
    await fileLinkService.deleteFileLink({ fileLink: revoked });
    expect(await db.fileLink.count({ where: { id: revoked.id } })).toBe(0);
    await expectServiceError(
      getCargoFileContent({ fileId: revokedFile.id, key: revoked.key }),
      'not_found'
    );

    let deletedFile = await createWritableFile(fixture);
    let orphaned = await linkFile(fixture, deletedFile);
    await fileService.deleteFile({ file: deletedFile, auditScope: fixture.auditScope });
    await expectServiceError(
      getCargoFileContent({ fileId: deletedFile.id, key: orphaned.key }),
      'not_found'
    );
    await expectServiceError(
      fileLinkService.getFileLinkByKey({ fileId: deletedFile.id, key: orphaned.key }),
      'not_found'
    );
    await expectServiceError(
      fileDownloadService.getFileByDownloadKey({ fileId: deletedFile.id, key: orphaned.key }),
      'not_found'
    );
  });

  it('resolves signed download keys only for the file content they were issued for', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let file = await uploadBytes(fixture, { content: 'signed v1' });
    let otherFile = await uploadBytes(fixture, { content: 'signed other' });

    let key = await createSignedFileDownloadKey(file);
    expect(key).toMatch(/_dev$/);

    let resolved = await getCargoFileContent({ fileId: file.id, key });
    expect(Buffer.from(await readContent(resolved)).toString()).toBe('signed v1');
    expect(resolved.link.expiresAt!.getTime()).toBeGreaterThan(Date.now());

    await expectServiceError(getCargoFileContent({ fileId: otherFile.id, key }), 'not_found');

    let middle = Math.floor(key.length / 2);
    let tampered = `${key.slice(0, middle)}${key[middle] === 'a' ? 'b' : 'a'}${key.slice(middle + 1)}`;
    await expectServiceError(
      getCargoFileContent({ fileId: file.id, key: tampered }),
      'not_found'
    );

    let expiredKey = await createSignedFileDownloadKey(file, { expiresInSeconds: -60 });
    await expectServiceError(
      getCargoFileContent({ fileId: file.id, key: expiredKey }),
      'not_found'
    );

    let replaced = await fileService.createUploadedFile({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      purpose: 'generic',
      file: new Blob(['signed v2']),
      input: { id: file.id, name: file.fileName, authorization: { type: 'privileged' } }
    });
    expect(replaced.id).toBe(file.id);
    expect(replaced.storeId).not.toBe(file.storeId);

    await expectServiceError(getCargoFileContent({ fileId: file.id, key }), 'not_found');

    let replacedKey = await createSignedFileDownloadKey(replaced);
    let current = await getCargoFileContent({ fileId: file.id, key: replacedKey });
    expect(Buffer.from(await readContent(current)).toString()).toBe('signed v2');
  });

  it('stops resolving signed keys once the file is deleted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let file = await createWritableFile(fixture);
    let key = await createSignedFileDownloadKey(file);

    await getCargoFileContent({ fileId: file.id, key });
    await fileService.deleteFile({ file, auditScope: fixture.auditScope });

    await expectServiceError(getCargoFileContent({ fileId: file.id, key }), 'not_found');
  });

  it('reuses an existing link when the same id or key is reconciled', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let file = await createWritableFile(fixture);
    let key = `${uniqueId('custom-key')}_dev`;

    let created = await fileLinkService.createFileLink({
      ...scopeOf(fixture),
      file,
      input: { key }
    });
    expect(created.key).toBe(key);

    let byKey = await fileLinkService.createFileLink({
      ...scopeOf(fixture),
      file,
      input: { key, expiresAt: new Date(Date.now() + 60_000) }
    });
    expect(byKey.id).toBe(created.id);
    expect(byKey.expiresAt).toBeInstanceOf(Date);

    let byId = await fileLinkService.createFileLink({
      ...scopeOf(fixture),
      file,
      input: { id: created.id }
    });
    expect(byId.id).toBe(created.id);
    expect(byId.key).toBe(key);

    expect(await db.fileLink.count({ where: { fileOid: file.oid } })).toBe(1);
  });

  it('keeps links tenant-scoped', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let file = await createWritableFile(fixture);
    let link = await linkFile(fixture, file);

    let own = await fileLinkService.getFileLinkById({
      ...scopeOf(fixture),
      fileLinkId: link.id
    });
    expect(own.id).toBe(link.id);

    await expectServiceError(
      fileLinkService.getFileLinkById({ ...scopeOf(otherFixture), fileLinkId: link.id }),
      'not_found'
    );

    let foreignList = await firstPage(
      await fileLinkService.listFileLinks({ ...scopeOf(otherFixture), ids: [link.id] })
    );
    expect(foreignList).toEqual([]);

    let ownList = await firstPage(
      await fileLinkService.listFileLinks({ ...scopeOf(fixture), fileIds: [file.id] })
    );
    expect(ownList.map(item => item.id)).toEqual([link.id]);

    let foreignActor = await resourceActorService.ensureOrganizationActor({
      project: otherFixture.project,
      organizationActorOid: otherFixture.actor.oid
    });
    let mismatch = await expectServiceError(
      fileLinkService.createFileLink({
        ...scopeOf(fixture),
        file,
        input: { actor: foreignActor }
      }),
      'bad_request'
    );
    expect(mismatch.message).toBe('ResourceActor does not belong to the supplied project.');
  });

  it('scopes link reads to the creating actor when an actor is given', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let file = await createWritableFile(fixture);
    let author = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('link-author'), name: 'Link Author' }
    });
    let bystander = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('link-bystander'), name: 'Link Bystander' }
    });

    let authored = await fileLinkService.createFileLink({
      ...scopeOf(fixture),
      file,
      input: { actor: author }
    });
    let anonymous = await linkFile(fixture, file);
    expect(authored.createdByResourceActorOid).toBe(author.oid);

    let byAuthor = await firstPage(
      await fileLinkService.listFileLinks({
        ...scopeOf(fixture),
        fileIds: [file.id],
        actor: author
      })
    );
    expect(byAuthor.map(item => item.id)).toEqual([authored.id]);

    let unscoped = await firstPage(
      await fileLinkService.listFileLinks({ ...scopeOf(fixture), fileIds: [file.id] })
    );
    expect(unscoped.map(item => item.id).sort()).toEqual([authored.id, anonymous.id].sort());

    await expectServiceError(
      fileLinkService.getFileLinkById({
        ...scopeOf(fixture),
        fileLinkId: authored.id,
        actor: bystander
      }),
      'not_found'
    );
  });
});
