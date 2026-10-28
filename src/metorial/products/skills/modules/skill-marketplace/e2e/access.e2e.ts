import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillMarketplaceService, skillPluginService } from '../src';
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
    it('lets marketplace writers add and remove plugins but not readers', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture);
      let reader = await consumerFor([
        { roles: marketplaceReadRoles, skillMarketplace: marketplace }
      ]);
      let writer = await consumerFor([
        { roles: marketplaceWriteRoles, skillMarketplace: marketplace }
      ]);

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

    it('only lets consumers archive plugins whose every marketplace they can write', async () => {
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
      await expectServiceError(
        archivePlugin(fixture, unlisted.id, writer.accessTags),
        'forbidden'
      );

      let archived = await archivePlugin(fixture, exclusive.id, writer.accessTags);
      expect(archived.status).toBe('archived');
      expect((await getPlugin(fixture, shared.id)).status).toBe('active');
    });

    it('limits consumer-attached skills to readable skills or the marketplace catalog', async () => {
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

      await expectServiceError(
        addSkillToPlugin(fixture, {
          skillPluginId: target.id,
          skillId: privateSkill.id,
          accessTags: writer.accessTags
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
