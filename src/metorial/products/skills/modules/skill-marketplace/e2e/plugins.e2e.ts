import { eventually, expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { skillService } from '@metorial/module-skill';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillPluginService, skillPluginSkillService } from '../src';
import {
  addSkillToPlugin,
  archivePlugin,
  captureFabric,
  createMarketplace,
  createPlugin,
  createSkill,
  createSkillConfiguration,
  getMarketplace,
  getPlugin,
  getSkill,
  privileged,
  useFakeOrigin
} from './_fixtures';

describe('skill plugins', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  let other = useOrganization();

  let fixture: OrganizationFixture;
  let otherFixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    otherFixture = await loadOrganizationFixture(other.ids);
  });

  let listPlugins = async (
    target: OrganizationFixture,
    filters: Omit<
      Parameters<typeof skillPluginService.listSkillPlugins>[0],
      'project' | 'instance'
    >
  ) =>
    (
      await firstPage(
        await skillPluginService.listSkillPlugins({
          project: target.project,
          instance: target.instance,
          ...filters
        })
      )
    ).map(item => item.id);

  let getPluginSkill = async (target: OrganizationFixture, skillPluginSkillId: string) =>
    await skillPluginSkillService.getSkillPluginSkillById({
      project: target.project,
      instance: target.instance,
      skillPluginSkillId
    });

  let listPluginSkills = async (skillPluginId: string, statuses?: ('active' | 'archived')[]) =>
    (
      await firstPage(
        await skillPluginSkillService.listSkillPluginSkills({
          project: fixture.project,
          instance: fixture.instance,
          skillPlugin: await getPlugin(fixture, skillPluginId),
          statuses
        })
      )
    ).map(item => item.id);

  describe('lifecycle', () => {
    it('creates a standalone plugin with its own code bucket and fires plugin events', async () => {
      let before = captureFabric('skill.plugin.created:before');
      let after = captureFabric('skill.plugin.created:after');
      let audit = captureFabric('skill.plugin.audit.created:after');

      try {
        let plugin = await createPlugin(fixture, {
          name: 'Docs Helper',
          slug: 'docs_helper',
          category: 'writing',
          longDescription: 'Helps with docs'
        });

        expect(plugin).toMatchObject({
          status: 'active',
          isManaged: false,
          name: 'Docs Helper',
          slug: 'docs-helper',
          category: 'writing',
          longDescription: 'Helps with docs',
          skillPluginSkills: []
        });
        expect(origin.bucketCreation(plugin.destination!.codeBucketId)?.payload.purpose).toBe(
          'cargo.skill.destination'
        );
        expect(
          await db.skillMarketplacePlugin.count({ where: { skillPluginOid: plugin.oid } })
        ).toBe(0);

        expect(
          before.events.some(event => event.organization.oid === fixture.organization.oid)
        ).toBe(true);
        expect(after.events.filter(event => event.skillPlugin.id === plugin.id)).toHaveLength(
          1
        );
        expect(audit.events.filter(event => event.skillPlugin.id === plugin.id)).toHaveLength(
          1
        );

        expect(await listPlugins(fixture, { ids: [plugin.id] })).toEqual([plugin.id]);
        expect(await listPlugins(fixture, { ids: [plugin.id], category: 'writing' })).toEqual([
          plugin.id
        ]);
      } finally {
        before.stop();
        after.stop();
        audit.stop();
      }
    });

    it('creates a plugin inside a marketplace with a derived, unique membership slug', async () => {
      let marketplace = await createMarketplace(fixture);

      let first = await createPlugin(
        fixture,
        { name: 'Sales Kit' },
        { skillMarketplaceId: marketplace.id }
      );
      let second = await createPlugin(
        fixture,
        { name: 'Other Kit', slug: 'sales-kit' },
        { skillMarketplaceId: marketplace.id }
      );

      let memberships = (await getMarketplace(fixture, marketplace.id)).plugins;
      expect(
        memberships.map(item => ({ plugin: item.skillPlugin.id, slug: item.pluginSlug }))
      ).toEqual([
        { plugin: first.id, slug: 'sales-kit' },
        { plugin: second.id, slug: 'sales-kit-2' }
      ]);
      expect(await listPlugins(fixture, { skillMarketplaceIds: [marketplace.id] })).toEqual(
        expect.arrayContaining([first.id, second.id])
      );
    });

    it('validates create input', async () => {
      let foreignMarketplace = await createMarketplace(otherFixture);

      await expectServiceError(createPlugin(fixture, { name: ' ' }), 'bad_request');
      await expectServiceError(
        createPlugin(fixture, { skillConfigurationId: 'sklcfg_does_not_exist' }),
        'not_found'
      );
      await expectServiceError(
        createPlugin(fixture, {}, { skillMarketplaceId: foreignMarketplace.id }),
        'not_found'
      );
    });

    it('updates plugin fields and fires updated events with the previous state', async () => {
      let plugin = await createPlugin(fixture);
      let configuration = await createSkillConfiguration(fixture, {});
      let updatedEvents = captureFabric('skill.plugin.updated:after');
      let audit = captureFabric('skill.plugin.audit.updated:after');

      try {
        let updated = await skillPluginService.updateSkillPlugin({
          project: fixture.project,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          skillPlugin: plugin,
          input: {
            name: 'Renamed plugin',
            description: 'New description',
            longDescription: null,
            category: 'ops',
            skillConfigurationId: configuration.id
          }
        });

        expect(updated).toMatchObject({
          name: 'Renamed plugin',
          description: 'New description',
          longDescription: null,
          category: 'ops',
          slug: plugin.slug,
          skillConfiguration: { id: configuration.id }
        });
        expect(
          updatedEvents.events.filter(event => event.skillPlugin.id === plugin.id)
        ).toHaveLength(1);

        let event = audit.events.find(event => event.skillPlugin.id === plugin.id);
        expect(event?.previousSkillPlugin.name).toBe(plugin.name);
        expect(event?.skillPlugin.name).toBe('Renamed plugin');
      } finally {
        updatedEvents.stop();
        audit.stop();
      }

      let update = (
        input: Parameters<typeof skillPluginService.updateSkillPlugin>[0]['input']
      ) =>
        skillPluginService.updateSkillPlugin({
          project: fixture.project,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          skillPlugin: plugin,
          input
        });

      await expectServiceError(update({}), 'bad_request');
      await expectServiceError(update({ name: '' }), 'bad_request');
      await expectServiceError(
        update({ skillConfigurationId: 'sklcfg_does_not_exist' }),
        'not_found'
      );
    });

    it('archives skill links and memberships, frees the marketplace slug and fires events', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(
        fixture,
        { name: 'Archive Me' },
        { skillMarketplaceId: marketplace.id }
      );
      let skill = await createSkill(fixture);
      let link = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id,
        clientName: 'Override',
        license: 'MIT'
      });

      let archivedEvents = captureFabric('skill.plugin.archived:after');
      let audit = captureFabric('skill.plugin.audit.archived:after');

      try {
        let archived = await archivePlugin(fixture, plugin.id);
        expect(archived.status).toBe('archived');
        expect(archived.skillPluginSkills).toEqual([]);

        expect(
          archivedEvents.events.filter(event => event.skillPlugin.id === plugin.id)
        ).toHaveLength(1);
        expect(audit.events.filter(event => event.skillPlugin.id === plugin.id)).toHaveLength(
          1
        );
      } finally {
        archivedEvents.stop();
        audit.stop();
      }

      let archivedLink = await db.skillPluginSkill.findUniqueOrThrow({
        where: { id: link.id }
      });
      expect(archivedLink).toMatchObject({
        status: 'archived',
        clientName: null,
        license: null
      });

      let membership = await db.skillMarketplacePlugin.findFirstOrThrow({
        where: { skillPluginOid: plugin.oid }
      });
      expect(membership.status).toBe('archived');
      expect(membership.pluginSlug).not.toBe('archive-me');

      expect((await getMarketplace(fixture, marketplace.id)).plugins).toEqual([]);
      expect(await listPlugins(fixture, { ids: [plugin.id] })).toEqual([]);
      expect(await listPlugins(fixture, { ids: [plugin.id], statuses: ['archived'] })).toEqual(
        [plugin.id]
      );

      let replacement = await createPlugin(
        fixture,
        { name: 'Archive Me' },
        { skillMarketplaceId: marketplace.id }
      );
      let replacementMembership = (await getMarketplace(fixture, marketplace.id)).plugins[0]!;
      expect(replacementMembership.skillPlugin.id).toBe(replacement.id);
      expect(replacementMembership.pluginSlug).toBe('archive-me');
    });
  });

  describe('plugin skills', () => {
    it('assigns slugs, keeps re-adds idempotent and refuses slug changes', async () => {
      let plugin = await createPlugin(fixture);
      let first = await createSkill(fixture, { name: 'Code Review' });
      let second = await createSkill(fixture, { name: 'Code Review' });

      let firstLink = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: first.id,
        clientName: 'Reviewer',
        clientDescription: 'Reviews code',
        clientMetadata: { team: 'platform' },
        license: 'MIT',
        compatibility: 'claude-code'
      });
      expect(firstLink).toMatchObject({
        status: 'active',
        pluginSkillSlug: 'code-review',
        clientName: 'Reviewer',
        clientDescription: 'Reviews code',
        clientMetadata: { team: 'platform' },
        license: 'MIT',
        compatibility: 'claude-code'
      });

      let secondLink = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: second.id
      });
      expect(secondLink.pluginSkillSlug).toMatch(/^code-review-[a-z0-9]{2}$/i);

      let again = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: first.id
      });
      expect(again.id).toBe(firstLink.id);
      expect(again.clientName).toBe('Reviewer');

      await expectServiceError(
        addSkillToPlugin(fixture, {
          skillPluginId: plugin.id,
          skillId: first.id,
          pluginSkillSlug: 'renamed-review'
        }),
        'bad_request'
      );
      await expectServiceError(
        addSkillToPlugin(fixture, {
          skillPluginId: plugin.id,
          skillId: second.id,
          pluginSkillSlug: 'code-review'
        }),
        'bad_request'
      );

      let reloaded = await getPlugin(fixture, plugin.id);
      expect(reloaded.skillPluginSkills.map(item => item.id)).toEqual([
        firstLink.id,
        secondLink.id
      ]);
    });

    it('updates overrides, clears them on removal and reactivates the same link', async () => {
      let plugin = await createPlugin(fixture);
      let skill = await createSkill(fixture, { name: 'Release Notes' });
      let configuration = await createSkillConfiguration(fixture, {});
      let link = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id
      });

      let updated = await skillPluginSkillService.updateSkillPluginSkill({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginSkill: await getPluginSkill(fixture, link.id),
        input: { clientName: 'Notes', skillConfigurationId: configuration.id }
      });
      expect(updated.clientName).toBe('Notes');
      expect(updated.skillConfiguration?.id).toBe(configuration.id);

      await expectServiceError(
        skillPluginSkillService.updateSkillPluginSkill({
          project: fixture.project,
          instance: fixture.instance,
          skillPluginSkill: updated,
          input: {}
        }),
        'bad_request'
      );

      let removed = await skillPluginSkillService.removeSkillPluginSkill({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginSkill: updated
      });
      expect(removed).toMatchObject({
        status: 'archived',
        pluginSkillSlug: link.pluginSkillSlug,
        clientName: null,
        skillConfigurationOid: null
      });
      expect(await listPluginSkills(plugin.id)).toEqual([]);
      expect(await listPluginSkills(plugin.id, ['archived'])).toEqual([link.id]);

      let readded = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id
      });
      expect(readded).toMatchObject({
        id: link.id,
        status: 'active',
        pluginSkillSlug: link.pluginSkillSlug,
        clientName: null
      });
    });

    it('refuses archived plugins, archived skills and foreign skills', async () => {
      let plugin = await createPlugin(fixture);
      let archivedPlugin = await createPlugin(fixture);
      await archivePlugin(fixture, archivedPlugin.id);

      let skill = await createSkill(fixture);
      let archivedSkill = await createSkill(fixture);
      await skillService.archiveSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await getSkill(fixture, archivedSkill.id),
        authorization: privileged
      });
      let foreignSkill = await createSkill(otherFixture);

      await expectServiceError(
        addSkillToPlugin(fixture, { skillPluginId: archivedPlugin.id, skillId: skill.id }),
        'not_found'
      );
      await expectServiceError(
        addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: archivedSkill.id }),
        'not_found'
      );
      await expectServiceError(
        addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: foreignSkill.id }),
        'not_found'
      );

      expect(
        await db.skillPluginSkill.count({
          where: { skillPluginOid: { in: [plugin.oid, archivedPlugin.oid] } }
        })
      ).toBe(0);
    });

    it('retires a skill from its plugins when the skill is archived', async () => {
      let plugin = await createPlugin(fixture);
      let skill = await createSkill(fixture);
      let link = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id
      });

      await skillService.archiveSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await getSkill(fixture, skill.id),
        authorization: privileged
      });

      await eventually(async () => {
        expect((await getPlugin(fixture, plugin.id)).skillPluginSkills).toEqual([]);
      });
      expect(
        (await db.skillPluginSkill.findUniqueOrThrow({ where: { id: link.id } })).status
      ).toBe('archived');
    });
  });

  describe('tenant isolation', () => {
    it('hides plugins and plugin skills from other organizations', async () => {
      let plugin = await createPlugin(fixture);
      let skill = await createSkill(fixture);
      let link = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id
      });

      await expectServiceError(getPlugin(otherFixture, plugin.id), 'not_found');
      expect(await listPlugins(otherFixture, { ids: [plugin.id] })).toEqual([]);
      await expectServiceError(getPluginSkill(otherFixture, link.id), 'not_found');
      await expectServiceError(
        addSkillToPlugin(otherFixture, { skillPluginId: plugin.id, skillId: skill.id }),
        'not_found'
      );
      await expectServiceError(archivePlugin(otherFixture, plugin.id), 'not_found');
    });
  });
});
