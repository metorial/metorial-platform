import { eventually, expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { skillGroupItemService } from '../src';
import {
  addToGroup,
  archiveGroup,
  archiveSkill,
  captureFabric,
  createGroup,
  createSkill,
  getGroup,
  listGroups,
  privileged,
  searchToken,
  skillIdsOf,
  updateGroup
} from './_fixtures';

let searchIds = async (fixture: OrganizationFixture, search: string) =>
  (await listGroups(fixture, { search, statuses: ['active', 'archived'] })).map(
    group => group.id
  );

describe('module-skill-groups groups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a group with its skills and fires a created event', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createSkill(fixture);
    let second = await createSkill(fixture);
    let name = uniqueId('group');

    let created = captureFabric('skill.group.audit.created:after');
    let group = await createGroup(fixture, {
      name: `  ${name}  `,
      description: 'Grouped by the e2e suite',
      metadata: { team: 'e2e' },
      skillIds: [second.id, first.id],
      allowConsumerSkillAssignment: true
    }).finally(created.stop);

    expect(group).toMatchObject({
      name,
      description: 'Grouped by the e2e suite',
      metadata: { team: 'e2e' },
      status: 'active',
      allowConsumerSkillAssignment: true,
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid
    });
    expect(skillIdsOf(group).sort()).toEqual([first.id, second.id].sort());

    let events = created.events.filter(event => event.skillGroup.id === group.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.skillGroup).toMatchObject({ name, status: 'active' });
    expect([...events[0]!.skillGroup.skillIds].sort()).toEqual([first.id, second.id].sort());

    let fetched = await getGroup(fixture, group);
    expect(skillIdsOf(fetched).sort()).toEqual([first.id, second.id].sort());
  });

  it('only attaches active skills of the same organization on create', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let active = await createSkill(fixture);
    let archived = await createSkill(fixture);
    await archiveSkill(fixture, archived);
    let foreign = await createSkill(other);

    let group = await createGroup(fixture, {
      skillIds: [active.id, archived.id, foreign.id, uniqueId('skill_missing')]
    });

    expect(skillIdsOf(group)).toEqual([active.id]);
    let rows = await db.skillGroupItem.findMany({ where: { skillGroupOid: group.oid } });
    expect(rows.map(row => row.skillOid)).toEqual([active.oid]);
  });

  it('rejects blank names without writing anything', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = await db.skillGroup.count({ where: { instanceOid: fixture.instance.oid } });

    let error = await expectServiceError(createGroup(fixture, { name: '   ' }), 'bad_request');
    expect(error.message).toMatch(/name cannot be empty/);
    expect(await db.skillGroup.count({ where: { instanceOid: fixture.instance.oid } })).toBe(
      before
    );

    let group = await createGroup(fixture);
    await expectServiceError(updateGroup(fixture, group, { name: '' }), 'bad_request');
    expect((await getGroup(fixture, group)).name).toBe(group.name);
  });

  it('updates fields and fires an updated event with the previous state', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture, {
      description: 'Before',
      metadata: { version: 1 },
      skillIds: [skill.id]
    });
    let renamed = uniqueId('renamed-group');

    let updated = captureFabric('skill.group.audit.updated:after');
    let result = await updateGroup(fixture, group, {
      name: ` ${renamed} `,
      description: null,
      metadata: { version: 2 },
      allowConsumerSkillAssignment: true
    }).finally(updated.stop);

    expect(result).toMatchObject({
      id: group.id,
      name: renamed,
      description: null,
      metadata: { version: 2 },
      allowConsumerSkillAssignment: true
    });
    expect(skillIdsOf(result)).toEqual([skill.id]);
    expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(group.updatedAt.getTime());

    let [event] = updated.events.filter(item => item.skillGroup.id === group.id);
    expect(event!.previousSkillGroup).toMatchObject({
      name: group.name,
      description: 'Before'
    });
    expect(event!.skillGroup).toMatchObject({ name: renamed, description: null });
  });

  it('archives a group with its items and still lists it without a status filter', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture, { skillIds: [skill.id] });

    let archivedEvents = captureFabric('skill.group.audit.archived:after');
    let archived = await archiveGroup(fixture, group).finally(archivedEvents.stop);
    expect(archived).toMatchObject({ status: 'archived', items: [] });

    let [event] = archivedEvents.events.filter(item => item.skillGroup.id === group.id);
    expect(event!.skillGroup).toMatchObject({ status: 'archived', skillIds: [skill.id] });

    let items = await db.skillGroupItem.findMany({ where: { skillGroupOid: group.oid } });
    expect(items.map(item => item.status)).toEqual(['archived']);

    await expectServiceError(getGroup(fixture, group), 'not_found');
    expect((await getGroup(fixture, group, { allowDeleted: true })).status).toBe('archived');
    expect((await listGroups(fixture, { ids: [group.id] })).map(item => item.id)).toEqual([
      group.id
    ]);
    expect(await listGroups(fixture, { ids: [group.id], statuses: ['active'] })).toEqual([]);
    expect(await listGroups(fixture, { skillIds: [skill.id] })).toEqual([]);

    let again = await archiveGroup(fixture, group);
    expect(again.status).toBe('archived');

    let edited = await updateGroup(fixture, group, { description: 'Edited after archive' });
    expect(edited).toMatchObject({ status: 'archived', description: 'Edited after archive' });

    await expectServiceError(addToGroup(fixture, group, skill), 'not_found');
  });

  it('keeps groups inside their organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture, { skillIds: [skill.id] });

    await expectServiceError(getGroup(other, group, { allowDeleted: true }), 'not_found');
    expect(await listGroups(other, { ids: [group.id] })).toEqual([]);
    expect(await listGroups(other, { skillIds: [skill.id] })).toEqual([]);

    await expectServiceError(updateGroup(other, group, { name: 'Hijacked' }), 'not_found');
    await expectServiceError(archiveGroup(other, group), 'not_found');
    await expectServiceError(addToGroup(other, group, await createSkill(other)), 'not_found');
    await expectServiceError(
      skillGroupItemService.getSkillGroupItemById({
        project: other.project,
        instance: other.instance,
        skillGroupItemId: group.items[0]!.id,
        allowDeleted: true
      }),
      'not_found'
    );

    let row = await db.skillGroup.findUniqueOrThrow({
      where: { id: group.id },
      include: { items: true }
    });
    expect(row).toMatchObject({ name: group.name, status: 'active' });
    expect(row.items.map(item => item.status)).toEqual(['active']);
  });

  it('indexes groups for search by their own name and their skills', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let groupToken = searchToken();
    let skillToken = searchToken();
    let skill = await createSkill(fixture, { name: `Skill ${skillToken}` });
    let group = await createGroup(fixture, {
      name: `Group ${groupToken}`,
      skillIds: [skill.id]
    });

    await eventually(
      async () => {
        expect(await searchIds(fixture, groupToken)).toEqual([group.id]);
        expect(await searchIds(fixture, skillToken)).toEqual([group.id]);
      },
      { timeoutMs: 30_000, intervalMs: 500 }
    );
    expect(await searchIds(other, groupToken)).toEqual([]);

    let renamedToken = searchToken();
    await skillService.updateSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill,
      authorization: privileged,
      input: { name: `Skill ${renamedToken}` }
    });
    await eventually(
      async () => expect(await searchIds(fixture, renamedToken)).toEqual([group.id]),
      { timeoutMs: 30_000, intervalMs: 500 }
    );

    await archiveGroup(fixture, group);
    await eventually(async () => expect(await searchIds(fixture, groupToken)).toEqual([]), {
      timeoutMs: 30_000,
      intervalMs: 500
    });
  });
});
