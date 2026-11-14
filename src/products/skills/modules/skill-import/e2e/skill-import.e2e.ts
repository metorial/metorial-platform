import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import { skillImportService } from '../src';

// Imports are seeded directly so the acquire queue never reaches out to a git host.
let seedSkillImport = async (
  fixture: OrganizationFixture,
  status: 'pending' | 'completed' | 'failed'
) =>
  await db.skillImport.create({
    data: {
      id: await ID.generateId('skillImport'),
      sourceType: 'public_repository',
      status,
      repositoryUrl: 'https://github.com/metorial/e2e-skills',
      repositoryName: uniqueId('e2e-skills'),
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid
    }
  });

describe('module-skill-import', () => {
  let org = useOrganization();

  it('gets and lists skill imports for the instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let completed = await seedSkillImport(fixture, 'completed');
    let failed = await seedSkillImport(fixture, 'failed');

    let fetched = await skillImportService.getSkillImportById({
      project: fixture.project,
      instance: fixture.instance,
      skillImportId: completed.id
    });
    expect(fetched.id).toBe(completed.id);
    expect(fetched.repositoryName).toBe(completed.repositoryName);
    expect(fetched.items).toEqual([]);

    let listed = await firstPage(
      await skillImportService.listSkillImports({
        project: fixture.project,
        instance: fixture.instance,
        ids: [completed.id, failed.id]
      })
    );
    expect(listed.map(item => item.id).sort()).toEqual([completed.id, failed.id].sort());

    let onlyFailed = await firstPage(
      await skillImportService.listSkillImports({
        project: fixture.project,
        instance: fixture.instance,
        ids: [completed.id, failed.id],
        statuses: ['failed']
      })
    );
    expect(onlyFailed.map(item => item.id)).toEqual([failed.id]);
  });

  it('rejects invalid public repository URLs without creating an import', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = await db.skillImport.count({ where: { instanceOid: fixture.instance.oid } });

    for (let repositoryUrl of [
      'not a url',
      'http://github.com/metorial/skills',
      'https://github.com/metorial'
    ]) {
      let error = await rejectionOf(
        skillImportService.createSkillImport({
          project: fixture.project,
          instance: fixture.instance,
          input: { type: 'public', repositoryUrl }
        })
      );
      expect(error.data.code).toBe('bad_request');
    }

    let after = await db.skillImport.count({ where: { instanceOid: fixture.instance.oid } });
    expect(after).toBe(before);
  });

  it('rejects uploaded imports without authorization or with an unknown file', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let unauthorized = await rejectionOf(
      skillImportService.createSkillImport({
        project: fixture.project,
        instance: fixture.instance,
        input: { type: 'file', fileId: 'file_does_not_exist' }
      })
    );
    expect(unauthorized.data.code).toBe('bad_request');

    let missingFile = await rejectionOf(
      skillImportService.createSkillImport({
        project: fixture.project,
        instance: fixture.instance,
        authorization: createResourceAuthorization({ restricted: false }),
        input: { type: 'file', fileId: 'file_does_not_exist' }
      })
    );
    expect(missingFile.data.code).toBe('not_found');
  });

  it('returns not found for an unknown skill import', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let error = await rejectionOf(
      skillImportService.getSkillImportById({
        project: fixture.project,
        instance: fixture.instance,
        skillImportId: 'skimp_does_not_exist'
      })
    );
    expect(error.data.code).toBe('not_found');
  });
});
