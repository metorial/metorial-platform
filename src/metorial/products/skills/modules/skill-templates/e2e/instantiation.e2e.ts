import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { skillTemplateService } from '../src';
import {
  addDocument,
  createSkill,
  createSkillFromTemplate,
  createTemplate,
  privileged,
  readStoreDocument,
  scopeOf,
  settledStoreTemplateHash,
  storeDirectoryPaths,
  storeFilePaths,
  syncTimeout,
  templateItems
} from './_fixtures';

describe('module-skill-templates instantiation', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a skill whose store holds the template items and content', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture, { items: templateItems('Original body') });
    let name = uniqueId('skill');

    let skill = await createSkillFromTemplate(fixture, template, name);

    let row = await db.skill.findUniqueOrThrow({
      where: { id: skill.id },
      include: { parentSkillTemplate: true, store: true }
    });
    expect(row).toMatchObject({
      status: 'active',
      name,
      parentSkillTemplate: { id: template.id },
      store: { access: 'public_read', projectOid: fixture.project.oid }
    });
    expect(row.storeId).not.toBe(template.storeId);

    expect(await storeFilePaths(skill.storeId)).toEqual(['/SKILL.md', '/references/guide.md']);
    expect(await storeDirectoryPaths(skill.storeId)).toEqual(
      expect.arrayContaining(['/assets/'])
    );

    let skillMd = await readStoreDocument(fixture, skill.storeId, '/SKILL.md');
    expect(skillMd).toMatch(new RegExp(`^# ${name}\\n`));
    expect(skillMd).toContain('Original body');
    expect(skillMd).not.toContain('# Template');
    expect(await readStoreDocument(fixture, skill.storeId, '/references/guide.md')).toBe(
      '# Guide\n\nRead me\n'
    );

    let children = await firstPage(
      await skillService.listSkills({
        ...scopeOf(fixture),
        parentSkillTemplateIds: [template.id]
      })
    );
    expect(children.map(child => child.id)).toEqual([skill.id]);
  });

  it('instantiates the default plain template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let plain = await skillTemplateService.getDefaultSkillTemplate(scopeOf(fixture));
    expect(plain).toMatchObject({
      owner: 'system',
      systemIdentifier: 'plain',
      status: 'active'
    });

    let name = uniqueId('plain-skill');
    let skill = await createSkillFromTemplate(fixture, plain, name);

    expect(await storeFilePaths(skill.storeId)).toEqual(['/SKILL.md']);
    let skillMd = await readStoreDocument(fixture, skill.storeId, '/SKILL.md');
    expect(skillMd).toMatch(new RegExp(`^# ${name}\\n`));
    expect(skillMd).toContain('Set the scene, define the problem and task.');
  });

  it('does not change existing skills when a standalone template is edited', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture, { items: templateItems('First version') });
    let firstHash = await settledStoreTemplateHash(template.storeTemplate!.id);
    let before = await createSkillFromTemplate(fixture, template);

    let updated = await skillTemplateService.updateSkillTemplate({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skillTemplateId: template.id,
      input: {
        items: [
          {
            path: '/SKILL.md',
            type: 'document',
            content: '# Template\n\nSecond version\n',
            encoding: 'utf-8'
          },
          { path: '/extra.md', type: 'document', content: '# Extra\n', encoding: 'utf-8' }
        ]
      }
    });
    await settledStoreTemplateHash(template.storeTemplate!.id, firstHash);

    expect(await storeFilePaths(before.storeId)).toEqual([
      '/SKILL.md',
      '/references/guide.md'
    ]);
    let beforeSkillMd = await readStoreDocument(fixture, before.storeId, '/SKILL.md');
    expect(beforeSkillMd).toContain('First version');
    expect(beforeSkillMd).not.toContain('Second version');

    let after = await createSkillFromTemplate(fixture, updated);
    expect(await storeFilePaths(after.storeId)).toEqual(['/SKILL.md', '/extra.md']);
    expect(await readStoreDocument(fixture, after.storeId, '/SKILL.md')).toContain(
      'Second version'
    );
  });

  it('does not change existing skills when a linked template store is edited', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture, { name: uniqueId('linked') });
    let before = await createSkillFromTemplate(fixture, template);

    await addDocument(fixture, template.storeId!, '/added-later.md', '# Added later\n');

    let after = await createSkillFromTemplate(fixture, template);
    expect(await storeFilePaths(after.storeId)).toEqual(['/SKILL.md', '/added-later.md']);
    expect(await storeFilePaths(before.storeId)).toEqual(['/SKILL.md']);
  });

  it('snapshots the source skill when a template is created from it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let source = await createSkill(fixture);
    await addDocument(fixture, source.storeId, '/SKILL.md', '# Source\n\nSource body\n');
    await addDocument(fixture, source.storeId, '/notes/one.md', '# One\n');

    let template = await createTemplate(fixture, { skillId: source.id });

    expect(template.storeTemplate?.type).toBe('linked_store');
    expect(template.storeId).not.toBe(source.storeId);
    await eventually(
      async () =>
        expect(await storeFilePaths(template.storeId!)).toEqual([
          '/SKILL.md',
          '/notes/one.md'
        ]),
      syncTimeout
    );

    await addDocument(fixture, source.storeId, '/later.md', '# Later\n');

    let child = await createSkillFromTemplate(fixture, template);
    expect(await storeFilePaths(child.storeId)).toEqual(['/SKILL.md', '/notes/one.md']);
    expect(await readStoreDocument(fixture, child.storeId, '/SKILL.md')).toContain(
      'Source body'
    );
    expect(await storeFilePaths(template.storeId!)).toEqual(['/SKILL.md', '/notes/one.md']);
  });

  it('keeps skills when their template is archived', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture);
    let skill = await createSkillFromTemplate(fixture, template);

    await skillTemplateService.deleteSkillTemplate({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skillTemplateId: template.id
    });

    let fetched = await skillService.getSkillById({ ...scopeOf(fixture), skillId: skill.id });
    expect(fetched.status).toBe('active');
    expect(await storeFilePaths(skill.storeId)).toEqual(['/SKILL.md', '/references/guide.md']);
  });

  it('rejects creating a skill from an archived template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture);
    let archived = await skillTemplateService.deleteSkillTemplate({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skillTemplateId: template.id
    });

    await expectServiceError(createSkillFromTemplate(fixture, archived), 'gone');
  });

  it('refuses to instantiate another tenant’s template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let template = await createTemplate(fixture);
    let skillsBefore = await db.skill.count({ where: { instanceOid: other.instance.oid } });

    let error = await expectServiceError(
      skillService.createSkill({
        ...scopeOf(other),
        auditScope: other.auditScope,
        parentSkillTemplate: template,
        input: { id: uniqueId('skl'), authorization: privileged, name: uniqueId('stolen') }
      }),
      'bad_request'
    );
    expect(error.message).toMatch(/can only be cloned within its linked project/);
    expect(await db.skill.count({ where: { instanceOid: other.instance.oid } })).toBe(
      skillsBefore
    );
  });
});
