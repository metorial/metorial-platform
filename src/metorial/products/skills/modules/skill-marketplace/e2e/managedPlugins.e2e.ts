import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { resourceActorService } from '@metorial/module-resource-actor';
import { skillService } from '@metorial/module-skill';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  managedSkillPluginService,
  skillExportService,
  skillPluginRepositoryService,
  skillPluginService,
  skillPluginSkillService
} from '../src';
import {
  addPluginToMarketplace,
  addSkillToPlugin,
  archiveMarketplace,
  archivePlugin,
  createMarketplace,
  createPlugin,
  createSkill,
  getPlugin,
  getSkill,
  privileged,
  useFakeOrigin
} from './_fixtures';

describe('managed skill plugins and exports', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  let other = useOrganization();

  let fixture: OrganizationFixture;
  let otherFixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    otherFixture = await loadOrganizationFixture(other.ids);
  });

  let loadManagedPlugin = async (skill: { oid: bigint }) =>
    await db.managedSkillPlugin.findUniqueOrThrow({
      where: { skillOid: skill.oid },
      include: {
        skillPlugin: {
          include: { destination: true, skillPluginSkills: true }
        }
      }
    });

  // The stack worker cannot reach the fake Origin, so the managed-plugin lifecycle handler runs
  // in-process; skill lifecycle events still reach the worker, which can only fail on create.
  let syncManagedPlugin = async (
    skill: { id: string; oid: bigint },
    event: 'created' | 'updated' | 'archived' = 'created'
  ) => {
    await managedSkillPluginService.syncManagedSkillPluginForSkill({
      skillId: skill.id,
      event
    });
    return await loadManagedPlugin(skill);
  };

  let ensure = async (target: OrganizationFixture, skillId: string) =>
    await managedSkillPluginService.ensureManagedSkillPlugin({
      project: target.project,
      instance: target.instance,
      skillId
    });

  let createActor = async (target: OrganizationFixture) =>
    await resourceActorService.upsertActor({
      project: target.project,
      input: { identifier: uniqueId('e2e-export-actor'), name: 'E2E export actor' }
    });

  describe('managed plugins', () => {
    it('provisions one managed plugin per skill from the lifecycle handler', async () => {
      let skill = await createSkill(fixture, {
        name: 'Meeting Notes',
        description: 'Summarises meetings'
      });

      let managed = await syncManagedPlugin(skill);
      expect(managed.skillPlugin).toMatchObject({
        isManaged: true,
        status: 'active',
        name: 'Meeting Notes',
        description: 'Summarises meetings',
        projectOid: fixture.project.oid,
        instanceOid: fixture.instance.oid
      });
      expect(managed.skillPlugin.slug).toMatch(/^managed-meeting-notes-[a-z0-9]{12}$/);
      expect(
        managed.skillPlugin.skillPluginSkills.map(link => ({
          skillOid: link.skillOid,
          status: link.status,
          slug: link.pluginSkillSlug
        }))
      ).toEqual([{ skillOid: skill.oid, status: 'active', slug: 'meeting-notes' }]);
      expect(
        origin.bucketCreation(managed.skillPlugin.destination!.codeBucketId)?.payload
      ).toMatchObject({ purpose: 'cargo.skill.managed-plugin', isReadOnly: false });

      let ensured = await ensure(fixture, skill.id);
      expect(ensured.id).toBe(managed.id);
      expect(ensured.skillPlugin.id).toBe(managed.skillPlugin.id);
      expect((await syncManagedPlugin(skill)).skillPlugin.id).toBe(managed.skillPlugin.id);
      expect(await db.managedSkillPlugin.count({ where: { skillOid: skill.oid } })).toBe(1);
      expect(
        await db.skillPluginSkill.count({
          where: { skillOid: skill.oid, skillPlugin: { isManaged: true } }
        })
      ).toBe(1);
    });

    it('hides managed plugins and refuses manual changes to them', async () => {
      let skill = await createSkill(fixture);
      let other = await createSkill(fixture);
      let managed = await syncManagedPlugin(skill);
      let plugin = await getPlugin(fixture, managed.skillPlugin.id);
      let marketplace = await createMarketplace(fixture);

      expect(plugin.isManaged).toBe(true);
      expect(
        await firstPage(
          await skillPluginService.listSkillPlugins({
            project: fixture.project,
            instance: fixture.instance,
            ids: [plugin.id],
            statuses: ['active', 'archived']
          })
        )
      ).toEqual([]);

      await expectServiceError(
        skillPluginService.updateSkillPlugin({
          project: fixture.project,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          skillPlugin: plugin,
          input: { name: 'Hijacked' }
        }),
        'bad_request'
      );
      await expectServiceError(archivePlugin(fixture, plugin.id), 'bad_request');
      await expectServiceError(
        addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: other.id }),
        'bad_request'
      );
      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: plugin.id
        }),
        'bad_request'
      );

      let link = await skillPluginSkillService.getSkillPluginSkillById({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginSkillId: plugin.skillPluginSkills[0]!.id
      });
      await expectServiceError(
        skillPluginSkillService.updateSkillPluginSkill({
          project: fixture.project,
          instance: fixture.instance,
          skillPluginSkill: link,
          input: { clientName: 'Hijacked' }
        }),
        'bad_request'
      );
      await expectServiceError(
        skillPluginSkillService.removeSkillPluginSkill({
          project: fixture.project,
          instance: fixture.instance,
          skillPluginSkill: link
        }),
        'bad_request'
      );

      await expectServiceError(
        skillPluginRepositoryService.createSkillPluginRepository({
          project: fixture.project,
          instance: fixture.instance,
          skillPluginId: plugin.id,
          repoId: origin.addRepository()
        }),
        'not_found'
      );

      let unchanged = await getPlugin(fixture, plugin.id);
      expect(unchanged.name).toBe(plugin.name);
      expect(unchanged.status).toBe('active');
      expect(unchanged.skillPluginSkills.map(item => item.id)).toEqual([link.id]);
    });

    it('follows skill renames and archives the plugin with the skill', async () => {
      let skill = await createSkill(fixture, { name: 'Draft Name' });
      let managed = await syncManagedPlugin(skill);

      await skillService.updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await getSkill(fixture, skill.id),
        authorization: privileged,
        input: { name: 'Final Name', description: 'Final description' }
      });

      let renamed = await syncManagedPlugin(skill, 'updated');
      expect(renamed.skillPlugin.id).toBe(managed.skillPlugin.id);
      expect(await getPlugin(fixture, managed.skillPlugin.id)).toMatchObject({
        name: 'Final Name',
        description: 'Final description',
        status: 'active'
      });

      await skillService.archiveSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await getSkill(fixture, skill.id),
        authorization: privileged
      });

      let archived = await syncManagedPlugin(skill, 'archived');
      expect(archived.skillPlugin.status).toBe('archived');
      expect(archived.skillPlugin.skillPluginSkills.map(link => link.status)).toEqual([
        'archived'
      ]);

      await expectServiceError(ensure(fixture, skill.id), 'not_found');
      expect(
        await managedSkillPluginService.syncManagedSkillPluginForSkill({
          skillId: skill.id,
          event: 'updated'
        })
      ).toBeNull();
      expect((await loadManagedPlugin(skill)).skillPlugin.status).toBe('archived');
    });

    it('does not provision managed plugins across organizations', async () => {
      let skill = await createSkill(fixture);
      await syncManagedPlugin(skill);

      await expectServiceError(ensure(otherFixture, skill.id), 'not_found');
      await expectServiceError(ensure(fixture, 'skl_does_not_exist'), 'not_found');
    });
  });

  describe('exports', () => {
    it('shares one export ref per target and scopes exports to their creator', async () => {
      let skill = await createSkill(fixture);
      let managed = await syncManagedPlugin(skill);
      let creator = await createActor(fixture);
      let colleague = await createActor(fixture);

      let first = await skillExportService.createSkillExport({
        project: fixture.project,
        instance: fixture.instance,
        input: { target: 'skill', skillId: skill.id },
        actor: creator
      });
      let second = await skillExportService.createSkillExport({
        project: fixture.project,
        instance: fixture.instance,
        input: { target: 'skill', skillId: skill.id },
        actor: colleague
      });

      expect(first).toMatchObject({
        status: 'pending',
        target: 'skill',
        creatorResourceActorOid: creator.oid,
        exportRef: {
          skill: { id: skill.id },
          managedSkillPlugin: { id: managed.id },
          skillPlugin: { id: managed.skillPlugin.id }
        }
      });
      expect(second.id).not.toBe(first.id);
      expect(second.exportRefOid).toBe(first.exportRefOid);

      let listIds = async (filters: {
        actor?: typeof creator;
        targets?: ('skill' | 'plugin' | 'marketplace')[];
      }) =>
        (
          await firstPage(
            await skillExportService.listSkillExports({
              project: fixture.project,
              instance: fixture.instance,
              ids: [first.id, second.id],
              ...filters
            })
          )
        )
          .map(item => item.id)
          .sort();

      expect(await listIds({ actor: creator })).toEqual([first.id]);
      expect(await listIds({ actor: colleague })).toEqual([second.id]);
      expect(await listIds({})).toEqual([first.id, second.id].sort());
      expect(await listIds({ targets: ['plugin'] })).toEqual([]);

      let fetched = await skillExportService.getSkillExportById({
        project: fixture.project,
        instance: fixture.instance,
        skillExportId: first.id,
        actor: creator
      });
      expect(fetched.id).toBe(first.id);

      await expectServiceError(
        skillExportService.getSkillExportById({
          project: fixture.project,
          instance: fixture.instance,
          skillExportId: first.id,
          actor: colleague
        }),
        'not_found'
      );
      await expectServiceError(
        skillExportService.getSkillExportById({
          project: otherFixture.project,
          instance: otherFixture.instance,
          skillExportId: first.id
        }),
        'not_found'
      );
    });

    it('starts the export in the worker and forces a sync of the never-synced destination', async () => {
      let skill = await createSkill(fixture);
      let managed = await syncManagedPlugin(skill);

      let skillExport = await skillExportService.createSkillExport({
        project: fixture.project,
        instance: fixture.instance,
        input: { target: 'skill', skillId: skill.id }
      });

      await eventually(
        async () => {
          let stored = await db.skillExport.findUniqueOrThrow({
            where: { id: skillExport.id }
          });
          expect(stored.startedAt).not.toBeNull();

          let syncs = await db.skillDestinationSync.findMany({
            where: {
              destinationOid: managed.skillPlugin.destinationOid!,
              createdAt: { gte: skillExport.createdAt }
            }
          });
          expect(syncs.length).toBeGreaterThan(0);
        },
        { timeoutMs: 45_000, intervalMs: 500 }
      );
    });

    it('resolves plugin and marketplace targets and rejects unknown, archived or foreign ones', async () => {
      let plugin = await createPlugin(fixture);
      let marketplace = await createMarketplace(fixture);
      let archivedPlugin = await createPlugin(fixture);
      await archivePlugin(fixture, archivedPlugin.id);
      let archivedMarketplace = await createMarketplace(fixture);
      await archiveMarketplace(fixture, archivedMarketplace.id);
      let foreignPlugin = await createPlugin(otherFixture);
      let foreignSkill = await createSkill(otherFixture);

      let create = (
        input: Parameters<typeof skillExportService.createSkillExport>[0]['input']
      ) =>
        skillExportService.createSkillExport({
          project: fixture.project,
          instance: fixture.instance,
          input
        });

      let pluginExport = await create({ target: 'plugin', skillPluginId: plugin.id });
      expect(pluginExport).toMatchObject({
        target: 'plugin',
        exportRef: { skillPlugin: { id: plugin.id }, skill: null, skillMarketplace: null }
      });

      let marketplaceExport = await create({
        target: 'marketplace',
        skillMarketplaceId: marketplace.id
      });
      expect(marketplaceExport).toMatchObject({
        target: 'marketplace',
        exportRef: { skillMarketplace: { id: marketplace.id }, skillPlugin: null }
      });
      expect(marketplaceExport.exportRefOid).not.toBe(pluginExport.exportRefOid);

      await expectServiceError(
        create({ target: 'plugin', skillPluginId: 'skplg_does_not_exist' }),
        'not_found'
      );
      await expectServiceError(
        create({ target: 'plugin', skillPluginId: archivedPlugin.id }),
        'not_found'
      );
      await expectServiceError(
        create({ target: 'plugin', skillPluginId: foreignPlugin.id }),
        'not_found'
      );
      await expectServiceError(
        create({ target: 'marketplace', skillMarketplaceId: 'skmkt_does_not_exist' }),
        'not_found'
      );
      await expectServiceError(
        create({ target: 'marketplace', skillMarketplaceId: archivedMarketplace.id }),
        'not_found'
      );
      await expectServiceError(
        create({ target: 'skill', skillId: foreignSkill.id }),
        'not_found'
      );

      await expectServiceError(
        skillExportService.createSkillExport({
          project: fixture.project,
          instance: fixture.instance,
          input: { target: 'plugin', skillPluginId: plugin.id },
          actor: await createActor(otherFixture)
        }),
        'bad_request'
      );
    });
  });
});
