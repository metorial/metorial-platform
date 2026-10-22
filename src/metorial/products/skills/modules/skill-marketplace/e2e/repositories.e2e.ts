import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillMarketplaceRepositoryService, skillPluginRepositoryService } from '../src';
import {
  archiveMarketplace,
  archivePlugin,
  createMarketplace,
  createPlugin,
  useFakeOrigin
} from './_fixtures';

describe('skill repositories', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  let other = useOrganization();

  let fixture: OrganizationFixture;
  let otherFixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    otherFixture = await loadOrganizationFixture(other.ids);
  });

  let linkMarketplace = async (
    target: OrganizationFixture,
    skillMarketplaceId: string,
    repoId: string
  ) =>
    await skillMarketplaceRepositoryService.createSkillMarketplaceRepository({
      project: target.project,
      instance: target.instance,
      skillMarketplaceId,
      repoId
    });

  let linkPlugin = async (
    target: OrganizationFixture,
    skillPluginId: string,
    repoId: string
  ) =>
    await skillPluginRepositoryService.createSkillPluginRepository({
      project: target.project,
      instance: target.instance,
      skillPluginId,
      repoId
    });

  let listMarketplaceLinks = async (target: OrganizationFixture, skillMarketplaceId: string) =>
    (
      await firstPage(
        await skillMarketplaceRepositoryService.listSkillMarketplaceRepositories({
          project: target.project,
          instance: target.instance,
          skillMarketplaceId
        })
      )
    ).map(item => item.id);

  let listPluginLinks = async (target: OrganizationFixture, skillPluginId: string) =>
    (
      await firstPage(
        await skillPluginRepositoryService.listSkillPluginRepositories({
          project: target.project,
          instance: target.instance,
          skillPluginId
        })
      )
    ).map(item => item.id);

  describe('marketplace repositories', () => {
    it('links an Origin repository, forces a repository sync and stays idempotent', async () => {
      let marketplace = await createMarketplace(fixture);
      let repoId = origin.addRepository({ owner: 'acme', name: 'skills' });

      let link = await linkMarketplace(fixture, marketplace.id, repoId);
      expect(link.skillRepository).toMatchObject({
        repoId,
        projectOid: fixture.project.oid,
        instanceOid: fixture.instance.oid,
        originRepository: {
          object: 'origin#repository',
          id: repoId,
          externalOwner: 'acme',
          externalName: 'skills',
          defaultBranch: 'main'
        }
      });

      let syncs = await db.skillDestinationSync.findMany({
        where: { destinationOid: marketplace.destinationOid! }
      });
      expect(syncs).toHaveLength(1);

      let again = await linkMarketplace(fixture, marketplace.id, repoId);
      expect(again.id).toBe(link.id);
      expect(await listMarketplaceLinks(fixture, marketplace.id)).toEqual([link.id]);
      expect(
        await db.skillDestinationSync.count({
          where: { destinationOid: marketplace.destinationOid! }
        })
      ).toBe(1);

      let fetched = await skillMarketplaceRepositoryService.getSkillMarketplaceRepositoryById({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplaceId: marketplace.id,
        skillMarketplaceRepositoryId: link.id
      });
      expect(fetched.skillRepository.originRepository?.externalUrl).toBe(
        'https://github.com/acme/skills'
      );
    });

    it('unlinks a repository and reuses the same skill repository when relinked', async () => {
      let marketplace = await createMarketplace(fixture);
      let repoId = origin.addRepository();
      let link = await linkMarketplace(fixture, marketplace.id, repoId);

      let deleted = await skillMarketplaceRepositoryService.deleteSkillMarketplaceRepository({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplaceId: marketplace.id,
        skillMarketplaceRepositoryId: link.id
      });
      expect(deleted.id).toBe(link.id);
      expect(await listMarketplaceLinks(fixture, marketplace.id)).toEqual([]);
      await expectServiceError(
        skillMarketplaceRepositoryService.getSkillMarketplaceRepositoryById({
          project: fixture.project,
          instance: fixture.instance,
          skillMarketplaceId: marketplace.id,
          skillMarketplaceRepositoryId: link.id
        }),
        'not_found'
      );

      let relinked = await linkMarketplace(fixture, marketplace.id, repoId);
      expect(relinked.id).not.toBe(link.id);
      expect(relinked.skillRepository.id).toBe(link.skillRepository.id);
    });

    it('frees the repository when the marketplace is archived', async () => {
      let marketplace = await createMarketplace(fixture);
      let replacement = await createMarketplace(fixture);
      let repoId = origin.addRepository();
      await linkMarketplace(fixture, marketplace.id, repoId);

      await archiveMarketplace(fixture, marketplace.id);

      await expectServiceError(
        skillMarketplaceRepositoryService.listSkillMarketplaceRepositories({
          project: fixture.project,
          instance: fixture.instance,
          skillMarketplaceId: marketplace.id
        }),
        'not_found'
      );
      let link = await linkMarketplace(fixture, replacement.id, repoId);
      expect(link.skillMarketplaceOid).toBe(replacement.oid);
    });
  });

  describe('plugin repositories', () => {
    it('links a repository to a plugin and forces a plugin sync', async () => {
      let plugin = await createPlugin(fixture);
      let repoId = origin.addRepository();

      let link = await linkPlugin(fixture, plugin.id, repoId);
      expect(link.skillRepository.originRepository?.id).toBe(repoId);
      expect(await listPluginLinks(fixture, plugin.id)).toEqual([link.id]);
      expect(
        await db.skillDestinationSync.count({
          where: { destinationOid: plugin.destinationOid! }
        })
      ).toBe(1);

      let deleted = await skillPluginRepositoryService.deleteSkillPluginRepository({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginId: plugin.id,
        skillPluginRepositoryId: link.id
      });
      expect(deleted.id).toBe(link.id);
      expect(await listPluginLinks(fixture, plugin.id)).toEqual([]);
    });

    it('frees the repository when the plugin is archived', async () => {
      let plugin = await createPlugin(fixture);
      let replacement = await createPlugin(fixture);
      let repoId = origin.addRepository();
      await linkPlugin(fixture, plugin.id, repoId);

      await archivePlugin(fixture, plugin.id);

      await expectServiceError(listPluginLinks(fixture, plugin.id), 'not_found');
      expect(
        await db.skillPluginRepository.count({ where: { skillPluginOid: plugin.oid } })
      ).toBe(0);

      let link = await linkPlugin(fixture, replacement.id, repoId);
      expect(link.skillPluginOid).toBe(replacement.oid);
    });
  });

  describe('validation', () => {
    it('refuses unknown repositories and repositories that are already linked', async () => {
      let marketplace = await createMarketplace(fixture);
      let otherMarketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture);
      let repoId = origin.addRepository();
      await linkMarketplace(fixture, marketplace.id, repoId);

      await expectServiceError(
        linkMarketplace(fixture, marketplace.id, 'osr_does_not_exist'),
        'not_found'
      );
      await expectServiceError(
        linkPlugin(fixture, plugin.id, 'osr_does_not_exist'),
        'not_found'
      );
      expect(await db.skillRepository.count({ where: { repoId: 'osr_does_not_exist' } })).toBe(
        0
      );

      await expectServiceError(
        linkMarketplace(fixture, otherMarketplace.id, repoId),
        'bad_request'
      );
      await expectServiceError(linkPlugin(fixture, plugin.id, repoId), 'bad_request');

      let pluginRepoId = origin.addRepository();
      await linkPlugin(fixture, plugin.id, pluginRepoId);
      await expectServiceError(
        linkMarketplace(fixture, otherMarketplace.id, pluginRepoId),
        'bad_request'
      );
    });

    it('refuses repositories that are linked in another organization', async () => {
      let marketplace = await createMarketplace(fixture);
      let foreignMarketplace = await createMarketplace(otherFixture);
      let repoId = origin.addRepository();
      await linkMarketplace(fixture, marketplace.id, repoId);

      await expectServiceError(
        linkMarketplace(otherFixture, foreignMarketplace.id, repoId),
        'bad_request'
      );
      expect(
        await db.skillMarketplaceRepository.count({
          where: { skillMarketplaceOid: foreignMarketplace.oid }
        })
      ).toBe(0);
    });
  });

  describe('tenant isolation', () => {
    it('hides repository links from other organizations', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture);
      let marketplaceLink = await linkMarketplace(
        fixture,
        marketplace.id,
        origin.addRepository()
      );
      let pluginLink = await linkPlugin(fixture, plugin.id, origin.addRepository());

      await expectServiceError(
        listMarketplaceLinks(otherFixture, marketplace.id),
        'not_found'
      );
      await expectServiceError(listPluginLinks(otherFixture, plugin.id), 'not_found');
      await expectServiceError(
        skillMarketplaceRepositoryService.deleteSkillMarketplaceRepository({
          project: otherFixture.project,
          instance: otherFixture.instance,
          skillMarketplaceId: marketplace.id,
          skillMarketplaceRepositoryId: marketplaceLink.id
        }),
        'not_found'
      );
      await expectServiceError(
        skillPluginRepositoryService.deleteSkillPluginRepository({
          project: otherFixture.project,
          instance: otherFixture.instance,
          skillPluginId: plugin.id,
          skillPluginRepositoryId: pluginLink.id
        }),
        'not_found'
      );

      expect(await listMarketplaceLinks(fixture, marketplace.id)).toEqual([
        marketplaceLink.id
      ]);
      expect(await listPluginLinks(fixture, plugin.id)).toEqual([pluginLink.id]);
    });
  });
});
