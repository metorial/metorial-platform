import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import {
  skillMarketplacePluginService,
  skillMarketplaceService,
  skillPluginService
} from '../src';

// Creating marketplaces/plugins through the services provisions an Origin code bucket, which is
// not part of the e2e stack, so the rows are seeded directly with a placeholder bucket id.
let seedMarketplaceWithPlugin = async (fixture: OrganizationFixture) => {
  let createDestination = async () =>
    await db.skillDestination.create({
      data: {
        id: await ID.generateId('skillDestination'),
        codeBucketId: uniqueId('e2e-code-bucket')
      }
    });

  let marketplaceDestination = await createDestination();
  let marketplace = await db.skillMarketplace.create({
    data: {
      id: await ID.generateId('skillMarketplace'),
      name: uniqueId('marketplace'),
      description: 'Seeded by the e2e suite',
      slug: uniqueId('e2e-marketplace').toLowerCase(),
      organizationOid: fixture.organization.oid,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      destinationOid: marketplaceDestination.oid
    }
  });

  let pluginDestination = await createDestination();
  let plugin = await db.skillPlugin.create({
    data: {
      id: await ID.generateId('skillPlugin'),
      name: uniqueId('plugin'),
      slug: uniqueId('e2e-plugin').toLowerCase(),
      category: 'e2e',
      organizationOid: fixture.organization.oid,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      destinationOid: pluginDestination.oid
    }
  });

  let membership = await db.skillMarketplacePlugin.create({
    data: {
      id: await ID.generateId('skillMarketplacePlugin'),
      status: 'active',
      pluginSlug: plugin.slug!,
      skillMarketplaceOid: marketplace.oid,
      skillPluginOid: plugin.oid
    }
  });

  return { marketplace, plugin, membership };
};

describe('module-skill-marketplace', () => {
  let org = useOrganization();

  it('gets and lists a marketplace with its plugins', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let seeded = await seedMarketplaceWithPlugin(fixture);

    let marketplace = await skillMarketplaceService.getSkillMarketplaceById({
      project: fixture.project,
      instance: fixture.instance,
      skillMarketplaceId: seeded.marketplace.id
    });
    expect(marketplace.name).toBe(seeded.marketplace.name);
    expect(marketplace.destination?.codeBucketId).toBeTruthy();
    expect(marketplace.plugins.map(item => item.skillPlugin.id)).toEqual([seeded.plugin.id]);

    let listed = await firstPage(
      await skillMarketplaceService.listSkillMarketplaces({
        project: fixture.project,
        instance: fixture.instance,
        ids: [seeded.marketplace.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([seeded.marketplace.id]);

    let archivedOnly = await firstPage(
      await skillMarketplaceService.listSkillMarketplaces({
        project: fixture.project,
        instance: fixture.instance,
        ids: [seeded.marketplace.id],
        statuses: ['archived']
      })
    );
    expect(archivedOnly).toEqual([]);

    let memberships = await firstPage(
      await skillMarketplacePluginService.listSkillMarketplacePlugins({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplace: marketplace
      })
    );
    expect(memberships.map(item => item.id)).toEqual([seeded.membership.id]);

    let membership = await skillMarketplacePluginService.getSkillMarketplacePluginById({
      project: fixture.project,
      instance: fixture.instance,
      skillMarketplace: marketplace,
      skillMarketplacePluginId: seeded.membership.id
    });
    expect(membership.pluginSlug).toBe(seeded.plugin.slug);
  });

  it('gets and lists plugins filtered by marketplace and category', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let seeded = await seedMarketplaceWithPlugin(fixture);

    let plugin = await skillPluginService.getSkillPluginById({
      project: fixture.project,
      instance: fixture.instance,
      skillPluginId: seeded.plugin.id
    });
    expect(plugin.name).toBe(seeded.plugin.name);
    expect(plugin.skillPluginSkills).toEqual([]);

    let byMarketplace = await firstPage(
      await skillPluginService.listSkillPlugins({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplaceIds: [seeded.marketplace.id]
      })
    );
    expect(byMarketplace.map(item => item.id)).toEqual([seeded.plugin.id]);

    let otherCategory = await firstPage(
      await skillPluginService.listSkillPlugins({
        project: fixture.project,
        instance: fixture.instance,
        ids: [seeded.plugin.id],
        category: 'not-e2e'
      })
    );
    expect(otherCategory).toEqual([]);
  });

  it('updates marketplace settings without marking the destination dirty', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let seeded = await seedMarketplaceWithPlugin(fixture);
    let marketplace = await skillMarketplaceService.getSkillMarketplaceById({
      project: fixture.project,
      instance: fixture.instance,
      skillMarketplaceId: seeded.marketplace.id
    });

    let updated = await skillMarketplaceService.updateSkillMarketplace({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillMarketplace: marketplace,
      input: { forceMergeOrPush: true, mergeBeforeChecksPass: true }
    });
    expect(updated.forceMergeOrPush).toBe(true);
    expect(updated.mergeBeforeChecksPass).toBe(true);
    expect(updated.destination?.isDirty).toBe(false);

    let emptyUpdate = await rejectionOf(
      skillMarketplaceService.updateSkillMarketplace({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skillMarketplace: updated,
        input: {}
      })
    );
    expect(emptyUpdate.data.code).toBe('bad_request');
  });

  it('returns not found for unknown marketplaces and plugins', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let marketplace = await rejectionOf(
      skillMarketplaceService.getSkillMarketplaceById({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplaceId: 'skmkt_does_not_exist'
      })
    );
    expect(marketplace.data.code).toBe('not_found');

    let plugin = await rejectionOf(
      skillPluginService.getSkillPluginById({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginId: 'skplg_does_not_exist'
      })
    );
    expect(plugin.data.code).toBe('not_found');
  });
});
