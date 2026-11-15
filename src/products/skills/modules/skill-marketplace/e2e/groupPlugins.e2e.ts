import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  enqueueSkillGroupPluginSync,
  skillGroupPluginService,
  skillPluginService,
  skillPluginSkillService
} from '../src';
import { maxSkillPluginSkills } from '../src/lib/limits';
import {
  addSkillToPlugin,
  captureFabric,
  createMarketplace,
  createPlugin,
  createSkill,
  getMarketplace,
  getPlugin,
  useFakeOrigin,
  useSkillsManifestSyncFlag
} from './_fixtures';

// skill-groups depends on this module, so its services can't be imported here; groups and
// their items are written directly and the plugin sync is driven through this module's API.
let createGroup = async (
  target: OrganizationFixture,
  skills: { oid: bigint }[],
  input: { name?: string; description?: string | null } = {}
) => {
  let group = await db.skillGroup.create({
    data: {
      id: await ID.generateId('skillGroup'),
      name: input.name ?? uniqueId('group'),
      description: input.description ?? null,
      organizationOid: target.organization.oid,
      instanceOid: target.instance.oid
    }
  });

  for (let skill of skills) await addGroupItem(group, skill);

  return group;
};

let addGroupItem = async (group: { oid: bigint }, skill: { oid: bigint }) =>
  await db.skillGroupItem.create({
    data: {
      id: await ID.generateId('skillGroupItem'),
      skillGroupOid: group.oid,
      skillOid: skill.oid
    }
  });

let setGroupItemStatus = async (
  group: { oid: bigint },
  skill: { oid: bigint },
  status: 'active' | 'archived'
) =>
  await db.skillGroupItem.update({
    where: { skillGroupOid_skillOid: { skillGroupOid: group.oid, skillOid: skill.oid } },
    data: { status }
  });

let createBareSkill = async (
  target: OrganizationFixture,
  input: { ownerType?: 'instance' | 'consumer'; status?: 'active' | 'archived' } = {}
) =>
  await db.skill.create({
    data: {
      id: await ID.generateId('skill'),
      name: uniqueId('skill'),
      storeId: uniqueId('store'),
      skillEntityId: uniqueId('entity'),
      ownerType: input.ownerType,
      status: input.status,
      organizationOid: target.organization.oid,
      projectOid: target.project.oid,
      instanceOid: target.instance.oid
    }
  });

let createGroupPlugin = async (
  target: OrganizationFixture,
  group: { id: string },
  opts: { skillMarketplaceId?: string; name?: string } = {}
) =>
  await createPlugin(
    target,
    { name: opts.name, description: undefined, skillGroupId: group.id },
    { skillMarketplaceId: opts.skillMarketplaceId }
  );

let syncPlugin = async (skillPluginId: string) => {
  let link = await db.skillGroupPlugin.findFirstOrThrow({
    where: { skillPlugin: { id: skillPluginId } }
  });
  await skillGroupPluginService.syncSkillGroupPlugin({ skillGroupPluginId: link.id });
};

let pluginSkillIds = async (target: OrganizationFixture, skillPluginId: string) =>
  (await getPlugin(target, skillPluginId)).skillPluginSkills.map(link => link.skill.id).sort();

useFakeOrigin();
useSkillsManifestSyncFlag(false);

