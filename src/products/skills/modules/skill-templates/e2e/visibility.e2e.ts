import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { accessTagService, consumerSkillReadRoles } from '@metorial/module-access';
import { storeService } from '@metorial/module-store';
import { afterAll, describe, expect, it } from 'vitest';
import { skillTemplateService } from '../src';
import {
  createSkill,
  createSkillFromTemplate,
  createTemplate,
  readStoreDocument,
  scopeOf,
  storeFilePaths,
  templateItems
} from './_fixtures';

let listIds = async (
  fixture: OrganizationFixture,
  filters: Omit<
    Parameters<typeof skillTemplateService.listSkillTemplates>[0],
    'project' | 'instance'
  >
) =>
  (
    await firstPage(
      await skillTemplateService.listSkillTemplates({ ...scopeOf(fixture), ...filters })
    )
  ).map(template => template.id);

let tagTemplate = async (
  fixture: OrganizationFixture,
  skillTemplateOid: bigint,
  roles: string[]
) => {
  let tag = await accessTagService.createAccessTag({ instance: fixture.instance });
  let policy = await db.accessTagPolicy.create({
    data: {
      id: await ID.generateId('accessTagPolicy'),
      name: uniqueId('policy'),
      roles,
      organizationOid: fixture.organization.oid
    }
  });
  await db.accessTagEntity.create({
    data: { accessTagOid: tag.oid, accessTagPolicyOid: policy.oid, skillTemplateOid }
  });

  return tag;
};

