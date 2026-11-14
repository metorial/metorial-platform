import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { db, ID } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { skillGroupItemService, skillGroupService } from '../src';

let createSkill = async (fixture: OrganizationFixture) =>
  await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: createResourceAuthorization({ restricted: false }),
      name: uniqueId('skill')
    }
  });

describe('module-skill-groups', () => {
  let org = useOrganization();

  it('creates, gets, lists and updates a skill group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let name = uniqueId('group');

    let group = await skillGroupService.createSkillGroup({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: {
        name: `  ${name}  `,
        description: 'Created by the e2e suite',
        skillIds: [skill.id]
      }
    });
    expect(group.name).toBe(name);
    expect(group.status).toBe('active');
    expect(group.items.map(item => item.skill.id)).toEqual([skill.id]);

    let fetched = await skillGroupService.getSkillGroupById({
      project: fixture.project,
      instance: fixture.instance,
      skillGroupId: group.id
    });
    expect(fetched.id).toBe(group.id);

    let bySkill = await firstPage(
      await skillGroupService.listSkillGroups({
        project: fixture.project,
        instance: fixture.instance,
        skillIds: [skill.id]
      })
    );
    expect(bySkill.map(item => item.id)).toEqual([group.id]);

    let renamed = uniqueId('renamed-group');
    let updated = await skillGroupService.updateSkillGroup({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillGroupId: group.id,
      input: { name: renamed, description: null, skillIds: [] }
    });
    expect(updated.name).toBe(renamed);
    expect(updated.description).toBeNull();
    expect(updated.items).toEqual([]);

    let archivedItems = await db.skillGroupItem.findMany({
      where: { skillGroupOid: group.oid }
    });
    expect(archivedItems.map(item => item.status)).toEqual(['archived']);
  });

  it('adds, rejects duplicate, archives and re-adds a skill group item', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let group = await skillGroupService.createSkillGroup({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('group') }
    });

    let item = await skillGroupItemService.createSkillGroupItem({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { skillGroupId: group.id, skillId: skill.id }
    });
    expect(item.skillGroup.id).toBe(group.id);
    expect(item.skill.id).toBe(skill.id);
    expect(item.status).toBe('active');

    let duplicate = await rejectionOf(
      skillGroupItemService.createSkillGroupItem({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: { skillGroupId: group.id, skillId: skill.id }
      })
    );
    expect(duplicate.data.code).toBe('skill_group_item_exists');

    let archived = await skillGroupItemService.archiveSkillGroupItem({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillGroupItem: item
    });
    expect(archived.status).toBe('archived');

    let activeItems = await firstPage(
      await skillGroupItemService.listSkillGroupItems({
        project: fixture.project,
        instance: fixture.instance,
        skillGroupIds: [group.id]
      })
    );
    expect(activeItems).toEqual([]);

    let readded = await skillGroupItemService.createSkillGroupItem({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { skillGroupId: group.id, skillId: skill.id }
    });
    expect(readded.id).toBe(item.id);
    expect(readded.status).toBe('active');

    let fetched = await skillGroupItemService.getSkillGroupItemById({
      project: fixture.project,
      instance: fixture.instance,
      skillGroupItemId: item.id,
      skillGroupId: group.id
    });
    expect(fetched.status).toBe('active');
  });

  it('archives a skill group and hides it from default reads', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let group = await skillGroupService.createSkillGroup({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('group'), skillIds: [skill.id] }
    });

    let archived = await skillGroupService.archiveSkillGroup({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillGroupId: group.id
    });
    expect(archived.status).toBe('archived');
    expect(archived.items).toEqual([]);

    let error = await rejectionOf(
      skillGroupService.getSkillGroupById({
        project: fixture.project,
        instance: fixture.instance,
        skillGroupId: group.id
      })
    );
    expect(error.data.code).toBe('not_found');

    let withDeleted = await skillGroupService.getSkillGroupById({
      project: fixture.project,
      instance: fixture.instance,
      skillGroupId: group.id,
      allowDeleted: true
    });
    expect(withDeleted.status).toBe('archived');

    let listed = await firstPage(
      await skillGroupService.listSkillGroups({
        project: fixture.project,
        instance: fixture.instance,
        ids: [group.id],
        statuses: ['archived']
      })
    );
    expect(listed.map(item => item.id)).toEqual([group.id]);
  });
});