describe('skill group plugins', () => {
  let org = useOrganization();
  let other = useOrganization();

  let fixture: OrganizationFixture;
  let otherFixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    otherFixture = await loadOrganizationFixture(other.ids);
  });

  it('creates a plugin from a group, seeding its metadata and syncing the active skills', async () => {
    let [first, second, removed] = await Promise.all([
      createSkill(fixture),
      createSkill(fixture),
      createSkill(fixture)
    ]);
    let archivedSkill = await createBareSkill(fixture, { status: 'archived' });
    let group = await createGroup(fixture, [first, second, removed, archivedSkill], {
      name: 'Design Kit',
      description: 'Everything design'
    });
    await setGroupItemStatus(group, removed, 'archived');
    let marketplace = await createMarketplace(fixture);
    let audit = captureFabric('skill.plugin.audit.created:after');
    let plugin = await createGroupPlugin(fixture, group, {
      skillMarketplaceId: marketplace.id
    }).finally(() => audit.stop());

    expect(audit.events.find(event => event.skillPlugin.id === plugin.id)?.skillGroupId).toBe(
      group.id
    );

    expect(plugin).toMatchObject({
      name: 'Design Kit',
      description: 'Everything design',
      isManaged: false,
      skillGroupPlugin: { skillGroup: { id: group.id, name: 'Design Kit' } }
    });
    expect(plugin.skillPluginSkills.map(link => link.skill.id).sort()).toEqual(
      [first.id, second.id].sort()
    );
    expect(
      (await getMarketplace(fixture, marketplace.id)).plugins.map(item => item.skillPlugin.id)
    ).toEqual([plugin.id]);

    let link = await db.skillGroupPlugin.findUniqueOrThrow({
      where: { skillPluginOid: plugin.oid }
    });
    expect(link.syncIssues).toBeNull();
    expect(link.lastReconciledAt).not.toBeNull();

    let listed = async (skillGroupIds: string[]) =>
      (
        await firstPage(
          await skillPluginService.listSkillPlugins({
            project: fixture.project,
            instance: fixture.instance,
            skillGroupIds
          })
        )
      ).map(item => item.id);
    expect(await listed([group.id])).toEqual([plugin.id]);
    expect(await listed([])).toEqual([]);

    let renamed = await skillPluginService.updateSkillPlugin({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillPlugin: plugin,
      input: { name: 'Renamed Kit', description: null }
    });
    expect(renamed).toMatchObject({ name: 'Renamed Kit', description: null });
    expect(await db.skillGroup.findUniqueOrThrow({ where: { oid: group.oid } })).toMatchObject(
      {
        name: 'Design Kit',
        description: 'Everything design'
      }
    );
  });

  it('validates the group on create', async () => {
    let archivedGroup = await db.skillGroup.update({
      where: { oid: (await createGroup(fixture, [])).oid },
      data: { status: 'archived' }
    });

    await expectServiceError(
      createGroupPlugin(fixture, { id: 'skg_does_not_exist' }),
      'not_found'
    );
    await expectServiceError(createGroupPlugin(fixture, archivedGroup), 'not_found');
    await expectServiceError(createPlugin(fixture, { name: undefined }), 'bad_request');
  });

  it('follows group membership and keeps slugs when a skill comes back', async () => {
    let [first, second] = await Promise.all([createSkill(fixture), createSkill(fixture)]);
    let group = await createGroup(fixture, [first]);
    let plugin = await createGroupPlugin(fixture, group);
    let firstLink = plugin.skillPluginSkills[0]!;

    await addGroupItem(group, second);
    await syncPlugin(plugin.id);
    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([first.id, second.id].sort());

    await setGroupItemStatus(group, first, 'archived');
    await syncPlugin(plugin.id);
    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([second.id]);
    expect(
      await db.skillPluginSkill.findUniqueOrThrow({ where: { oid: firstLink.oid } })
    ).toMatchObject({ status: 'archived' });

    await setGroupItemStatus(group, first, 'active');
    await syncPlugin(plugin.id);
    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([first.id, second.id].sort());
    expect(
      await db.skillPluginSkill.findUniqueOrThrow({ where: { oid: firstLink.oid } })
    ).toMatchObject({ status: 'active', pluginSkillSlug: firstLink.pluginSkillSlug });
    expect(
      await db.skillPluginSkill.count({
        where: { skillPluginOid: plugin.oid, skillOid: first.oid }
      })
    ).toBe(1);

    await db.skill.update({ where: { oid: second.oid }, data: { status: 'archived' } });
    await syncPlugin(plugin.id);
    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([first.id]);
  });

  it('syncs consumer-owned skills', async () => {
    let consumerSkill = await createBareSkill(fixture, { ownerType: 'consumer' });
    let group = await createGroup(fixture, [consumerSkill]);

    let plugin = await createGroupPlugin(fixture, group);

    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([consumerSkill.id]);
  });

  it('rejects direct skill edits on a group plugin', async () => {
    let [member, outsider] = await Promise.all([createSkill(fixture), createSkill(fixture)]);
    let group = await createGroup(fixture, [member]);
    let plugin = await createGroupPlugin(fixture, group);
    let pluginSkill = await skillPluginSkillService.getSkillPluginSkillById({
      project: fixture.project,
      instance: fixture.instance,
      skillPluginSkillId: plugin.skillPluginSkills[0]!.id
    });

    let error = await expectServiceError(
      addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: outsider.id }),
      'skill_plugin_managed_by_skill_group'
    );
    expect(error.message).toContain(group.id);
    await expectServiceError(
      skillPluginSkillService.updateSkillPluginSkill({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginSkill: pluginSkill,
        input: { clientName: 'Override' }
      }),
      'skill_plugin_managed_by_skill_group'
    );
    await expectServiceError(
      skillPluginSkillService.removeSkillPluginSkill({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginSkill: pluginSkill
      }),
      'skill_plugin_managed_by_skill_group'
    );

    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([member.id]);
  });

  it('syncs every plugin linked to a group through the queue', async () => {
    let [first, second] = await Promise.all([createSkill(fixture), createSkill(fixture)]);
    let group = await createGroup(fixture, [first]);
    let [marketplace, otherMarketplace] = await Promise.all([
      createMarketplace(fixture),
      createMarketplace(fixture)
    ]);
    let plugin = await createGroupPlugin(fixture, group, {
      skillMarketplaceId: marketplace.id
    });
    let otherPlugin = await createGroupPlugin(fixture, group, {
      skillMarketplaceId: otherMarketplace.id
    });

    await addGroupItem(group, second);
    await enqueueSkillGroupPluginSync({ skillGroupIds: [group.id] });

    await eventually(async () => {
      expect(await pluginSkillIds(fixture, plugin.id)).toEqual([first.id, second.id].sort());
      expect(await pluginSkillIds(fixture, otherPlugin.id)).toEqual(
        [first.id, second.id].sort()
      );
    });
  });

  it('archives its plugins once the group is archived', async () => {
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture, [skill]);
    let plugin = await createGroupPlugin(fixture, group);

    await db.skillGroup.update({ where: { oid: group.oid }, data: { status: 'archived' } });
    await syncPlugin(plugin.id);

    let archived = await db.skillPlugin.findUniqueOrThrow({ where: { oid: plugin.oid } });
    expect(archived.status).toBe('archived');
    expect(
      await db.skillPluginSkill.count({
        where: { skillPluginOid: plugin.oid, status: 'active' }
      })
    ).toBe(0);
  });

  it('allows archiving a group plugin directly without touching the group', async () => {
    let skill = await createSkill(fixture);
    let group = await createGroup(fixture, [skill]);
    let plugin = await createGroupPlugin(fixture, group);

    await skillPluginService.archiveSkillPlugin({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillPlugin: plugin
    });
    await syncPlugin(plugin.id);

    expect(
      (await db.skillPlugin.findUniqueOrThrow({ where: { oid: plugin.oid } })).status
    ).toBe('archived');
    expect((await db.skillGroup.findUniqueOrThrow({ where: { oid: group.oid } })).status).toBe(
      'active'
    );
  });

  it('detaches a plugin from its group, keeping its skills and making them editable', async () => {
    let [member, outsider] = await Promise.all([createSkill(fixture), createSkill(fixture)]);
    let group = await createGroup(fixture, [member]);
    let plugin = await createGroupPlugin(fixture, group);
    let audit = captureFabric('skill.plugin.audit.updated:after');

    try {
      let detached = await skillGroupPluginService.detachSkillGroupPlugin({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skillPlugin: plugin
      });
      expect(detached.skillGroupPlugin).toBeNull();

      let event = audit.events.find(event => event.skillPlugin.id === plugin.id);
      expect(event).toMatchObject({ skillGroupId: null, previousSkillGroupId: group.id });
    } finally {
      audit.stop();
    }

    expect(await db.skillGroupPlugin.count({ where: { skillPluginOid: plugin.oid } })).toBe(0);
    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([member.id]);

    await addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: outsider.id });
    expect(await pluginSkillIds(fixture, plugin.id)).toEqual([member.id, outsider.id].sort());

    await expectServiceError(
      skillGroupPluginService.detachSkillGroupPlugin({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skillPlugin: await getPlugin(fixture, plugin.id)
      }),
      'skill_plugin_not_managed_by_skill_group'
    );
  });

  it('isolates groups between tenants', async () => {
    let foreignGroup = await createGroup(otherFixture, [await createBareSkill(otherFixture)]);

    await expectServiceError(createGroupPlugin(fixture, foreignGroup), 'not_found');
  });
});

