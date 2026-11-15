import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { consumerSkillReadRoles } from '@metorial/module-access';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { type SkillGroupItemRecord, skillGroupItemService, skillGroupService } from '../src';
import {
  addToGroup,
  archiveGroup,
  archiveSkill,
  captureFabric,
  consumerAuthorization,
  createConsumerAccessTag,
  createGroup,
  createSkill,
  getGroup,
  grantAccess,
  listGroups,
  listItems,
  skillIdsOf,
  updateGroup
} from './_fixtures';

let listSkillIds = async (
  fixture: OrganizationFixture,
  filters: { skillGroupIds?: string[]; accessTags?: { accessTagOid: bigint }[] }
) =>
  (
    await firstPage(
      await skillService.listSkills({
        project: fixture.project,
        instance: fixture.instance,
        ...filters
      })
    )
  ).map(skill => skill.id);

let removeFromGroup = async (
  fixture: OrganizationFixture,
  skillGroupItem: SkillGroupItemRecord
) =>
  await skillGroupItemService.archiveSkillGroupItem({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skillGroupItem
  });

let consumerGetSkill = async (
  fixture: OrganizationFixture,
  skillId: string,
  accessTags: { accessTagOid: bigint }[]
) =>
  await skillService.getSkillById({
    project: fixture.project,
    instance: fixture.instance,
    skillId,
    accessTags
  });

