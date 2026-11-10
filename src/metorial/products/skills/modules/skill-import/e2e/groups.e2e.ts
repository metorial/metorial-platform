import { uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { skillGroupService } from '@metorial/module-skill-groups';
import { describe, expect, it } from 'vitest';
import { skillImportService } from '../src';
import { privileged, scopeOf, skillMarkdown, uploadFile } from './_fixtures';

describe('module-skill-import groups', () => {
  let org = useOrganization();

  it('records the skill group that imported skills are added to', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let group = await skillGroupService.createSkillGroup({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      input: { name: uniqueId('import-group') }
    });
    let name = uniqueId('grouped-skill');
    let file = await uploadFile(fixture, {
      name: `${name}.md`,
      content: skillMarkdown(name),
      mimeType: 'text/markdown'
    });

    let skillImport = await skillImportService.createSkillImport({
      ...scopeOf(fixture),
      authorization: privileged,
      skillGroup: group,
      input: { type: 'file', fileId: file.id }
    });

    expect(
      await db.skillImport.findUniqueOrThrow({
        where: { id: skillImport.id },
        select: { skillGroupOid: true }
      })
    ).toEqual({ skillGroupOid: group.oid });
  });
});
