import { forbiddenError, ServiceError } from '@lowerdeck/error';
import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { Fabric } from '@metorial/fabric';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  skillMarketplacePluginService,
  skillMarketplaceRepositoryService,
  skillMarketplaceService,
  skillSyncService
} from '../src';
import {
  addPluginToMarketplace,
  addSkillToPlugin,
  archiveMarketplace,
  archivePlugin,
  captureFabric,
  createMarketplace,
  createPlugin,
  createSkill,
  createSkillConfiguration,
  getMarketplace,
  originTenantId,
  removePluginFromMarketplace,
  useFakeOrigin
} from './_fixtures';

let searchToken = () => uniqueId('srch').replace(/-/g, '');

describe('skill marketplaces', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  let other = useOrganization();

  let fixture: OrganizationFixture;
  let otherFixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    otherFixture = await loadOrganizationFixture(other.ids);
  });

  let listMarketplaces = async (
    target: OrganizationFixture,
    filters: Omit<
      Parameters<typeof skillMarketplaceService.listSkillMarketplaces>[0],
      'project' | 'instance'
    >
  ) =>
    await firstPage(
      await skillMarketplaceService.listSkillMarketplaces({
        project: target.project,
        instance: target.instance,
        ...filters
      })
    );

  describe('lifecycle', () => {
    it('provisions an Origin code bucket and fires the metering and audit events on create', async () => {
      let before = captureFabric('skill.marketplace.created:before');
      let after = captureFabric('skill.marketplace.created:after');
      let audit = captureFabric('skill.marketplace.audit.created:after');

      try {
        let marketplace = await createMarketplace(fixture, {
          name: 'Team Tools',
          slug: 'team_tools'
        });

        expect(marketplace.status).toBe('active');
        expect(marketplace.slug).toMatch(/^team-tools-[a-z0-9]{6}$/);
        expect(marketplace.plugins).toEqual([]);

        let bucket = origin.bucketCreation(marketplace.destination!.codeBucketId);
        expect(bucket?.payload).toEqual({
          tenantId: originTenantId(fixture),
          purpose: 'cargo.skill.destination',
          isReadOnly: false
        });
        expect(origin.callsTo('tenant:upsert').map(call => call.payload)).toContainEqual({
          identifier: `mte-pro-${fixture.project.oid}`,
          name: fixture.project.name
        });

        expect(
          before.events.some(
            event =>
              event.organization.oid === fixture.organization.oid &&
              event.instance.oid === fixture.instance.oid
          )
        ).toBe(true);
        expect(
          after.events.filter(event => event.skillMarketplace.id === marketplace.id)
        ).toHaveLength(1);
        expect(
          audit.events.filter(event => event.skillMarketplace.id === marketplace.id)
        ).toHaveLength(1);

        let destination = await db.skillDestination.findUniqueOrThrow({
          where: { oid: marketplace.destinationOid! }
        });
        expect(destination.isDirty).toBe(true);
      } finally {
        before.stop();
        after.stop();
        audit.stop();
      }
    });

    it('creates nothing when a created:before listener refuses the marketplace', async () => {
      let name = uniqueId('refused-marketplace');
      let stop = Fabric.listen('skill.marketplace.created:before', () => {
        throw new ServiceError(forbiddenError({ message: 'Marketplace limit reached' }));
      });

      try {
        await expectServiceError(createMarketplace(fixture, { name }), 'forbidden');
      } finally {
        stop();
      }

      expect(await db.skillMarketplace.count({ where: { name } })).toBe(0);
    });

    it('validates the name and skill configuration on create', async () => {
      let foreignConfiguration = await createSkillConfiguration(otherFixture, {});

      await expectServiceError(createMarketplace(fixture, { name: '   ' }), 'bad_request');
      await expectServiceError(
        createMarketplace(fixture, { skillConfigurationId: 'sklcfg_does_not_exist' }),
        'not_found'
      );
      await expectServiceError(
        createMarketplace(fixture, { skillConfigurationId: foreignConfiguration.id }),
        'not_found'
      );
    });

    it('updates fields and reports the previous state to audit', async () => {
      let marketplace = await createMarketplace(fixture);
      let configuration = await createSkillConfiguration(fixture, { allowScripts: false });
      let audit = captureFabric('skill.marketplace.audit.updated:after');

      try {
        let updated = await skillMarketplaceService.updateSkillMarketplace({
          project: fixture.project,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          skillMarketplace: marketplace,
          input: {
            name: 'Renamed marketplace',
            description: null,
            skillConfigurationId: configuration.id
          }
        });

        expect(updated).toMatchObject({
          id: marketplace.id,
          name: 'Renamed marketplace',
          description: null,
          slug: marketplace.slug,
          skillConfiguration: { id: configuration.id }
        });

        let event = audit.events.find(event => event.skillMarketplace.id === marketplace.id);
        expect(event?.previousSkillMarketplace.name).toBe(marketplace.name);
        expect(event?.skillMarketplace.name).toBe('Renamed marketplace');

        let cleared = await skillMarketplaceService.updateSkillMarketplace({
          project: fixture.project,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          skillMarketplace: updated,
          input: { skillConfigurationId: null }
        });
        expect(cleared.skillConfiguration).toBeNull();
      } finally {
        audit.stop();
      }

      await expectServiceError(
        skillMarketplaceService.updateSkillMarketplace({
          project: fixture.project,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          skillMarketplace: marketplace,
          input: { name: '' }
        }),
        'bad_request'
      );
      await expectServiceError(
        skillMarketplaceService.updateSkillMarketplace({
          project: fixture.project,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          skillMarketplace: marketplace,
          input: { skillConfigurationId: 'sklcfg_does_not_exist' }
        }),
        'not_found'
      );
    });

    it('archives memberships and repository links and meters the archive once', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let repository =
        await skillMarketplaceRepositoryService.createSkillMarketplaceRepository({
          project: fixture.project,
          instance: fixture.instance,
          skillMarketplaceId: marketplace.id,
          repoId: origin.addRepository()
        });

      let archivedEvents = captureFabric('skill.marketplace.archived:after');
      let auditEvents = captureFabric('skill.marketplace.audit.archived:after');

      try {
        let archived = await archiveMarketplace(fixture, marketplace.id);
        expect(archived.status).toBe('archived');
        expect(archived.plugins).toEqual([]);

        await archiveMarketplace(fixture, marketplace.id);

        expect(
          archivedEvents.events.filter(event => event.skillMarketplace.id === marketplace.id)
        ).toHaveLength(1);
        expect(
          auditEvents.events.filter(event => event.skillMarketplace.id === marketplace.id)
        ).toHaveLength(2);
      } finally {
        archivedEvents.stop();
        auditEvents.stop();
      }

      let membership = await db.skillMarketplacePlugin.findFirstOrThrow({
        where: { skillMarketplaceOid: marketplace.oid, skillPluginOid: plugin.oid }
      });
      expect(membership.status).toBe('archived');
      expect(
        await db.skillMarketplaceRepository.count({ where: { oid: repository.oid } })
      ).toBe(0);
      expect(
        (await db.skillPlugin.findUniqueOrThrow({ where: { oid: plugin.oid } })).status
      ).toBe('active');

      expect(await listMarketplaces(fixture, { ids: [marketplace.id] })).toEqual([]);
      expect(
        (
          await listMarketplaces(fixture, { ids: [marketplace.id], statuses: ['archived'] })
        ).map(item => item.id)
      ).toEqual([marketplace.id]);
    });

    it('rejects new plugins, memberships and repositories on archived marketplaces', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture);
      await archiveMarketplace(fixture, marketplace.id);

      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: plugin.id
        }),
        'not_found'
      );
      await expectServiceError(
        createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id }),
        'not_found'
      );
      await expectServiceError(
        skillMarketplaceRepositoryService.createSkillMarketplaceRepository({
          project: fixture.project,
          instance: fixture.instance,
          skillMarketplaceId: marketplace.id,
          repoId: origin.addRepository()
        }),
        'not_found'
      );

      expect(
        await db.skillMarketplacePlugin.count({
          where: { skillMarketplaceOid: marketplace.oid }
        })
      ).toBe(0);
    });

    it('returns an editor url for the marketplace code bucket', async () => {
      let marketplace = await createMarketplace(fixture);

      let editor = await skillMarketplaceService.getSkillMarketplaceEditorUrl({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplace: marketplace,
        isReadOnly: true
      });

      expect(editor.url).toBe(
        `http://origin.e2e/editor/${marketplace.destination!.codeBucketId}?readOnly=true`
      );
      expect(editor.expiresAt).toBeInstanceOf(Date);
      expect(
        origin
          .callsTo('codeBucket:getEditorToken')
          .some(
            call =>
              call.payload.codeBucketId === marketplace.destination!.codeBucketId &&
              call.payload.tenantId === originTenantId(fixture)
          )
      ).toBe(true);
    });
  });

  describe('plugin memberships', () => {
    it('assigns unique slugs, keeps re-adds idempotent and refuses slug changes', async () => {
      let marketplace = await createMarketplace(fixture);
      let first = await createPlugin(fixture, { name: 'Writing Tools' });
      let second = await createPlugin(fixture, { name: 'Writing Tools' });

      let firstMembership = await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: first.id
      });
      let secondMembership = await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: second.id
      });
      expect(firstMembership.pluginSlug).toBe('writing-tools');
      expect(secondMembership.pluginSlug).toBe('writing-tools-2');

      let again = await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: first.id
      });
      expect(again.id).toBe(firstMembership.id);
      expect(again.pluginSlug).toBe('writing-tools');

      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: first.id,
          pluginSlug: 'renamed-tools'
        }),
        'bad_request'
      );

      let reloaded = await getMarketplace(fixture, marketplace.id);
      expect(reloaded.plugins.map(item => item.id)).toEqual([
        firstMembership.id,
        secondMembership.id
      ]);
    });

    it('frees the slug on removal and reactivates the same membership on re-add', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, { name: 'Research Kit' });
      let configuration = await createSkillConfiguration(fixture, {});

      let membership = await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: plugin.id,
        skillConfigurationId: configuration.id
      });
      expect(membership.skillConfiguration?.id).toBe(configuration.id);

      let removed = await removePluginFromMarketplace(fixture, membership.id);
      expect(removed.status).toBe('archived');
      expect(removed.pluginSlug).not.toBe('research-kit');
      expect(removed.skillConfigurationOid).toBeNull();

      let listMemberships = async (statuses?: ('active' | 'archived')[]) =>
        (
          await firstPage(
            await skillMarketplacePluginService.listSkillMarketplacePlugins({
              project: fixture.project,
              instance: fixture.instance,
              skillMarketplace: await getMarketplace(fixture, marketplace.id),
              statuses
            })
          )
        ).map(item => item.id);

      expect(await listMemberships()).toEqual([]);
      expect(await listMemberships(['archived'])).toEqual([membership.id]);

      let taker = await createPlugin(fixture);
      let takerMembership = await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: taker.id,
        pluginSlug: 'research-kit'
      });
      expect(takerMembership.pluginSlug).toBe('research-kit');

      let readded = await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: plugin.id
      });
      expect(readded.id).toBe(membership.id);
      expect(readded.status).toBe('active');
      expect(readded.pluginSlug).toBe('research-kit-2');
    });

    it('refuses archived, unknown and foreign plugins', async () => {
      let marketplace = await createMarketplace(fixture);
      let archived = await createPlugin(fixture);
      await archivePlugin(fixture, archived.id);
      let foreign = await createPlugin(otherFixture);

      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: archived.id
        }),
        'not_found'
      );
      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: 'skplg_does_not_exist'
        }),
        'not_found'
      );
      await expectServiceError(
        addPluginToMarketplace(fixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: foreign.id
        }),
        'not_found'
      );

      expect(
        await db.skillMarketplacePlugin.count({
          where: { skillMarketplaceOid: marketplace.oid }
        })
      ).toBe(0);
    });

    it('dirties the marketplace destination when its catalog changes', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture);
      await db.skillDestination.update({
        where: { oid: marketplace.destinationOid! },
        data: { isDirty: false, lastTransientChangeAt: null }
      });

      await addPluginToMarketplace(fixture, {
        skillMarketplaceId: marketplace.id,
        skillPluginId: plugin.id
      });

      await eventually(async () => {
        let destination = await db.skillDestination.findUniqueOrThrow({
          where: { oid: marketplace.destinationOid! }
        });
        expect(destination.lastTransientChangeAt).not.toBeNull();
      });
    });
  });

  describe('search', () => {
    it('indexes marketplaces with their plugin names and drops archived ones', async () => {
      let marketplaceToken = searchToken();
      let pluginToken = searchToken();
      let marketplace = await createMarketplace(fixture, {
        name: `Catalog ${marketplaceToken}`
      });
      await createPlugin(
        fixture,
        { name: `Plugin ${pluginToken}` },
        { skillMarketplaceId: marketplace.id }
      );

      await eventually(
        async () => {
          expect(
            (await listMarketplaces(fixture, { search: pluginToken })).map(item => item.id)
          ).toEqual([marketplace.id]);
        },
        { timeoutMs: 45_000, intervalMs: 500 }
      );
      expect(await listMarketplaces(otherFixture, { search: marketplaceToken })).toEqual([]);

      await archiveMarketplace(fixture, marketplace.id);

      await eventually(
        async () => {
          expect(
            await listMarketplaces(fixture, {
              search: marketplaceToken,
              statuses: ['archived']
            })
          ).toEqual([]);
        },
        { timeoutMs: 45_000, intervalMs: 500 }
      );
    });
  });

  describe('forced syncs', () => {
    it('claims the sync in the worker, summarises the catalog and supersedes older syncs', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(
        fixture,
        { name: uniqueId('Alpha') },
        { skillMarketplaceId: marketplace.id }
      );
      let skill = await createSkill(fixture);
      await addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: skill.id });

      let forced = await skillMarketplaceService.forceSkillMarketplaceSync({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplace: await getMarketplace(fixture, marketplace.id)
      });
      expect(forced.forceSyncCounter).toBe(marketplace.forceSyncCounter + 1);

      let firstSync = await db.skillDestinationSync.findFirstOrThrow({
        where: { destinationOid: marketplace.destinationOid! },
        orderBy: { oid: 'desc' }
      });

      await eventually(
        async () => {
          let sync = await db.skillDestinationSync.findUniqueOrThrow({
            where: { oid: firstSync.oid }
          });
          expect(sync.startedAt).not.toBeNull();
          expect(sync.prName).toBe(`Update marketplace ${marketplace.name}`);
          expect(sync.prDescription).toContain(`- Add marketplace ${marketplace.name}`);
          expect(sync.prDescription).toContain(`- Add plugin ${plugin.name}`);
          expect(sync.prDescription).toContain(
            `- Add skill ${skill.name} in plugin ${plugin.name}`
          );
        },
        { timeoutMs: 45_000, intervalMs: 500 }
      );

      let destination = await db.skillDestination.findUniqueOrThrow({
        where: { oid: marketplace.destinationOid! }
      });
      expect(destination.tag).toBeGreaterThanOrEqual(1);

      await skillMarketplaceService.forceSkillMarketplaceSync({
        project: fixture.project,
        instance: fixture.instance,
        skillMarketplace: await getMarketplace(fixture, marketplace.id)
      });
      let secondSync = await db.skillDestinationSync.findFirstOrThrow({
        where: { destinationOid: marketplace.destinationOid! },
        orderBy: { oid: 'desc' }
      });
      expect(secondSync.oid).not.toBe(firstSync.oid);

      await eventually(
        async () => {
          let sync = await db.skillDestinationSync.findUniqueOrThrow({
            where: { oid: firstSync.oid }
          });
          expect(sync.status).toBe('canceled');
        },
        { timeoutMs: 45_000, intervalMs: 500 }
      );

      let listSyncs = async (
        target: OrganizationFixture,
        statuses?: ('pending' | 'processing' | 'canceled')[]
      ) =>
        (
          await firstPage(
            await skillSyncService.listSkillSyncs({
              project: target.project,
              instance: target.instance,
              skillMarketplaceIds: [marketplace.id],
              statuses
            })
          )
        ).map(item => item.id);

      expect(await listSyncs(fixture)).toContain(secondSync.id);
      expect(await listSyncs(fixture)).not.toContain(firstSync.id);
      expect(await listSyncs(fixture, ['canceled'])).toEqual([firstSync.id]);

      let fetched = await skillSyncService.getSkillSyncById({
        project: fixture.project,
        instance: fixture.instance,
        skillSyncId: secondSync.id
      });
      expect(fetched.id).toBe(secondSync.id);

      await expectServiceError(
        skillSyncService.getSkillSyncById({
          project: otherFixture.project,
          instance: otherFixture.instance,
          skillSyncId: secondSync.id
        }),
        'not_found'
      );
      expect(await listSyncs(otherFixture)).toEqual([]);
    });
  });

  describe('tenant isolation', () => {
    it('hides marketplaces and memberships from other organizations', async () => {
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let membership = (await getMarketplace(fixture, marketplace.id)).plugins[0]!;
      expect(membership.skillPlugin.id).toBe(plugin.id);

      await expectServiceError(getMarketplace(otherFixture, marketplace.id), 'not_found');
      expect(await listMarketplaces(otherFixture, { ids: [marketplace.id] })).toEqual([]);
      await expectServiceError(
        skillMarketplacePluginService.getSkillMarketplacePluginById({
          project: otherFixture.project,
          instance: otherFixture.instance,
          skillMarketplacePluginId: membership.id
        }),
        'not_found'
      );
      await expectServiceError(
        addPluginToMarketplace(otherFixture, {
          skillMarketplaceId: marketplace.id,
          skillPluginId: plugin.id
        }),
        'not_found'
      );
      await expectServiceError(
        createPlugin(otherFixture, {}, { skillMarketplaceId: marketplace.id }),
        'not_found'
      );
    });
  });
});
