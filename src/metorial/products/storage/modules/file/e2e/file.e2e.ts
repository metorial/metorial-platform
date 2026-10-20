import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import { fileLinkService, filePurposeService, fileService } from '../src';

let authorization = createResourceAuthorization({ restricted: false });

let uploadFile = async (
  fixture: OrganizationFixture,
  input: { name: string; content: string }
) => {
  let purpose = await filePurposeService.ensureGenericFilePurpose();

  return await fileService.createUploadedFile({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    purpose: purpose.id,
    file: new Blob([input.content], { type: 'text/plain' }),
    input: {
      name: input.name,
      title: input.name,
      authorization
    }
  });
};

describe('module-file', () => {
  let org = useOrganization();

  it('buffers small text uploads in the database and serves their content', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = `hello from ${uniqueId('module-file')}`;
    let name = `${uniqueId('note')}.txt`;

    let file = await uploadFile(fixture, { name, content });
    expect(file.fileName).toBe(name);
    expect(file.fileSize).toBe(content.length);
    expect(file.status).toBe('active');
    expect(file.isReadOnly).toBe(true);
    expect(file.purpose.slug).toBeTruthy();

    let pending = await db.filePendingContent.findUnique({ where: { fileOid: file.oid } });
    expect(pending).not.toBeNull();

    let downloaded = await fileService.downloadFileContent({ file });
    expect(downloaded.toString('utf8')).toBe(content);

    let fetched = await fileService.getFileById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      fileId: file.id
    });
    expect(fetched.id).toBe(file.id);

    let listed = await firstPage(
      await fileService.listFiles({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        ids: [file.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([file.id]);
  });

  it('stores binary uploads in object storage', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = `binary-ish ${uniqueId('blob')}`;

    let file = await uploadFile(fixture, { name: `${uniqueId('blob')}.bin`, content });

    let pending = await db.filePendingContent.findUnique({ where: { fileOid: file.oid } });
    expect(pending).toBeNull();

    let source = await fileService.resolveFileContentSource({ file });
    expect(source).toMatchObject({ type: 'object', key: file.storeId });

    let downloaded = await fileService.downloadFileContent({ file });
    expect(downloaded.toString('utf8')).toBe(content);
  });

  it('creates, resolves, lists and deletes file links', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let file = await uploadFile(fixture, {
      name: `${uniqueId('linked')}.md`,
      content: '# linked'
    });

    let link = await fileLinkService.createFileLink({
      project: fixture.project,
      instance: fixture.instance,
      file,
      input: {}
    });
    expect(link.file.id).toBe(file.id);
    expect(link.key).toBeTruthy();

    let fetched = await fileLinkService.getFileLinkById({
      project: fixture.project,
      instance: fixture.instance,
      fileLinkId: link.id
    });
    expect(fetched.id).toBe(link.id);

    let byKey = await fileLinkService.getFileLinkByKey({ fileId: file.id, key: link.key });
    expect(byKey.link.id).toBe(link.id);

    let listed = await firstPage(
      await fileLinkService.listFileLinks({
        project: fixture.project,
        instance: fixture.instance,
        fileIds: [file.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([link.id]);

    await fileLinkService.deleteFileLink({ fileLink: link });
    await expect(
      fileLinkService.getFileLinkByKey({ fileId: file.id, key: link.key })
    ).rejects.toThrow();
  });

  it('updates and deletes a writable file', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let purpose = await filePurposeService.ensureGenericFilePurpose();

    let file = await fileService.createFile({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      purpose: purpose.id,
      storeId: uniqueId('e2e-object'),
      input: {
        name: `${uniqueId('writable')}.txt`,
        mimeType: 'text/plain',
        size: 0,
        authorization
      }
    });
    expect(file.isReadOnly).toBe(false);

    let title = uniqueId('title');
    let updated = await fileService.updateFile({ file, input: { title } });
    expect(updated.title).toBe(title);

    let deleted = await fileService.deleteFileById({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      fileId: file.id
    });
    expect(deleted.status).toBe('deleted');

    let listed = await firstPage(
      await fileService.listFiles({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        ids: [file.id]
      })
    );
    expect(listed).toEqual([]);
  });
});