describe('module-skill-templates visibility', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let systemIdentifiers: string[] = [];

  afterAll(async () => {
    await db.skillTemplate.updateMany({
      where: { systemIdentifier: { in: systemIdentifiers } },
      data: { status: 'archived' }
    });
  });

  let upsertSystemTemplate = async (systemIdentifier: string, body: string) =>
    await skillTemplateService.upsertSkillTemplate({
      input: {
        id: await ID.generateId('skillTemplate'),
        systemIdentifier,
        name: `System ${systemIdentifier}`,
        description: 'System template from the e2e suite',
        items: templateItems(body)
      }
    });

  it('hides tenant templates from other organizations', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let template = await createTemplate(fixture);
    let otherScope = { ...scopeOf(other), skillTemplateId: template.id };

    await expectServiceError(
      skillTemplateService.getSkillTemplateById(otherScope),
      'not_found'
    );
    expect(await listIds(other, { ids: [template.id] })).toEqual([]);
    expect(await listIds(other, { owners: ['tenant'] })).not.toContain(template.id);
    expect(
      await skillTemplateService.getManySkillTemplatesByIds({
        ...scopeOf(other),
        skillTemplateIds: [template.id]
      })
    ).toEqual([]);

    await expectServiceError(
      skillTemplateService.updateSkillTemplate({
        ...otherScope,
        auditScope: other.auditScope,
        input: { name: uniqueId('hijacked') }
      }),
      'not_found'
    );
    await expectServiceError(
      skillTemplateService.deleteSkillTemplate({
        ...otherScope,
        auditScope: other.auditScope
      }),
      'not_found'
    );

    let row = await db.skillTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(row).toMatchObject({ status: 'active', name: template.name });

    expect(
      (
        await skillTemplateService.getManySkillTemplatesByIds({
          ...scopeOf(fixture),
          skillTemplateIds: [template.id]
        })
      ).map(found => found.id)
    ).toEqual([template.id]);
  });

  it('refuses another organization’s skill or store as a template source', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);
    let store = await storeService.createStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      input: { name: uniqueId('store'), access: 'private' }
    });
    let before = await db.skillTemplate.count({ where: { instanceOid: other.instance.oid } });

    await expectServiceError(createTemplate(other, { skillId: skill.id }), 'not_found');
    await expectServiceError(createTemplate(other, { storeId: store.id }), 'not_found');

    expect(await db.skillTemplate.count({ where: { instanceOid: other.instance.oid } })).toBe(
      before
    );
    expect((await db.store.findUniqueOrThrow({ where: { id: store.id } })).access).toBe(
      'private'
    );
  });

  it('shares system templates with every organization but keeps them read-only', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let systemIdentifier = uniqueId('e2e-system');
    systemIdentifiers.push(systemIdentifier);

    let template = await upsertSystemTemplate(`  ${systemIdentifier}  `, 'System body');

    expect(template).toMatchObject({
      owner: 'system',
      systemIdentifier,
      slug: systemIdentifier,
      projectOid: null,
      instanceOid: null,
      organizationOid: null
    });

    for (let viewer of [fixture, other]) {
      let fetched = await skillTemplateService.getSkillTemplateById({
        ...scopeOf(viewer),
        skillTemplateId: template.id
      });
      expect(fetched.owner).toBe('system');
      expect(await listIds(viewer, { ids: [template.id], owners: ['system'] })).toEqual([
        template.id
      ]);
      expect(await listIds(viewer, { ids: [template.id], owners: ['tenant'] })).toEqual([]);
    }

    let attempts = [
      () =>
        skillTemplateService.updateSkillTemplate({
          ...scopeOf(fixture),
          auditScope: fixture.auditScope,
          skillTemplateId: template.id,
          input: { name: uniqueId('tenant-edit') }
        }),
      () =>
        skillTemplateService.deleteSkillTemplate({
          ...scopeOf(other),
          auditScope: other.auditScope,
          skillTemplateId: template.id
        })
    ];
    for (let attempt of attempts) {
      let error = await expectServiceError(attempt(), 'bad_request');
      expect(error.message).toMatch(/only allowed within the matching project and instance/);
    }

    let row = await db.skillTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(row).toMatchObject({ status: 'active', name: template.name });
  });

  it('upserts system templates by identifier and lets every organization instantiate them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let systemIdentifier = uniqueId('e2e-system');
    systemIdentifiers.push(systemIdentifier);

    let first = await upsertSystemTemplate(systemIdentifier, 'First system body');
    let second = await upsertSystemTemplate(systemIdentifier, 'Second system body');

    expect(second.id).toBe(first.id);
    expect(second.storeTemplate?.id).toBe(first.storeTemplate?.id);
    expect(await db.skillTemplate.count({ where: { systemIdentifier } })).toBe(1);

    let error = await expectServiceError(upsertSystemTemplate('   ', 'Blank'), 'bad_request');
    expect(error.message).toBeTruthy();

    for (let viewer of [fixture, other]) {
      let template = await skillTemplateService.getSkillTemplateById({
        ...scopeOf(viewer),
        skillTemplateId: first.id
      });
      let skill = await createSkillFromTemplate(viewer, template);

      expect(skill.parentSkillTemplateOid).toBe(first.oid);
      expect(await storeFilePaths(skill.storeId)).toEqual([
        '/SKILL.md',
        '/references/guide.md'
      ]);
      expect(await readStoreDocument(viewer, skill.storeId, '/SKILL.md')).toContain(
        'Second system body'
      );
      expect(
        (await db.store.findUniqueOrThrow({ where: { id: skill.storeId } })).instanceOid
      ).toBe(viewer.instance.oid);
    }
  });

  it('limits consumer reads to templates tagged with the skill read role', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let granted = await createTemplate(fixture);
    let wrongRole = await createTemplate(fixture);
    let untagged = await createTemplate(fixture);
    let plain = await skillTemplateService.getDefaultSkillTemplate(scopeOf(fixture));

    let tag = await tagTemplate(fixture, granted.oid, [...consumerSkillReadRoles]);
    let otherTag = await tagTemplate(fixture, wrongRole.oid, [
      'consumer#instance.skill:write'
    ]);

    let fetched = await skillTemplateService.getSkillTemplateById({
      ...scopeOf(fixture),
      skillTemplateId: granted.id,
      accessTags: tag
    });
    expect(fetched.id).toBe(granted.id);

    for (let [skillTemplateId, accessTags] of [
      [wrongRole.id, otherTag],
      [untagged.id, tag],
      [plain.id, tag],
      [granted.id, otherTag]
    ] as const) {
      await expectServiceError(
        skillTemplateService.getSkillTemplateById({
          ...scopeOf(fixture),
          skillTemplateId,
          accessTags
        }),
        'not_found'
      );
    }

    let allIds = [granted.id, wrongRole.id, untagged.id, plain.id];
    expect(await listIds(fixture, { ids: allIds, accessTags: tag })).toEqual([granted.id]);
    expect(await listIds(fixture, { ids: allIds, accessTags: [tag, otherTag] })).toEqual([
      granted.id
    ]);

    await skillTemplateService.deleteSkillTemplate({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skillTemplateId: granted.id
    });

    await expectServiceError(
      skillTemplateService.getSkillTemplateById({
        ...scopeOf(fixture),
        skillTemplateId: granted.id,
        accessTags: tag
      }),
      'not_found'
    );
    expect(await listIds(fixture, { ids: allIds, accessTags: tag })).toEqual([]);
    expect(
      await listIds(fixture, { ids: allIds, accessTags: tag, statuses: ['archived'] })
    ).toEqual([]);
  });
});
