import { ID } from '@metorial/db';
import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import {
  getStoreResourceKindAccessWhere,
  skillStoreResourceKind
} from '@metorial/module-access';
import { skillService } from '@metorial/module-skill';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  getReadablePluginSkillGroupIds,
  getReadablePluginSkillIds,
  skillMarketplacePluginService,
  skillMarketplaceService,
  skillPluginService,
  skillPluginSkillService
} from '../src';
import {
  addPluginToMarketplace,
  addSkillToPlugin,
  archiveMarketplace,
  archivePlugin,
  createAccessTag,
  createMarketplace,
  createPlugin,
  createSkill,
  getMarketplace,
  getPlugin,
  grantAccess,
  marketplaceReadRoles,
  marketplaceWriteRoles,
  pluginWriteRoles,
  removePluginFromMarketplace,
  skillReadRoles,
  useFakeOrigin
} from './_fixtures';

type AccessTags = { accessTagOid: bigint }[];

describe('consumer access to marketplaces and plugins', () => {
  useFakeOrigin();
  let org = useOrganization();
  let outsider = useOrganization();

  let fixture: OrganizationFixture;
  let outsiderFixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    outsiderFixture = await loadOrganizationFixture(outsider.ids);
  });

  let consumerFor = async (
    grants: { roles: readonly string[]; skillMarketplace?: { oid: bigint } }[] = []
  ) => {
    let { accessTag, accessTags } = await createAccessTag(fixture);
    for (let grant of grants) await grantAccess(fixture, { accessTag, ...grant });
    return { accessTag, accessTags };
  };

  let listMarketplaceIds = async (accessTags: AccessTags, ids: string[]) =>
    (
      await firstPage(
        await skillMarketplaceService.listSkillMarketplaces({
          project: fixture.project,
          instance: fixture.instance,
          ids,
          accessTags
        })
      )
    ).map(item => item.id);

  let listPluginIds = async (accessTags: AccessTags, ids: string[]) =>
    (
      await firstPage(
        await skillPluginService.listSkillPlugins({
          project: fixture.project,
          instance: fixture.instance,
          ids,
          accessTags
        })
      )
    ).map(item => item.id);

  let updatePlugin = async (skillPluginId: string, accessTags: AccessTags) =>
    await skillPluginService.updateSkillPlugin({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillPlugin: await getPlugin(fixture, skillPluginId),
      accessTags,
      input: { description: 'Updated by a consumer' }
    });

  describe('reading', () => {
    it('scopes marketplaces and their plugins to the consumer grants', async () => {
      let readable = await createMarketplace(fixture);
      let hidden = await createMarketplace(fixture);
      let readablePlugin = await createPlugin(
        fixture,
        {},
        { skillMarketplaceId: readable.id }
      );
      let hiddenPlugin = await createPlugin(fixture, {}, { skillMarketplaceId: hidden.id });
      let standalonePlugin = await createPlugin(fixture);

      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: readable }
      ]);
      let writer = await consumerFor([
        { roles: marketplaceWriteRoles, skillMarketplace: hidden }
      ]);
      let nobody = await consumerFor();

      let marketplaceIds = [readable.id, hidden.id];
      let pluginIds = [readablePlugin.id, hiddenPlugin.id, standalonePlugin.id];

      expect(await listMarketplaceIds(reader.accessTags, marketplaceIds)).toEqual([
        readable.id
      ]);
      expect(await listPluginIds(reader.accessTags, pluginIds)).toEqual([readablePlugin.id]);
      expect((await getMarketplace(fixture, readable.id, reader.accessTags)).id).toBe(
        readable.id
      );
      await expectServiceError(
        getMarketplace(fixture, hidden.id, reader.accessTags),
        'not_found'
      );

      expect(await listMarketplaceIds(writer.accessTags, marketplaceIds)).toEqual([hidden.id]);
      expect(await listPluginIds(writer.accessTags, pluginIds)).toEqual([hiddenPlugin.id]);

      expect(await listMarketplaceIds(nobody.accessTags, marketplaceIds)).toEqual([]);
      expect(await listPluginIds(nobody.accessTags, pluginIds)).toEqual([]);
      await expectServiceError(
        getMarketplace(fixture, readable.id, nobody.accessTags),
        'not_found'
      );
    });

    it('hides archived marketplaces and their plugins even when they were granted', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);

      await archiveMarketplace(fixture, marketplace.id);

      await expectServiceError(
        getMarketplace(fixture, marketplace.id, reader.accessTags),
        'not_found'
      );
      expect(await listPluginIds(reader.accessTags, [plugin.id])).toEqual([]);
      expect((await getMarketplace(fixture, marketplace.id)).status).toBe('archived');
    });

    it('only lists active marketplaces and memberships to consumers, whatever status they ask for', async () => {
      let marketplace = await createMarketplace(fixture);
      let archivedMarketplace = await createMarketplace(fixture);
      await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace },
        { roles: marketplaceReadRoles, skillMarketplace: archivedMarketplace }
      ]);
      await removePluginFromMarketplace(
        fixture,
        (await getMarketplace(fixture, marketplace.id)).plugins[0]!.id
      );
      await archiveMarketplace(fixture, archivedMarketplace.id);

      let marketplaceIds = (
        await firstPage(
          await skillMarketplaceService.listSkillMarketplaces({
            project: fixture.project,
            instance: fixture.instance,
            ids: [marketplace.id, archivedMarketplace.id],
            statuses: ['archived'],
            accessTags: reader.accessTags
          })
        )
      ).map(item => item.id);
      let listMemberships = async (accessTags?: AccessTags) =>
        await firstPage(
          await skillMarketplacePluginService.listSkillMarketplacePlugins({
            project: fixture.project,
            instance: fixture.instance,
            skillMarketplace: await getMarketplace(fixture, marketplace.id),
            statuses: ['archived'],
            accessTags
          })
        );

      expect(marketplaceIds).toEqual([marketplace.id]);
      expect(await listMemberships(reader.accessTags)).toEqual([]);
      expect((await listMemberships()).map(item => item.status)).toEqual(['archived']);
    });

    it('drops a plugin from the consumer view once it leaves the granted marketplace', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);
      expect(await listPluginIds(reader.accessTags, [plugin.id])).toEqual([plugin.id]);

      let membership = (await getMarketplace(fixture, marketplace.id)).plugins[0]!;
      await removePluginFromMarketplace(fixture, membership.id);

      expect(await listPluginIds(reader.accessTags, [plugin.id])).toEqual([]);
    });
  });

  describe('marketplace writes', () => {
    it('lets marketplace writers add plugins they can write and remove plugins, but not readers', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture);
      let unrelated = await createPlugin(fixture);
      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);
      let writer = await consumerFor([
        { roles: marketplaceWriteRoles, skillMarketplace: marketplace }
      ]);
      await grantAccess(fixture, {
        accessTag: writer.accessTag,
        roles: pluginWriteRoles,
        skillPlugin: plugin
      });

      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: unrelated.id,
          accessTags: writer.accessTags
        }),
        'forbidden'
      );
      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: plugin.id,
          accessTags: reader.accessTags
        }),
        'forbidden'
      );

      let membership = await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: plugin.id,
        accessTags: writer.accessTags
      });
      expect(membership.status).toBe('active');

      await expectServiceError(
        removePluginFromMarketplace(fixture, membership.id, reader.accessTags),
        'forbidden'
      );
      let removed = await removePluginFromMarketplace(
        fixture,
        membership.id,
        writer.accessTags
      );
      expect(removed.status).toBe('archived');
    });

    it('requires a writable marketplace for consumer-created plugins', async () => {
      let marketplace = await createMarketplace(fixture);
      let hidden = await createMarketplace(fixture);
      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);
      let writer = await consumerFor([
        { roles: marketplaceWriteRoles, skillMarketplace: marketplace }
      ]);

      await expectServiceError(
        createPlugin(fixture, {}, { accessTags: writer.accessTags }),
        'bad_request'
      );
      await expectServiceError(
        createPlugin(
          fixture,
          {},
          { accessTags: writer.accessTags, skillMarketplaceId: hidden.id }
        ),
        'not_found'
      );
      await expectServiceError(
        createPlugin(
          fixture,
          {},
          { accessTags: reader.accessTags, skillMarketplaceId: marketplace.id }
        ),
        'forbidden'
      );

      let plugin = await createPlugin(
        fixture,
        {},
        { accessTags: writer.accessTags, skillMarketplaceId: marketplace.id }
      );
      expect(
        (await getMarketplace(fixture, marketplace.id)).plugins.map(
          item => item.skillPlugin.id
        )
      ).toEqual([plugin.id]);
    });
  });

  describe('plugin writes', () => {
    it('grants plugin writes through a writable marketplace or a direct plugin grant', async () => {
      let marketplace = await createMarketplace(fixture);
      let listed = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let standalone = await createPlugin(fixture);

      let marketplaceWriter = await consumerFor([
        { roles: marketplaceWriteRoles, skillMarketplace: marketplace }
      ]);
      let marketplaceReader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);
      let pluginWriter = await consumerFor();
      await grantAccess(fixture, {
        accessTag: pluginWriter.accessTag,
        roles: pluginWriteRoles,
        skillPlugin: standalone
      });

      expect((await updatePlugin(listed.id, marketplaceWriter.accessTags)).description).toBe(
        'Updated by a consumer'
      );
      expect((await updatePlugin(standalone.id, pluginWriter.accessTags)).description).toBe(
        'Updated by a consumer'
      );

      await expectServiceError(
        updatePlugin(listed.id, marketplaceReader.accessTags),
        'forbidden'
      );
      await expectServiceError(
        updatePlugin(standalone.id, marketplaceWriter.accessTags),
        'forbidden'
      );
      await expectServiceError(updatePlugin(listed.id, pluginWriter.accessTags), 'forbidden');

      let membership = (await getMarketplace(fixture, marketplace.id)).plugins[0]!;
      await removePluginFromMarketplace(fixture, membership.id);
      await expectServiceError(
        updatePlugin(listed.id, marketplaceWriter.accessTags),
        'forbidden'
      );
    });

    it('lets consumers archive plugins they manage or whose every marketplace they can write', async () => {
      let writable = await createMarketplace(fixture);
      let foreignToConsumer = await createMarketplace(fixture);
      let shared = await createPlugin(fixture, {}, { skillMarketplaceId: writable.id });
      await addPluginToMarketplace(fixture, {
        skillMarketplaceId: foreignToConsumer.id,
        skillPluginId: shared.id
      });
      let exclusive = await createPlugin(fixture, {}, { skillMarketplaceId: writable.id });
      let unlisted = await createPlugin(fixture);

      let writer = await consumerFor([
        { roles: marketplaceWriteRoles, skillMarketplace: writable }
      ]);
      await grantAccess(fixture, {
        accessTag: writer.accessTag,
        roles: pluginWriteRoles,
        skillPlugin: unlisted
      });

      await expectServiceError(
        archivePlugin(fixture, shared.id, writer.accessTags),
        'forbidden'
      );
      let archived = await archivePlugin(fixture, exclusive.id, writer.accessTags);
      let archivedUnlisted = await archivePlugin(fixture, unlisted.id, writer.accessTags);
      expect([archived.status, archivedUnlisted.status]).toEqual(['archived', 'archived']);
      expect((await getPlugin(fixture, shared.id)).status).toBe('active');
    });

    it('lets plugin managers archive their plugin from every marketplace it is in', async () => {
      let first = await createMarketplace(fixture);
      let second = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: first.id });
      await addPluginToMarketplace(fixture, {
        skillMarketplaceId: second.id,
        skillPluginId: plugin.id
      });
      let manager = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: first }
      ]);
      await grantAccess(fixture, {
        accessTag: manager.accessTag,
        roles: pluginWriteRoles,
        skillPlugin: plugin
      });

      expect((await archivePlugin(fixture, plugin.id, manager.accessTags)).status).toBe(
        'archived'
      );
      expect(
        await db.skillMarketplacePlugin.count({
          where: { skillPluginOid: plugin.oid, status: 'active' }
        })
      ).toBe(0);
    });

    it('limits consumer-attached skills to skills the consumer can read', async () => {
      let marketplace = await createMarketplace(fixture);
      let source = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let target = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });

      let catalogSkill = await createSkill(fixture);
      await addSkillToPlugin(fixture, { skillPluginId: source.id, skillId: catalogSkill.id });
      let readableSkill = await createSkill(fixture);
      let privateSkill = await createSkill(fixture);

      let writer = await consumerFor([
        { roles: marketplaceWriteRoles, skillMarketplace: marketplace }
      ]);
      await grantAccess(fixture, {
        accessTag: writer.accessTag,
        roles: skillReadRoles,
        skill: readableSkill
      });
      let targetManager = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);
      await grantAccess(fixture, {
        accessTag: targetManager.accessTag,
        roles: pluginWriteRoles,
        skillPlugin: target
      });

      await expectServiceError(
        addSkillToPlugin(fixture, {
          skillPluginId: target.id,
          skillId: privateSkill.id,
          accessTags: writer.accessTags
        }),
        'forbidden'
      );
      await expectServiceError(
        addSkillToPlugin(fixture, {
          skillPluginId: target.id,
          skillId: catalogSkill.id,
          accessTags: targetManager.accessTags
        }),
        'forbidden'
      );

      let fromCatalog = await addSkillToPlugin(fixture, {
        skillPluginId: target.id,
        skillId: catalogSkill.id,
        accessTags: writer.accessTags
      });
      let fromReadable = await addSkillToPlugin(fixture, {
        skillPluginId: target.id,
        skillId: readableSkill.id,
        accessTags: writer.accessTags
      });
      expect([fromCatalog.status, fromReadable.status]).toEqual(['active', 'active']);

      expect(
        await db.skillPluginSkill.count({
          where: { skillPluginOid: target.oid, skillOid: privateSkill.oid }
        })
      ).toBe(0);
    });
  });

  describe('skill reads through marketplace management', () => {
    let canReadSkill = async (skillId: string, accessTags: AccessTags) => {
      try {
        await skillService.getSkillById({
          project: fixture.project,
          instance: fixture.instance,
          skillId,
          accessTags
        });
        return true;
      } catch (error: any) {
        if (error?.data?.code == 'not_found') return false;
        throw error;
      }
    };

    let readableSkillIds = async (accessTags: AccessTags, skills: { id: string }[]) => {
      let readable: string[] = [];
      for (let skill of skills) {
        if (await canReadSkill(skill.id, accessTags)) readable.push(skill.id);
      }
      return readable;
    };

    let canWriteSkillStore = async (skill: { oid: bigint }, accessTags: AccessTags) =>
      !!(await db.skill.findFirst({
        where: {
          oid: skill.oid,
          store: {
            is: await getStoreResourceKindAccessWhere({
              kind: skillStoreResourceKind,
              accessTags,
              level: 'write'
            })
          }
        }
      }));

    let catalog = async () => {
      let marketplace = await createMarketplace(fixture);
      let firstPlugin = await createPlugin(
        fixture,
        {},
        { skillMarketplaceId: marketplace.id }
      );
      let secondPlugin = await createPlugin(
        fixture,
        {},
        { skillMarketplaceId: marketplace.id }
      );
      let otherMarketplace = await createMarketplace(fixture);
      let otherPlugin = await createPlugin(
        fixture,
        {},
        { skillMarketplaceId: otherMarketplace.id }
      );

      let [firstSkill, secondSkill, otherSkill, unlistedSkill] = await Promise.all([
        createSkill(fixture),
        createSkill(fixture),
        createSkill(fixture),
        createSkill(fixture)
      ]);
      await addSkillToPlugin(fixture, {
        skillPluginId: firstPlugin.id,
        skillId: firstSkill.id
      });
      await addSkillToPlugin(fixture, {
        skillPluginId: secondPlugin.id,
        skillId: secondSkill.id
      });
      await addSkillToPlugin(fixture, {
        skillPluginId: otherPlugin.id,
        skillId: otherSkill.id
      });

      return {
        marketplace,
        firstPlugin,
        secondPlugin,
        skills: { firstSkill, secondSkill, otherSkill, unlistedSkill },
        allSkills: [firstSkill, secondSkill, otherSkill, unlistedSkill]
      };
    };

    let marketplaceManager = (marketplace: { oid: bigint }) =>
      consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace },
        { roles: marketplaceWriteRoles, skillMarketplace: marketplace }
      ]);

    let pluginManager = async (marketplace: { oid: bigint }, plugin: { oid: bigint }) => {
      let consumer = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);
      await grantAccess(fixture, {
        accessTag: consumer.accessTag,
        roles: pluginWriteRoles,
        skillPlugin: plugin
      });
      return consumer;
    };

    it('lets marketplace managers read every skill in the marketplace without writing them', async () => {
      let { marketplace, skills, allSkills } = await catalog();
      let manager = await marketplaceManager(marketplace);
      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);

      expect(await readableSkillIds(manager.accessTags, allSkills)).toEqual([
        skills.firstSkill.id,
        skills.secondSkill.id
      ]);
      expect(await readableSkillIds(reader.accessTags, allSkills)).toEqual([]);

      expect(await canWriteSkillStore(skills.firstSkill, manager.accessTags)).toBe(false);
    });

    it('limits plugin managers to the skills of their own plugins', async () => {
      let { marketplace, firstPlugin, skills, allSkills } = await catalog();
      let manager = await pluginManager(marketplace, firstPlugin);

      expect(await readableSkillIds(manager.accessTags, allSkills)).toEqual([
        skills.firstSkill.id
      ]);

      let membership = (await getMarketplace(fixture, marketplace.id)).plugins.find(
        plugin => plugin.skillPluginOid == firstPlugin.oid
      )!;
      await removePluginFromMarketplace(fixture, membership.id);

      expect(await readableSkillIds(manager.accessTags, allSkills)).toEqual([]);
    });

    it('follows skills leaving the plugin and the marketplace being archived', async () => {
      let { marketplace, firstPlugin, skills } = await catalog();
      let manager = await marketplaceManager(marketplace);

      let pluginSkill = (await getPlugin(fixture, firstPlugin.id)).skillPluginSkills.find(
        link => link.skill.id == skills.firstSkill.id
      )!;
      await skillPluginSkillService.removeSkillPluginSkill({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginSkill: await skillPluginSkillService.getSkillPluginSkillById({
          project: fixture.project,
          instance: fixture.instance,
          skillPluginSkillId: pluginSkill.id
        })
      });

      expect(await canReadSkill(skills.firstSkill.id, manager.accessTags)).toBe(false);
      expect(await canReadSkill(skills.secondSkill.id, manager.accessTags)).toBe(true);

      await archiveMarketplace(fixture, marketplace.id);

      expect(await canReadSkill(skills.secondSkill.id, manager.accessTags)).toBe(false);
    });

    it('marks only the readable plugin skills for the consumer', async () => {
      let { marketplace, firstPlugin, secondPlugin, skills } = await catalog();
      let manager = await pluginManager(marketplace, firstPlugin);
      let plugins = [
        await getPlugin(fixture, firstPlugin.id),
        await getPlugin(fixture, secondPlugin.id)
      ];

      expect([
        ...(await getReadablePluginSkillIds({ plugins, accessTags: manager.accessTags }))
      ]).toEqual([skills.firstSkill.id]);
      expect([...(await getReadablePluginSkillIds({ plugins }))].sort()).toEqual(
        [skills.firstSkill.id, skills.secondSkill.id].sort()
      );
    });
  });

  describe('skill group links', () => {
    it('only marks skill groups the consumer can read as readable', async () => {
      let createGroup = async () =>
        await db.skillGroup.create({
          data: {
            id: await ID.generateId('skillGroup'),
            name: 'Linked group',
            organizationOid: fixture.organization.oid,
            instanceOid: fixture.instance.oid
          }
        });
      let readable = await createGroup();
      let hidden = await createGroup();
      let consumer = await consumerFor();
      await grantAccess(fixture, {
        accessTag: consumer.accessTag,
        roles: skillReadRoles,
        skillGroup: readable
      });

      let plugins = [readable, hidden, null].map(skillGroup => ({
        skillGroupPlugin: skillGroup ? { skillGroup } : null
      }));

      expect([
        ...(await getReadablePluginSkillGroupIds({ plugins, accessTags: consumer.accessTags }))
      ]).toEqual([readable.id]);
      expect([...(await getReadablePluginSkillGroupIds({ plugins }))].sort()).toEqual(
        [readable.id, hidden.id].sort()
      );
    });
  });

  describe('outsiders', () => {
    it('cannot reach marketplaces of another organization with their own grants', async () => {
      let marketplace = await createMarketplace(fixture);
      let { accessTag, accessTags } = await createAccessTag(outsiderFixture);
      await grantAccess(outsiderFixture, {
        accessTag,
        roles: marketplaceWriteRoles,
        skillMarketplace: marketplace
      });

      await expectServiceError(
        skillMarketplaceService.getSkillMarketplaceById({
          project: outsiderFixture.project,
          instance: outsiderFixture.instance,
          skillMarketplaceId: marketplace.id,
          accessTags
        }),
        'not_found'
      );
      expect(
        await firstPage(
          await skillMarketplaceService.listSkillMarketplaces({
            project: outsiderFixture.project,
            instance: outsiderFixture.instance,
            accessTags
          })
        )
      ).toEqual([]);
      await expectServiceError(
        createPlugin(outsiderFixture, {}, { accessTags, skillMarketplaceId: marketplace.id }),
        'not_found'
      );
    });
  });
});
