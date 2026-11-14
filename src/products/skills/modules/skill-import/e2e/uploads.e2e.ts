import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { filePurposeService } from '@metorial/module-file';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import { skillImportService } from '../src';
import {
  createFileRecord,
  importFile,
  privileged,
  scopeOf,
  seedImport,
  skillMarkdown,
  uploadFile,
  waitForImport
} from './_fixtures';

let countImports = async (fixture: OrganizationFixture) =>
  await db.skillImport.count({ where: { instanceOid: fixture.instance.oid } });

describe('module-skill-import uploads', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('records an uploaded ZIP import and releases its source file once acquisition ends', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = `${uniqueId('skills')}.zip`;
    let file = await createFileRecord(fixture, {
      name,
      mimeType: 'application/zip',
      size: 512
    });

    let skillImport = await importFile(fixture, file.id);

    expect(skillImport).toMatchObject({
      sourceType: 'uploaded_file',
      status: 'pending',
      sourceFileName: name,
      sourceFileFormat: 'zip',
      repositoryUrl: null,
      repositoryId: null,
      repositoryName: null,
      ref: null,
      path: null,
      codeBucketId: null,
      creatorResourceActorOid: null,
      sourceFile: { id: file.id },
      items: []
    });
    expect(skillImport.sourceFileReference).toMatchObject({
      entityType: 'skill_import',
      entityId: skillImport.id,
      fileLinkOid: skillImport.sourceFileLink!.oid
    });
    expect(skillImport.sourceFileLink?.fileOid).toBe(file.oid);

    let failed = await waitForImport(skillImport.id, row => row.status === 'failed');
    expect(failed.error).toBeTruthy();
    expect(failed.startedAt).toBeInstanceOf(Date);
    expect(failed).toMatchObject({
      sourceFileOid: file.oid,
      sourceFileReferenceOid: null,
      sourceFileLinkOid: null
    });
    expect(
      await db.fileReference.findUnique({ where: { id: skillImport.sourceFileReference!.id } })
    ).toBeNull();
  });

  it('detects Markdown uploads by extension or MIME type', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    for (let [name, mimeType] of [
      [`${uniqueId('skill')}.md`, 'application/octet-stream'],
      [`${uniqueId('skill')}.markdown`, 'application/octet-stream'],
      [uniqueId('instructions'), 'text/markdown; charset=utf-8'],
      [uniqueId('instructions'), 'text/plain']
    ]) {
      let file = await createFileRecord(fixture, {
        name: name!,
        mimeType: mimeType!,
        size: 64
      });
      let skillImport = await importFile(fixture, file.id);

      expect(skillImport).toMatchObject({
        sourceType: 'uploaded_file',
        sourceFileFormat: 'markdown',
        sourceFileName: name
      });
    }

    let zipByMimeType = await createFileRecord(fixture, {
      name: uniqueId('archive'),
      mimeType: 'application/zip',
      size: 512
    });
    expect((await importFile(fixture, zipByMimeType.id)).sourceFileFormat).toBe('zip');
  });

  it('rejects unusable uploads without creating an import', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = await countImports(fixture);

    let unsupported = await uploadFile(fixture, {
      name: `${uniqueId('skill')}.pdf`,
      mimeType: 'application/pdf',
      content: '%PDF-1.4'
    });
    let tooLargeZip = await createFileRecord(fixture, {
      name: `${uniqueId('big')}.zip`,
      mimeType: 'application/zip',
      size: 10 * 1024 * 1024 + 1
    });
    let tooLargeMarkdown = await createFileRecord(fixture, {
      name: `${uniqueId('big')}.md`,
      mimeType: 'text/markdown',
      size: 3 * 1024 * 1024 + 1
    });
    let deleted = await uploadFile(fixture, {
      name: `${uniqueId('deleted')}.md`,
      mimeType: 'text/markdown',
      content: skillMarkdown('Deleted')
    });
    await db.file.update({ where: { id: deleted.id }, data: { status: 'deleted' } });
    let purpose = await filePurposeService.upsertFilePurpose({
      input: {
        slug: 'e2e-skill-import-other',
        name: 'E2E skill import other purpose',
        ownerType: 'instance',
        canHaveLinks: true
      }
    });
    let otherPurpose = await uploadFile(fixture, {
      name: `${uniqueId('purpose')}.md`,
      mimeType: 'text/markdown',
      content: skillMarkdown('Other purpose'),
      purposeId: purpose.id
    });

    let cases: Array<[string, RegExp]> = [
      [unsupported.id, /must be ZIP or Markdown files/],
      [tooLargeZip.id, /Uploaded skill import is too large/],
      [tooLargeMarkdown.id, /Uploaded skill import is too large/],
      [deleted.id, /file has been deleted/],
      [otherPurpose.id, /Only generic uploaded files can be imported/]
    ];
    for (let [fileId, message] of cases) {
      let error = await expectServiceError(importFile(fixture, fileId), 'bad_request');
      expect(error.message).toMatch(message);
    }

    let unauthorized = await expectServiceError(
      skillImportService.createSkillImport({
        ...scopeOf(fixture),
        input: { type: 'file', fileId: unsupported.id }
      }),
      'bad_request'
    );
    expect(unauthorized.message).toMatch(/File authorization is required/);

    expect(await countImports(fixture)).toBe(before);
    expect(
      await db.fileReference.count({
        where: {
          entityType: 'skill_import',
          fileLink: { file: { id: { in: cases.map(c => c[0]) } } }
        }
      })
    ).toBe(0);
  });

  it('accepts uploads exactly at the size limits', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let zip = await createFileRecord(fixture, {
      name: `${uniqueId('limit')}.zip`,
      mimeType: 'application/zip',
      size: 10 * 1024 * 1024
    });
    let markdown = await createFileRecord(fixture, {
      name: `${uniqueId('limit')}.md`,
      mimeType: 'text/markdown',
      size: 3 * 1024 * 1024
    });

    expect((await importFile(fixture, zip.id)).sourceFileFormat).toBe('zip');
    expect((await importFile(fixture, markdown.id)).sourceFileFormat).toBe('markdown');
  });

  it('does not import another organization’s file', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let file = await uploadFile(fixture, {
      name: `${uniqueId('private')}.md`,
      mimeType: 'text/markdown',
      content: skillMarkdown('Private')
    });
    let before = await countImports(other);

    await expectServiceError(importFile(other, file.id), 'not_found');

    expect(await countImports(other)).toBe(before);
    expect(await db.fileLink.count({ where: { file: { id: file.id } } })).toBe(0);
  });

  it('keeps imports inside their organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skillImport = await seedImport(fixture, { status: 'completed' });

    await expectServiceError(
      skillImportService.getSkillImportById({
        ...scopeOf(other),
        skillImportId: skillImport.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await skillImportService.listSkillImports({ ...scopeOf(other), ids: [skillImport.id] })
      )
    ).toEqual([]);
  });

  it('scopes imports to the actor that created them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let creator = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('creator'), name: 'Creator' }
    });
    let bystander = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('bystander'), name: 'Bystander' }
    });
    let foreignActor = await resourceActorService.upsertActor({
      project: other.project,
      input: { identifier: uniqueId('foreign'), name: 'Foreign' }
    });
    let file = await createFileRecord(fixture, {
      name: `${uniqueId('actor')}.md`,
      mimeType: 'text/markdown',
      size: 64
    });

    let skillImport = await skillImportService.createSkillImport({
      ...scopeOf(fixture),
      actor: creator,
      authorization: privileged,
      input: { type: 'file', fileId: file.id }
    });
    expect(skillImport.creatorResourceActor?.id).toBe(creator.id);
    expect(skillImport.sourceFileLink?.createdByResourceActorOid).toBe(creator.oid);

    expect(
      (
        await skillImportService.getSkillImportById({
          ...scopeOf(fixture),
          actor: creator,
          skillImportId: skillImport.id
        })
      ).id
    ).toBe(skillImport.id);
    expect(
      (
        await skillImportService.getSkillImportById({
          ...scopeOf(fixture),
          skillImportId: skillImport.id
        })
      ).id
    ).toBe(skillImport.id);
    await expectServiceError(
      skillImportService.getSkillImportById({
        ...scopeOf(fixture),
        actor: bystander,
        skillImportId: skillImport.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await skillImportService.listSkillImports({
          ...scopeOf(fixture),
          actor: bystander,
          ids: [skillImport.id]
        })
      )
    ).toEqual([]);

    for (let attempt of [
      () =>
        skillImportService.getSkillImportById({
          ...scopeOf(fixture),
          actor: foreignActor,
          skillImportId: skillImport.id
        }),
      () =>
        skillImportService.createSkillImport({
          ...scopeOf(fixture),
          actor: foreignActor,
          authorization: privileged,
          input: { type: 'file', fileId: file.id }
        })
    ]) {
      let error = await expectServiceError(attempt(), 'bad_request');
      expect(error.message).toMatch(/does not belong to the supplied project/);
    }
  });

  it('rejects public repository URLs that are unsafe or unsupported', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = await countImports(fixture);

    let cases: Array<[string, RegExp]> = [
      ['not a url', /Repository URL is invalid/],
      ['http://github.com/metorial/skills', /HTTPS URL without credentials or a port/],
      ['https://token@github.com/metorial/skills', /HTTPS URL without credentials or a port/],
      ['https://user:pass@gitlab.com/group/skills', /HTTPS URL without credentials or a port/],
      ['https://github.com:8443/metorial/skills', /HTTPS URL without credentials or a port/],
      ['file:///etc/passwd', /HTTPS URL without credentials or a port/],
      ['https://github.com/metorial/skills%2F..%2F..%2Fadmin', /unsafe path/],
      ['https://gitlab.com/group/..%5Cadmin', /unsafe path/],
      ['https://github.com/metorial/%E0%A4%A', /invalid path encoding/],
      ['https://github.com/metorial', /identify a repository root/],
      ['https://github.com/metorial/skills/tree/main', /identify a repository root/],
      ['https://bitbucket.org/workspace', /identify a repository root/],
      ['https://gitlab.com/group', /identify a GitLab project/],
      ['https://github.com/metorial/.git', /Repository URL is incomplete/],
      ['https://example.com/metorial/skills', /Only public GitHub, GitLab, and Bitbucket/],
      [
        'https://github.com.evil.test/metorial/skills',
        /Only public GitHub, GitLab, and Bitbucket/
      ],
      ['https://localhost/metorial/skills', /Only public GitHub, GitLab, and Bitbucket/],
      ['https://169.254.169.254/latest/meta-data', /Only public GitHub, GitLab, and Bitbucket/]
    ];
    for (let [repositoryUrl, message] of cases) {
      let error = await expectServiceError(
        skillImportService.createSkillImport({
          ...scopeOf(fixture),
          input: { type: 'public', repositoryUrl }
        }),
        'bad_request'
      );
      expect(error.message, repositoryUrl).toMatch(message);
    }

    expect(await countImports(fixture)).toBe(before);
  });
});