describe('module-skill-groups membership', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('puts one skill into several groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let first = await createGroup(fixture);
    let second = await createGroup(fixture);
    let unrelated = await createGroup(fixture);

    let added = captureFabric('skill.group.audit.skill_added:after');
    let firstItem = await addToGroup(fixture, first, skill);
    let secondItem = await addToGroup(fixture, second, skill).finally(added.stop);
    expect(firstItem.id).not.toBe(secondItem.id);
    expect(
      added.events
        .filter(event => event.skillId === skill.id)
        .map(event => event.skillGroupId)
        .sort()
    ).toEqual([first.id, second.id].sort());

    let groups = await listGroups(fixture, { skillIds: [skill.id] });
    expect(groups.map(group => group.id).sort()).toEqual([first.id, second.id].sort());
    expect(groups.map(group => group.id)).not.toContain(unrelated.id);

    expect(await listSkillIds(fixture, { skillGroupIds: [first.id] })).toEqual([skill.id]);
    expect(await listSkillIds(fixture, { skillGroupIds: [unrelated.id] })).toEqual([]);

    let items = await listItems(fixture, { skillIds: [skill.id] });
    expect(items.map(item => item.skillGroup.id).sort()).toEqual([first.id, second.id].sort());

    await removeFromGroup(fixture, firstItem);
    expect((await getGroup(fixture, second)).items.map(item => item.id)).toEqual([
      secondItem.id
    ]);
    expect(
      (await listGroups(fixture, { skillIds: [skill.id] })).map(group => group.id)
    ).toEqual([second.id]);
  });

  it('replaces membership from skillIds while keeping items in the order they were first added', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let a = await createSkill(fixture);
    let b = await createSkill(fixture);
    let c = await createSkill(fixture);
    let group = await createGroup(fixture, { skillIds: [a.id] });
    let bItem = await addToGroup(fixture, group, b);
    await addToGroup(fixture, group, c);
    expect(skillIdsOf(await getGroup(fixture, group))).toEqual([a.id, b.id, c.id]);

    let trimmed = await updateGroup(fixture, group, { skillIds: [c.id, a.id] });
    expect(skillIdsOf(trimmed)).toEqual([a.id, c.id]);
    expect(
      (await db.skillGroupItem.findUniqueOrThrow({ where: { id: bItem.id } })).status
    ).toBe('archived');

    let restored = await updateGroup(fixture, group, { skillIds: [c.id, b.id, a.id] });
    expect(skillIdsOf(restored)).toEqual([a.id, b.id, c.id]);
    expect(restored.items.find(item => item.skill.id === b.id)?.id).toBe(bItem.id);

    let renamed = await updateGroup(fixture, group, { description: 'Untouched membership' });
    expect(skillIdsOf(renamed)).toEqual([a.id, b.id, c.id]);

    let emptied = await updateGroup(fixture, group, { skillIds: [] });
    expect(emptied.items).toEqual([]);
    expect(await db.skillGroupItem.count({ where: { skillGroupOid: group.oid } })).toBe(3);
  });

  it('hides archived skills from a group and refuses to add them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let kept = await createSkill(fixture);
    let archived = await createSkill(fixture);
    let group = await createGroup(fixture, { skillIds: [kept.id, archived.id] });
    let other = await createGroup(fixture);

    await archiveSkill(fixture, archived);

    expect(skillIdsOf(await getGroup(fixture, group))).toEqual([kept.id]);
    expect(await listGroups(fixture, { skillIds: [archived.id] })).toEqual([]);
    expect(await listSkillIds(fixture, { skillGroupIds: [group.id] })).toEqual([kept.id]);
    await expectServiceError(addToGroup(fixture, other, archived), 'not_found');

    let adminItems = await listItems(fixture, { skillGroupIds: [group.id] });
    expect(adminItems.map(item => item.skill.id).sort()).toEqual(
      [kept.id, archived.id].sort()
    );

    let restored = await updateGroup(fixture, group, { skillIds: [kept.id, archived.id] });
    expect(skillIdsOf(restored)).toEqual([kept.id]);
  });

  it('removes an item repeatedly without error and lists it as archived', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture);
    let item = await addToGroup(fixture, group, skill);

    let removed = captureFabric('skill.group.audit.skill_removed:after');
    let archived = await removeFromGroup(fixture, item).finally(removed.stop);
    expect(archived).toMatchObject({ id: item.id, status: 'archived' });
    expect(removed.events.filter(event => event.skillGroupId === group.id)).toEqual([
      expect.objectContaining({ skillGroupId: group.id, skillId: skill.id })
    ]);

    expect((await removeFromGroup(fixture, archived)).status).toBe('archived');

    expect(await listItems(fixture, { skillGroupIds: [group.id] })).toEqual([]);
    expect(
      (await listItems(fixture, { skillGroupIds: [group.id], statuses: ['archived'] })).map(
        entry => entry.id
      )
    ).toEqual([item.id]);
    await expectServiceError(
      skillGroupItemService.getSkillGroupItemById({
        project: fixture.project,
        instance: fixture.instance,
        skillGroupItemId: item.id
      }),
      'not_found'
    );
  });

  it('keeps group items inside their organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture);
    let item = await addToGroup(fixture, group, skill);
    let foreignGroup = await createGroup(other);

    expect(await listItems(other, { skillGroupIds: [group.id] })).toEqual([]);
    await expectServiceError(
      skillGroupItemService.getSkillGroupItemById({
        project: other.project,
        instance: other.instance,
        skillGroupItemId: item.id
      }),
      'not_found'
    );
    await expectServiceError(removeFromGroup(other, item), 'not_found');
    await expectServiceError(addToGroup(other, foreignGroup, skill), 'not_found');
    await expectServiceError(addToGroup(fixture, foreignGroup, skill), 'not_found');

    let created = await skillGroupService.createSkillGroup({
      project: other.project,
      instance: other.instance,
      auditScope: other.auditScope,
      input: { name: 'Foreign skills', skillIds: [skill.id] }
    });
    expect(created.items).toEqual([]);
    expect(
      skillIdsOf(await updateGroup(other, foreignGroup, { skillIds: [skill.id] }))
    ).toEqual([]);

    expect(
      (await db.skillGroupItem.findUniqueOrThrow({ where: { id: item.id } })).status
    ).toBe('active');
  });

  it('grants consumers read access to skills through an active group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { accessTag, accessTags } = await createConsumerAccessTag(fixture);
    let member = await createSkill(fixture);
    let outsider = await createSkill(fixture);
    let group = await createGroup(fixture, { skillIds: [member.id] });
    await grantAccess(fixture, {
      accessTag,
      roles: consumerSkillReadRoles,
      skillGroup: group
    });

    expect((await consumerGetSkill(fixture, member.id, accessTags)).id).toBe(member.id);
    await expectServiceError(consumerGetSkill(fixture, outsider.id, accessTags), 'not_found');
    expect(await listSkillIds(fixture, { accessTags })).toEqual([member.id]);

    let visibleGroup = await skillGroupService.getSkillGroupById({
      project: fixture.project,
      instance: fixture.instance,
      skillGroupId: group.id,
      accessTags
    });
    expect(skillIdsOf(visibleGroup)).toEqual([member.id]);
    expect(
      (await listGroups(fixture, { accessTags, ids: [group.id] })).map(item => item.id)
    ).toEqual([group.id]);
    expect(
      (await listItems(fixture, { accessTags, skillGroupIds: [group.id] })).map(
        item => item.skill.id
      )
    ).toEqual([member.id]);

    let denied = await expectServiceError(
      skillService.updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: member,
        authorization: await consumerAuthorization(fixture, accessTags),
        input: { description: 'Edited through a group' }
      }),
      'forbidden'
    );
    expect(denied.message).toMatch(/write access/);

    let [item] = await listItems(fixture, { skillGroupIds: [group.id] });
    await removeFromGroup(fixture, item!);
    await expectServiceError(consumerGetSkill(fixture, member.id, accessTags), 'not_found');
    expect(await listSkillIds(fixture, { accessTags })).toEqual([]);
  });

  it('revokes group-based consumer access when the group is archived', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { accessTag, accessTags } = await createConsumerAccessTag(fixture);
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture, { skillIds: [skill.id] });
    await grantAccess(fixture, {
      accessTag,
      roles: consumerSkillReadRoles,
      skillGroup: group
    });
    expect((await consumerGetSkill(fixture, skill.id, accessTags)).id).toBe(skill.id);

    await archiveGroup(fixture, group);

    await expectServiceError(consumerGetSkill(fixture, skill.id, accessTags), 'not_found');
    await expectServiceError(
      skillGroupService.getSkillGroupById({
        project: fixture.project,
        instance: fixture.instance,
        skillGroupId: group.id,
        allowDeleted: true,
        accessTags
      }),
      'not_found'
    );
    expect(await listGroups(fixture, { accessTags, ids: [group.id] })).toEqual([]);
  });

  it('does not expose a group to a consumer who can only read one of its skills', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { accessTag, accessTags } = await createConsumerAccessTag(fixture);
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture, { skillIds: [skill.id] });
    await grantAccess(fixture, { accessTag, roles: consumerSkillReadRoles, skill });

    expect((await consumerGetSkill(fixture, skill.id, accessTags)).id).toBe(skill.id);
    await expectServiceError(
      skillGroupService.getSkillGroupById({
        project: fixture.project,
        instance: fixture.instance,
        skillGroupId: group.id,
        accessTags
      }),
      'not_found'
    );
    expect(await listGroups(fixture, { accessTags, ids: [group.id] })).toEqual([]);
    expect(await listItems(fixture, { accessTags, skillGroupIds: [group.id] })).toEqual([]);
  });
});