describe('skill group plugin limits', () => {
  let org = useOrganization();

  let fixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
  });

  let createBareSkills = async (count: number) =>
    await Promise.all(Array.from({ length: count }, () => createBareSkill(fixture)));

  it('rejects creating a plugin from a group with more skills than a plugin can hold', async () => {
    let group = await createGroup(fixture, await createBareSkills(maxSkillPluginSkills + 1));

    await expectServiceError(createGroupPlugin(fixture, group), 'bad_request');
    expect(
      await db.skillPlugin.count({ where: { skillGroupPlugin: { skillGroupOid: group.oid } } })
    ).toBe(0);
  });

  it('vetoes group additions past the plugin limit and records skills it could not sync', async () => {
    let group = await createGroup(fixture, await createBareSkills(maxSkillPluginSkills - 1));
    let plugin = await createGroupPlugin(fixture, group);
    let [fits, overflow] = await createBareSkills(2);

    await skillGroupPluginService.assertSkillGroupCanAddSkills({
      skillGroup: group,
      skills: [fits!]
    });
    let error = await expectServiceError(
      skillGroupPluginService.assertSkillGroupCanAddSkills({
        skillGroup: group,
        skills: [fits!, overflow!]
      }),
      'skill_group_plugin_limit_exceeded'
    );
    expect(error.message).toContain(plugin.name!);

    await addGroupItem(group, fits!);
    await addGroupItem(group, overflow!);
    await syncPlugin(plugin.id);

    expect(
      await db.skillPluginSkill.count({
        where: { skillPluginOid: plugin.oid, status: 'active' }
      })
    ).toBe(maxSkillPluginSkills);
    expect(
      (await db.skillGroupPlugin.findUniqueOrThrow({ where: { skillPluginOid: plugin.oid } }))
        .syncIssues
    ).toEqual([
      { skillId: overflow!.id, reason: 'limit_exceeded', message: expect.any(String) }
    ]);

    await setGroupItemStatus(group, fits!, 'archived');
    await syncPlugin(plugin.id);

    let link = await db.skillGroupPlugin.findUniqueOrThrow({
      where: { skillPluginOid: plugin.oid }
    });
    expect(link.syncIssues).toBeNull();
    expect(
      await db.skillPluginSkill.count({
        where: { skillPluginOid: plugin.oid, skillOid: overflow!.oid, status: 'active' }
      })
    ).toBe(1);
  });

  it('ignores archived group plugins in the veto', async () => {
    let group = await createGroup(fixture, await createBareSkills(maxSkillPluginSkills));
    let plugin = await createGroupPlugin(fixture, group);
    await skillPluginService.archiveSkillPlugin({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillPlugin: plugin
    });

    await skillGroupPluginService.assertSkillGroupCanAddSkills({
      skillGroup: group,
      skills: await createBareSkills(1)
    });
  });
});
