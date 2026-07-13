import {
  flushDocumentDraft,
  internalDocumentCollaborationService
} from '@metorial-cargo/module-doc';
import {
  processSkillForkSyncJob,
  processSkillMergeRequestPerformJob,
  recoverStaleSkillMergeRequests,
  skillMarketplacePluginService,
  skillMarketplaceService,
  skillMergeRequestPerformQueue,
  skillPluginService,
  skillPluginSkillService
} from '@metorial-cargo/module-skill';
import { storeVersionService } from '@metorial-cargo/module-store';
import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { applyMarketplace } from '../../../../modules/skill/src/serializers/marketplace';
import { applyPlugin } from '../../../../modules/skill/src/serializers/plugin';
import { skillMergeRequestApplyInternalService } from '../../../../modules/skill/src/services/skillMergeRequestApplyInternal';
import { db, getId, snowflake } from '../../db';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let createTestYjsUpdate = (content: string) => {
  let document = new Y.Doc();
  document.getText('test').insert(0, content);
  let update = Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64');
  document.destroy();
  return update;
};

let subtractHours = (date: Date, hours: number) =>
  new Date(date.getTime() - hours * 60 * 60 * 1000);

let createScope = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-skills',
    name: 'Tenant Skills'
  });

  let environment = await cargoClient.environment.upsert({
    tenantId: tenant.id,
    identifier: 'prod',
    name: 'Production',
    type: 'production'
  });

  return {
    tenant,
    environment
  };
};

let createActor = async (
  tenantId: string,
  d: {
    identifier: string;
    name: string;
  }
) =>
  await cargoClient.actor.upsert({
    tenantId,
    identifier: d.identifier,
    name: d.name
  });

let getCargoScopeRecords = async (d: { tenantId: string; environmentId: string }) => ({
  tenant: await db.tenant.findUniqueOrThrow({
    where: {
      id: d.tenantId
    }
  }),
  environment: await db.environment.findUniqueOrThrow({
    where: {
      id: d.environmentId
    }
  })
});

let createTestSkillDestination = async (codeBucketId: string) =>
  await db.skillDestination.create({
    data: {
      ...getId('skillDestination'),
      codeBucketId
    }
  });

let createTestSkillPlugin = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  name: string;
  slug: string;
}) => {
  let destination = await createTestSkillDestination(`plugin-${d.slug}`);

  return await db.skillPlugin.create({
    data: {
      ...getId('skillPlugin'),
      status: 'active',
      isManaged: false,
      name: d.name,
      slug: d.slug,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      destinationOid: destination.oid
    }
  });
};

let createTestSkillMarketplace = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  name: string;
  slug: string;
}) => {
  let destination = await createTestSkillDestination(`marketplace-${d.slug}`);

  return await db.skillMarketplace.create({
    data: {
      ...getId('skillMarketplace'),
      status: 'active',
      name: d.name,
      slug: d.slug,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      destinationOid: destination.oid
    }
  });
};

let createTestSkillPluginSkill = async (d: {
  skillOid: bigint;
  skillPluginOid: bigint;
  pluginSkillSlug: string;
}) =>
  await db.skillPluginSkill.create({
    data: {
      ...getId('skillPluginSkill'),
      status: 'active',
      pluginSkillSlug: d.pluginSkillSlug,
      clientName: 'Plugin Skill',
      skillOid: d.skillOid,
      skillPluginOid: d.skillPluginOid
    }
  });

let createTestSkillMarketplacePlugin = async (d: {
  skillMarketplaceOid: bigint;
  skillPluginOid: bigint;
  pluginSlug: string;
}) =>
  await db.skillMarketplacePlugin.create({
    data: {
      ...getId('skillMarketplacePlugin'),
      status: 'active',
      pluginSlug: d.pluginSlug,
      skillMarketplaceOid: d.skillMarketplaceOid,
      skillPluginOid: d.skillPluginOid
    }
  });

let createTestSkillSync = async (d: {
  destinationOid: bigint;
  status: 'pending' | 'completed' | 'failed' | 'processing' | 'canceled';
  logMessage: string;
}) =>
  await db.skillDestinationSync.create({
    data: {
      ...getId('skillDestinationSync'),
      status: d.status,
      destinationOid: d.destinationOid,
      logs: [[Date.now(), d.logMessage]]
    }
  });

let createManyTestSkills = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  count: number;
  prefix: string;
}) => {
  let stores = Array.from({ length: d.count }, (_, idx) => ({
    ...getId('store'),
    name: `${d.prefix} Store ${idx}`,
    access: 'private',
    cloneType: null,
    itemCount: 0,
    tenantOid: d.tenantOid,
    environmentOid: d.environmentOid,
    lastEditedAt: new Date()
  }));
  let skills = stores.map((store, idx) => ({
    oid: snowflake.nextId(),
    id: `${d.prefix}-skill-${idx}`,
    status: 'active',
    name: `${d.prefix} Skill ${idx}`,
    slug: `${d.prefix}-skill-${idx}`,
    clientName: `${d.prefix} Skill ${idx}`,
    tenantOid: d.tenantOid,
    environmentOid: d.environmentOid,
    storeOid: store.oid
  }));

  await db.store.createMany({ data: stores as any });
  await db.skill.createMany({ data: skills as any });

  return await db.skill.findMany({
    where: { id: { in: skills.map(skill => skill.id) } },
    orderBy: { id: 'asc' }
  });
};

let createManyTestPlugins = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  count: number;
  prefix: string;
}) => {
  let destinations = Array.from({ length: d.count }, (_, idx) => ({
    ...getId('skillDestination'),
    codeBucketId: `${d.prefix}-plugin-bucket-${idx}`
  }));
  let plugins = destinations.map((destination, idx) => ({
    ...getId('skillPlugin'),
    status: 'active',
    isManaged: false,
    name: `${d.prefix} Plugin ${idx}`,
    slug: `${d.prefix}-plugin-${idx}`,
    tenantOid: d.tenantOid,
    environmentOid: d.environmentOid,
    destinationOid: destination.oid
  }));

  await db.skillDestination.createMany({ data: destinations });
  await db.skillPlugin.createMany({ data: plugins as any });

  return await db.skillPlugin.findMany({
    where: { id: { in: plugins.map(plugin => plugin.id) } },
    orderBy: { id: 'asc' }
  });
};

describe('cargo skill.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('uses a safe custom error for merge verification failures', async () => {
    let verificationError = await skillMergeRequestApplyInternalService
      .verifyResolvedItems({
        items: [],
        before: {
          itemsByPath: new Map([
            [
              '/private/skill.md',
              { kind: 'document', path: '/private/skill.md', content: 'before' }
            ]
          ])
        } as any,
        target: {
          itemsByPath: new Map([
            [
              '/private/skill.md',
              { kind: 'document', path: '/private/skill.md', content: 'after' }
            ]
          ])
        } as any
      })
      .then(
        () => null,
        error => error
      );

    expect(verificationError).toMatchObject({
      name: 'SkillMergeRequestMergeError',
      code: 'verification_failed',
      message: 'The proposed result could not be verified. Review the request and try again.'
    });
    expect(verificationError.message).not.toContain('/private/skill.md');
  });

  it('lists and gets skill syncs by plugin and marketplace', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let otherEnvironment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'staging',
      name: 'Staging',
      type: 'development'
    });
    let otherScope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: otherEnvironment.id
    });
    let skillPlugin = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Sync Plugin',
      slug: 'sync-plugin'
    });
    let skillMarketplace = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Sync Marketplace',
      slug: 'sync-marketplace'
    });
    let otherSkillPlugin = await createTestSkillPlugin({
      tenantOid: otherScope.tenant.oid,
      environmentOid: otherScope.environment.oid,
      name: 'Other Sync Plugin',
      slug: 'other-sync-plugin'
    });
    let pluginSync = await createTestSkillSync({
      destinationOid: skillPlugin.destinationOid,
      status: 'processing',
      logMessage: 'Plugin sync started'
    });
    let marketplaceSync = await createTestSkillSync({
      destinationOid: skillMarketplace.destinationOid,
      status: 'completed',
      logMessage: 'Marketplace sync completed'
    });
    let otherSync = await createTestSkillSync({
      destinationOid: otherSkillPlugin.destinationOid,
      status: 'processing',
      logMessage: 'Other sync started'
    });

    let listedForPlugin = await cargoClient.skillSync.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillPluginIds: [skillPlugin.id],
      limit: 10
    });
    let listedForMarketplace = await cargoClient.skillSync.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMarketplaceIds: [skillMarketplace.id],
      limit: 10
    });
    let listedForEnvironment = await cargoClient.skillSync.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let fetched = await cargoClient.skillSync.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillSyncId: pluginSync.id
    });

    expect(listedForPlugin.items.map(item => item.id)).toEqual([pluginSync.id]);
    expect(listedForPlugin.items[0]).toMatchObject({
      object: 'cargo#skillSync',
      id: pluginSync.id,
      status: 'processing',
      skillPluginId: skillPlugin.id
    });
    expect(listedForMarketplace.items.map(item => item.id)).toEqual([marketplaceSync.id]);
    expect(listedForMarketplace.items[0]).toMatchObject({
      object: 'cargo#skillSync',
      id: marketplaceSync.id,
      status: 'completed',
      skillMarketplaceId: skillMarketplace.id
    });
    expect(listedForEnvironment.items.map(item => item.id)).not.toContain(otherSync.id);
    expect(fetched).toMatchObject({
      id: pluginSync.id,
      logs: [[expect.any(Number), 'Plugin sync started']]
    });
    await expect(
      cargoClient.skillSync.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillSyncId: otherSync.id
      })
    ).rejects.toThrow();
  });

  it('filters skill exports by creator actor', async () => {
    let { tenant, environment } = await createScope();
    let firstActor = await createActor(tenant.id, {
      identifier: 'skill-export-first',
      name: 'Skill Export First'
    });
    let secondActor = await createActor(tenant.id, {
      identifier: 'skill-export-second',
      name: 'Skill Export Second'
    });
    let { tenant: tenantRecord, environment: environmentRecord } = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let firstActorRecord = await db.tenantActor.findUniqueOrThrow({
      where: {
        id: firstActor.id
      }
    });
    let secondActorRecord = await db.tenantActor.findUniqueOrThrow({
      where: {
        id: secondActor.id
      }
    });

    let firstExportRef = await db.skillExportRef.create({
      data: {
        oid: getId('skillExport').oid,
        hash: 'test-export-first',
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let secondExportRef = await db.skillExportRef.create({
      data: {
        oid: getId('skillExport').oid,
        hash: 'test-export-second',
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let firstExportIds = getId('skillExport');
    let secondExportIds = getId('skillExport');

    let firstExport = await db.skillExport.create({
      data: {
        ...firstExportIds,
        target: 'plugin',
        status: 'completed',
        exportRefOid: firstExportRef.oid,
        creatorTenantActorOid: firstActorRecord.oid,
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let secondExport = await db.skillExport.create({
      data: {
        ...secondExportIds,
        target: 'plugin',
        status: 'completed',
        exportRefOid: secondExportRef.oid,
        creatorTenantActorOid: secondActorRecord.oid,
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });

    let listedForFirstActor = await cargoClient.skillExport.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: firstActor.id,
      limit: 10
    });

    expect(listedForFirstActor.items.map(item => item.id)).toEqual([firstExport.id]);
    expect(
      await cargoClient.skillExport.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        actorId: firstActor.id,
        skillExportId: firstExport.id
      })
    ).toMatchObject({
      id: firstExport.id,
      createdBy: {
        id: firstActor.id
      }
    });
    await expect(
      cargoClient.skillExport.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        actorId: firstActor.id,
        skillExportId: secondExport.id
      })
    ).rejects.toThrow();
  });

  it('creates, lists, gets, and updates skills with linked stores', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'skill-creator',
      name: 'Skill Creator'
    });
    let reader = await createActor(tenant.id, {
      identifier: 'skill-reader',
      name: 'Skill Reader'
    });

    let created = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_support',
      actorId: actor.id,
      name: 'Support'
    });

    let listed = await cargoClient.skill.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let fetched = await cargoClient.skill.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id
    });

    let linkedStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeId
    });
    let createdSkillRecord = await db.skill.findUnique({
      where: {
        id: created.id
      }
    });
    let linkedStoreRecord = await db.store.findUnique({
      where: {
        id: created.storeId
      }
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: created.storeId
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      storeId: expect.any(String),
      store: {
        id: expect.any(String),
        name: 'Support',
        itemCount: 1
      }
    });
    expect(linkedStore).toMatchObject({
      id: created.storeId,
      name: 'Support'
    });
    expect(createdSkillRecord?.createdByTenantActorOid).toBeTruthy();
    expect(linkedStoreRecord?.createdByTenantActorOid).toBeTruthy();
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);
    expect(listed.items).toHaveLength(1);
    expect(fetched.id).toBe(created.id);
    expect(fetched.store.id).toBe(created.storeId);

    let readerAccess = await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id,
      actorId: reader.id,
      permissions: ['content_read']
    });
    let upgradedReaderAccess = await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id,
      actorId: reader.id,
      permissions: ['content_read', 'content_write']
    });

    expect(readerAccess).toMatchObject({
      skillId: created.id,
      storeId: created.storeId,
      actorId: reader.id,
      permissions: ['content_read']
    });
    expect(upgradedReaderAccess).toMatchObject({
      skillId: created.id,
      storeId: created.storeId,
      actorId: reader.id,
      permissions: ['content_read', 'content_write']
    });

    let updated = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id,
      name: 'Customer Support'
    });

    let updatedStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeId
    });

    expect(updated).toMatchObject({
      id: created.id,
      storeId: created.storeId,
      store: {
        id: created.storeId,
        name: 'Customer Support'
      }
    });
    expect(updatedStore.name).toBe('Customer Support');

    await expect(
      cargoClient.store.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: created.storeId
      })
    ).rejects.toThrow('Cannot delete store: it is linked to a skill');
  });

  it('rejects adding more than 100 active skills to a plugin', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skillPluginRecord = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Limited Plugin',
      slug: 'limited-plugin'
    });
    let skillPlugin = await skillPluginService.getSkillPluginById({
      tenant: scope.tenant,
      environment: scope.environment,
      skillPluginId: skillPluginRecord.id
    });
    let skills = await createManyTestSkills({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      count: 101,
      prefix: 'plugin-limit'
    });

    await db.skillPluginSkill.createMany({
      data: skills.slice(0, 100).map((skill, idx) => ({
        ...getId('skillPluginSkill'),
        status: 'active',
        pluginSkillSlug: `plugin-limit-${idx}`,
        skillOid: skill.oid,
        skillPluginOid: skillPlugin.oid
      }))
    });

    await expect(
      skillPluginSkillService.addSkillPluginSkill({
        tenant: scope.tenant,
        environment: scope.environment,
        skillPlugin,
        input: {
          skillId: skills[100]!.id
        }
      })
    ).rejects.toThrow('Plugin skills cannot exceed 100');
  });

  it('rejects adding more than 500 active plugins to a marketplace', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skillMarketplaceRecord = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Limited Marketplace',
      slug: 'limited-marketplace'
    });
    let skillMarketplace = await skillMarketplaceService.getSkillMarketplaceById({
      tenant: scope.tenant,
      environment: scope.environment,
      skillMarketplaceId: skillMarketplaceRecord.id
    });
    let plugins = await createManyTestPlugins({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      count: 501,
      prefix: 'marketplace-plugin-limit'
    });

    await db.skillMarketplacePlugin.createMany({
      data: plugins.slice(0, 500).map((plugin, idx) => ({
        ...getId('skillMarketplacePlugin'),
        status: 'active',
        pluginSlug: `marketplace-plugin-limit-${idx}`,
        skillMarketplaceOid: skillMarketplace.oid,
        skillPluginOid: plugin.oid
      }))
    });

    await expect(
      skillMarketplacePluginService.addSkillMarketplacePlugin({
        tenant: scope.tenant,
        environment: scope.environment,
        skillMarketplace,
        input: {
          skillPluginId: plugins[500]!.id
        }
      })
    ).rejects.toThrow('Marketplace plugins cannot exceed 500');
  });

  it('rejects adding marketplace plugins that would exceed 1000 active skills', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skillMarketplaceRecord = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Skill Limited Marketplace',
      slug: 'skill-limited-marketplace'
    });
    let skillMarketplace = await skillMarketplaceService.getSkillMarketplaceById({
      tenant: scope.tenant,
      environment: scope.environment,
      skillMarketplaceId: skillMarketplaceRecord.id
    });
    let skillPluginRecord = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Oversized Marketplace Plugin',
      slug: 'oversized-marketplace-plugin'
    });
    let skillPlugin = await skillPluginService.getSkillPluginById({
      tenant: scope.tenant,
      environment: scope.environment,
      skillPluginId: skillPluginRecord.id
    });
    let skills = await createManyTestSkills({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      count: 1001,
      prefix: 'marketplace-skill-limit'
    });

    await db.skillPluginSkill.createMany({
      data: skills.map((skill, idx) => ({
        ...getId('skillPluginSkill'),
        status: 'active',
        pluginSkillSlug: `marketplace-skill-limit-${idx}`,
        skillOid: skill.oid,
        skillPluginOid: skillPlugin.oid
      }))
    });

    await expect(
      skillMarketplacePluginService.addSkillMarketplacePlugin({
        tenant: scope.tenant,
        environment: scope.environment,
        skillMarketplace,
        input: {
          skillPluginId: skillPlugin.id
        }
      })
    ).rejects.toThrow('Marketplace skills cannot exceed 1000');
  });

  it('rejects creating the 1001st exportable file in a skill store', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_store_file_limit',
      name: 'Store File Limited Skill'
    });
    let store = await db.store.findUniqueOrThrow({
      where: { id: skill.storeId }
    });
    let currentExportableCount = await db.storeItem.count({
      where: {
        storeOid: store.oid,
        kind: { in: ['document', 'file'] }
      }
    });

    await db.storeItem.createMany({
      data: Array.from({ length: 1000 - currentExportableCount }, (_, idx) => ({
        ...getId('storeItem'),
        kind: 'file',
        path: `/limit-${idx}.txt`,
        storeOid: store.oid
      }))
    });

    await expect(
      cargoClient.document.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        title: 'Too Many Files',
        content: 'limit',
        store: {
          id: skill.storeId,
          path: '/too-many.md'
        }
      })
    ).rejects.toThrow('Skill store files cannot exceed 1000');
  });

  it('rejects oversized plugin and marketplace data during serializer initialization', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skillMarketplaceRecord = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Serializer Limited Marketplace',
      slug: 'serializer-limited-marketplace'
    });
    let skillMarketplace = await skillMarketplaceService.getSkillMarketplaceById({
      tenant: scope.tenant,
      environment: scope.environment,
      skillMarketplaceId: skillMarketplaceRecord.id
    });
    let skillPluginRecord = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Serializer Limited Plugin',
      slug: 'serializer-limited-plugin'
    });
    let skillPlugin = await skillPluginService.getSkillPluginById({
      tenant: scope.tenant,
      environment: scope.environment,
      skillPluginId: skillPluginRecord.id
    });
    let skills = await createManyTestSkills({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      count: 101,
      prefix: 'serializer-plugin-limit'
    });

    await db.skillPluginSkill.createMany({
      data: skills.map((skill, idx) => ({
        ...getId('skillPluginSkill'),
        status: 'active',
        pluginSkillSlug: `serializer-plugin-limit-${idx}`,
        skillOid: skill.oid,
        skillPluginOid: skillPlugin.oid
      }))
    });
    await db.skillMarketplacePlugin.create({
      data: {
        ...getId('skillMarketplacePlugin'),
        status: 'active',
        pluginSlug: 'serializer-plugin-limit',
        skillMarketplaceOid: skillMarketplace.oid,
        skillPluginOid: skillPlugin.oid
      }
    });

    await expect(
      applyPlugin.init({
        skillPlugin: {
          ...skillPlugin,
          skills: [],
          skillConfiguration: null
        }
      } as any)
    ).rejects.toThrow('Plugin skills cannot exceed 100');

    let pluginLimitedMarketplaceRecord = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Serializer Plugin Limited Marketplace',
      slug: 'serializer-plugin-limited-marketplace'
    });
    let pluginLimitedMarketplace = await skillMarketplaceService.getSkillMarketplaceById({
      tenant: scope.tenant,
      environment: scope.environment,
      skillMarketplaceId: pluginLimitedMarketplaceRecord.id
    });
    let plugins = await createManyTestPlugins({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      count: 501,
      prefix: 'serializer-marketplace-plugin-limit'
    });

    await db.skillMarketplacePlugin.createMany({
      data: plugins.map((plugin, idx) => ({
        ...getId('skillMarketplacePlugin'),
        status: 'active',
        pluginSlug: `serializer-marketplace-plugin-limit-${idx}`,
        skillMarketplaceOid: pluginLimitedMarketplace.oid,
        skillPluginOid: plugin.oid
      }))
    });

    await expect(
      applyMarketplace.init({ skillMarketplace: pluginLimitedMarketplace } as any)
    ).rejects.toThrow('Marketplace plugins cannot exceed 500');
  });

  it('archives plugin links when archiving a plugin', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_delete_plugin',
      name: 'Delete Plugin Skill'
    });
    let skillRecord = await db.skill.findUniqueOrThrow({
      where: {
        id: skill.id
      }
    });
    let skillPlugin = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Plugin To Delete',
      slug: 'plugin-to-delete'
    });
    let skillMarketplace = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Plugin Delete Marketplace',
      slug: 'plugin-delete-marketplace'
    });
    let skillPluginSkill = await createTestSkillPluginSkill({
      skillOid: skillRecord.oid,
      skillPluginOid: skillPlugin.oid,
      pluginSkillSlug: 'plugin-delete-skill'
    });
    let skillMarketplacePlugin = await createTestSkillMarketplacePlugin({
      skillMarketplaceOid: skillMarketplace.oid,
      skillPluginOid: skillPlugin.oid,
      pluginSlug: 'plugin-delete'
    });

    await skillPluginService.archiveSkillPlugin({
      tenant: scope.tenant,
      environment: scope.environment,
      skillPlugin: await skillPluginService.getSkillPluginById({
        tenant: scope.tenant,
        environment: scope.environment,
        skillPluginId: skillPlugin.id
      })
    });

    let deletedSkillPlugin = await db.skillPlugin.findUniqueOrThrow({
      where: {
        id: skillPlugin.id
      }
    });
    let deletedSkillPluginSkill = await db.skillPluginSkill.findUniqueOrThrow({
      where: {
        id: skillPluginSkill.id
      }
    });
    let deletedSkillMarketplacePlugin = await db.skillMarketplacePlugin.findUniqueOrThrow({
      where: {
        id: skillMarketplacePlugin.id
      }
    });

    expect(deletedSkillPlugin.status).toBe('archived');
    expect(deletedSkillPluginSkill.status).toBe('archived');
    expect(deletedSkillMarketplacePlugin.status).toBe('archived');
  });

  it('archives marketplace plugins when archiving a marketplace', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skillPlugin = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Marketplace Plugin',
      slug: 'marketplace-plugin'
    });
    let skillMarketplace = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Marketplace To Delete',
      slug: 'marketplace-to-delete'
    });
    let skillMarketplacePlugin = await createTestSkillMarketplacePlugin({
      skillMarketplaceOid: skillMarketplace.oid,
      skillPluginOid: skillPlugin.oid,
      pluginSlug: 'marketplace-plugin'
    });

    await skillMarketplaceService.archiveSkillMarketplace({
      tenant: scope.tenant,
      environment: scope.environment,
      skillMarketplace: await skillMarketplaceService.getSkillMarketplaceById({
        tenant: scope.tenant,
        environment: scope.environment,
        skillMarketplaceId: skillMarketplace.id
      })
    });

    let deletedSkillMarketplace = await db.skillMarketplace.findUniqueOrThrow({
      where: {
        id: skillMarketplace.id
      }
    });
    let deletedSkillMarketplacePlugin = await db.skillMarketplacePlugin.findUniqueOrThrow({
      where: {
        id: skillMarketplacePlugin.id
      }
    });

    expect(deletedSkillMarketplace.status).toBe('archived');
    expect(deletedSkillMarketplacePlugin.status).toBe('archived');
  });

  it('sets, replaces, and clears skill images with file references', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'skill_image',
      name: 'Skill Image',
      ownerType: 'instance',
      canHaveLinks: true
    });

    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_image',
      name: 'Image Skill'
    });
    let firstFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'store-skill-image-1',
      name: 'skill-one.png',
      mimeType: 'image/png',
      size: 128,
      title: 'Skill image one'
    });
    let secondFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'store-skill-image-2',
      name: 'skill-two.png',
      mimeType: 'image/png',
      size: 256,
      title: 'Skill image two'
    });

    let withFirstImage = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      imageFileId: firstFile.id
    });
    let firstImage = withFirstImage.image as any;
    expect(firstImage).toMatchObject({
      type: 'file',
      fileId: firstFile.id,
      fileLinkId: expect.any(String),
      fileReferenceId: expect.any(String)
    });

    let withSecondImage = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      imageFileId: secondFile.id
    });
    let secondImage = withSecondImage.image as any;
    expect(secondImage).toMatchObject({
      type: 'file',
      fileId: secondFile.id,
      fileLinkId: expect.any(String),
      fileReferenceId: expect.any(String)
    });
    expect(secondImage.fileReferenceId).not.toBe(firstImage.fileReferenceId);

    let oldReference = await db.fileReference.findUnique({
      where: {
        id: firstImage.fileReferenceId
      }
    });
    let oldLink = await db.fileLink.findUnique({
      where: {
        id: firstImage.fileLinkId
      }
    });
    expect(oldReference).toBeNull();
    expect(oldLink).toBeNull();

    let referencesAfterReplace = await db.fileReference.findMany({
      where: {
        entityType: 'skill',
        entityId: skill.id
      }
    });
    expect(referencesAfterReplace).toHaveLength(1);
    expect(referencesAfterReplace[0]!.id).toBe(secondImage.fileReferenceId);

    let cleared = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      imageFileId: null
    });

    expect(cleared.image).toEqual({ type: 'default' });
    expect(
      await db.fileReference.findUnique({
        where: {
          id: secondImage.fileReferenceId
        }
      })
    ).toBeNull();
    expect(
      await db.fileLink.findUnique({
        where: {
          id: secondImage.fileLinkId
        }
      })
    ).toBeNull();
  });

  it('manages skill agents from markdown documents in skill stores', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_agents',
      name: 'Agent Skill'
    });

    let createdAgent = await cargoClient.skillAgent.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      name: 'Research Assistant',
      description: 'Find useful information',
      content: 'agent instructions'
    });

    expect(createdAgent).toMatchObject({
      skillId: skill.id,
      name: 'Research Assistant',
      description: 'Find useful information',
      slug: 'research-assistant',
      status: 'active',
      path: '/agents/research-assistant.md',
      documentId: expect.any(String),
      storeItemId: expect.any(String)
    });

    let updatedAgent = await cargoClient.skillAgent.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillAgentId: createdAgent.id,
      name: 'Research Lead',
      description: null
    });

    expect(updatedAgent).toMatchObject({
      id: createdAgent.id,
      name: 'Research Lead',
      description: null,
      slug: 'research-assistant',
      path: '/agents/research-assistant.md'
    });

    await expect(
      cargoClient.document.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        documentId: createdAgent.documentId
      })
    ).rejects.toThrow('Cannot delete document: it is linked to an active skill agent');

    let createdDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdAgent.documentId
    });

    await expect(
      cargoClient.file.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileId: createdDocument.fileId
      })
    ).rejects.toThrow('Cannot delete file: it is linked to an active skill agent');

    let manualDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Manual Agent',
      content: 'manual instructions',
      store: {
        id: skill.storeId,
        path: '/agents/manual.md'
      }
    });

    let listedAfterManual = await cargoClient.skillAgent.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      limit: 10
    });
    let manualAgent = listedAfterManual.items.find(
      item => item.documentId === manualDocument.id
    )!;

    expect(manualAgent).toMatchObject({
      name: 'Manual Agent',
      slug: 'manual',
      path: '/agents/manual.md',
      status: 'active'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: skill.storeId,
      operations: [
        {
          type: 'modify',
          itemId: manualAgent.storeItemId,
          path: '/agents/manual-renamed.md'
        }
      ]
    });

    let renamedAgent = await cargoClient.skillAgent.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillAgentId: manualAgent.id
    });

    expect(renamedAgent).toMatchObject({
      name: 'manual-renamed',
      slug: 'manual-renamed',
      path: '/agents/manual-renamed.md',
      status: 'active'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: skill.storeId,
      operations: [
        {
          type: 'modify',
          itemId: renamedAgent.storeItemId,
          path: '/docs/manual-renamed.md'
        }
      ]
    });

    let archivedAfterMove = await cargoClient.skillAgent.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      includeArchived: true,
      limit: 10
    });
    let movedAgent = archivedAfterMove.items.find(item => item.id === manualAgent.id)!;

    expect(movedAgent).toMatchObject({
      status: 'archived',
      storeItemId: undefined,
      archivedAt: expect.any(Date)
    });

    let deletedAgent = await cargoClient.skillAgent.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillAgentId: createdAgent.id
    });
    let removedStoreItem = await db.storeItem.findFirst({
      where: {
        id: createdAgent.storeItemId
      }
    });
    let deletedDocument = await cargoClient.document.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdAgent.documentId
    });

    expect(deletedAgent.status).toBe('archived');
    expect(deletedAgent.storeItemId).toBeUndefined();
    expect(removedStoreItem).toBeNull();
    expect(deletedDocument.status).toBe('deleted');

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'skill_agent_restricted_file',
      name: 'Skill Agent Restricted File',
      ownerType: 'organization',
      canHaveLinks: true
    });

    await expect(
      cargoClient.file.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        purpose: purpose.id,
        storeId: 'skill-agent-restricted-file',
        name: 'bad.md',
        mimeType: 'text/markdown',
        size: 10,
        store: {
          id: skill.storeId,
          path: '/agents/bad.md'
        }
      })
    ).rejects.toThrow('Only markdown documents can be added to the agents directory');

    await expect(
      cargoClient.document.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        title: 'Bad Agent',
        content: 'bad',
        store: {
          id: skill.storeId,
          path: '/agents/bad.txt'
        }
      })
    ).rejects.toThrow('Only markdown documents can be added to the agents directory');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'add',
            path: '/agents/folder/'
          }
        ]
      })
    ).rejects.toThrow('Only markdown documents can be added to the agents directory');

    let skillDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Skill Root',
      content: 'root instructions',
      store: {
        id: skill.storeId,
        path: '/SKILL.md'
      }
    });
    let skillDocumentItem = (
      await cargoClient.storeItem.list({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        documentIds: [skillDocument.id],
        limit: 10
      })
    ).items[0]!;

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'remove',
            itemId: skillDocumentItem.id
          }
        ]
      })
    ).rejects.toThrow('SKILL.md cannot be removed from a skill store');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'modify',
            itemId: skillDocumentItem.id,
            path: '/docs/SKILL.md'
          }
        ]
      })
    ).rejects.toThrow('SKILL.md cannot be moved in a skill store');

    await expect(
      cargoClient.file.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        purpose: purpose.id,
        storeId: 'skill-root-file',
        name: 'SKILL.md',
        mimeType: 'text/markdown',
        size: 10,
        store: {
          id: skill.storeId,
          path: '/SKILL.md'
        }
      })
    ).rejects.toThrow('SKILL.md is reserved for documents in skill stores');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'add',
            path: '/docs/SKILL.md/'
          }
        ]
      })
    ).rejects.toThrow('SKILL.md is reserved for documents in skill stores');
  });

  it('creates skill versions for store snapshots and resolves document version content', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_versioned',
      name: 'Versioned Skill'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Instructions',
      content: 'first content',
      store: {
        id: skill.storeId,
        path: '/instructions.md'
      }
    });
    let staleDirtyAt = subtractHours(new Date(), 2);

    await db.store.update({
      where: {
        id: skill.storeId
      },
      data: {
        dirtyAt: staleDirtyAt
      }
    });

    let snapshotResult = await storeVersionService.createStoreVersionSnapshot({
      storeId: skill.storeId,
      expectedDirtyAt: staleDirtyAt
    });

    expect(snapshotResult?.alreadyExisted).toBe(false);

    await db.store.update({
      where: {
        id: skill.storeId
      },
      data: {
        dirtyAt: staleDirtyAt
      }
    });

    let idempotentResult = await storeVersionService.createStoreVersionSnapshot({
      storeId: skill.storeId,
      expectedDirtyAt: staleDirtyAt
    });
    let skillVersionsAfterRetry = await db.skillVersion.findMany({
      where: {
        skill: {
          id: skill.id
        }
      }
    });

    expect(idempotentResult?.alreadyExisted).toBe(true);
    expect(skillVersionsAfterRetry).toHaveLength(1);

    await db.documentVersion.update({
      where: {
        id: document.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: document.id,
      content: 'second content'
    });
    await flushDocumentDraft({
      documentId: document.id,
      force: true
    });

    let currentDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: document.id
    });
    let listed = await cargoClient.skillVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      limit: 10
    });
    let fetched = await cargoClient.skillVersion.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillVersionId: listed.items[0]!.id
    });
    let snapshot = await cargoClient.skillVersion.getSnapshot({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      skillVersionId: listed.items[0]!.id
    });
    let documentItem = snapshot.items.find(item => item.documentId === document.id);

    expect(currentDocument.content).toBe('second content');
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      skillId: skill.id,
      storeId: skill.storeId,
      storeVersionId: snapshotResult?.version.id,
      versionNumber: 1
    });
    expect(fetched.id).toBe(listed.items[0]!.id);
    expect(snapshot).toMatchObject({
      id: listed.items[0]!.id,
      skillId: skill.id,
      storeId: skill.storeId,
      storeVersionId: snapshotResult?.version.id,
      versionNumber: 1
    });
    expect(documentItem).toMatchObject({
      kind: 'document',
      path: '/instructions.md',
      documentId: document.id,
      documentVersionId: document.currentVersionId,
      content: 'first content'
    });
  });

  it('applies the fork snapshot when accepting a synced document', async () => {
    let { tenant, environment } = await createScope();
    let upstreamEditor = await createActor(tenant.id, {
      identifier: 'skill-merge-accept-source-upstream-editor',
      name: 'Skill Merge Accept Source Upstream Editor'
    });
    let forkEditor = await createActor(tenant.id, {
      identifier: 'skill-merge-accept-source-fork-editor',
      name: 'Skill Merge Accept Source Fork Editor'
    });
    let upstream = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_merge_accept_source_upstream',
      actorId: upstreamEditor.id,
      name: 'Merge Accept Source Upstream'
    });
    let upstreamDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Skill',
      content: 'Hello world. This is a real test.',
      actorId: upstreamEditor.id,
      store: {
        id: upstream.storeId,
        path: '/SKILL.md'
      }
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let fork = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_merge_accept_source_fork',
      actorId: forkEditor.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Merge Accept Source Fork'
    });
    let forkItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: fork.storeId,
      limit: 100
    });
    let forkDocumentItem = forkItems.items.find(item => item.path === '/SKILL.md')!;
    let forkContent =
      'Hello world. This is a real test. Hello world. This is a test. I am testing.';
    let upstreamConflictContent =
      'Hello world. This is a real test. Upstream changed independently.';

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkDocumentItem.documentId!,
      actorId: forkEditor.id,
      content: forkContent
    });
    await flushDocumentDraft({
      documentId: forkDocumentItem.documentId!,
      force: true
    });
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamEditor.id,
      content: upstreamConflictContent
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let mergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkEditor.id,
      title: 'Accept the fork SKILL.md'
    });
    let plan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });
    let skillItem = plan.items.find(item => item.path === '/SKILL.md')!;

    expect(skillItem).toMatchObject({
      changeType: 'conflicted',
      status: 'unresolved',
      resolutionType: null,
      documentMerge: {
        sourceContent: forkContent,
        targetContent: upstreamConflictContent,
        hasConflict: true
      }
    });
    await cargoClient.skillMergeRequest.resolveItem({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      itemId: skillItem.id,
      actorId: upstreamEditor.id,
      resolutionType: 'accept_source'
    });
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamEditor.id,
      content: `${upstreamConflictContent} Changed after resolution.`
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });
    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });
    await expect(
      processSkillMergeRequestPerformJob({
        skillMergeRequestId: mergeRequest.id
      })
    ).rejects.toThrow(
      'The target skill changed while merging. Review the outstanding choices and try again.'
    );
    let invalidatedResolution = await cargoClient.skillMergeRequest.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });
    let invalidatedPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(invalidatedResolution).toMatchObject({
      status: 'open',
      mergeErrorCode: 'unresolved_after_refresh',
      mergeError:
        'The target skill changed while merging. Review the outstanding choices and try again.'
    });
    expect(invalidatedPlan.items.find(item => item.id === skillItem.id)).toMatchObject({
      status: 'unresolved',
      resolutionType: null
    });
    await cargoClient.skillMergeRequest.resolveItem({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      itemId: skillItem.id,
      actorId: upstreamEditor.id,
      resolutionType: 'accept_source'
    });
    let replacementMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkEditor.id,
      title: 'Duplicate active request'
    });
    expect(replacementMergeRequest).toMatchObject({
      status: 'open',
      title: 'Duplicate active request'
    });
    expect(
      await cargoClient.skillMergeRequest.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        actorId: upstreamEditor.id
      })
    ).toMatchObject({
      status: 'closed'
    });
    await cargoClient.skillMergeRequest.close({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: replacementMergeRequest.id,
      actorId: upstreamEditor.id
    });

    await db.skillMergeRequest.update({
      where: { id: mergeRequest.id },
      data: {
        status: 'merging',
        mergeStartedAt: new Date(Date.now() - 20 * 60 * 1000)
      }
    });
    await recoverStaleSkillMergeRequests();
    let recovered = await cargoClient.skillMergeRequest.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(recovered).toMatchObject({
      status: 'open',
      mergeErrorCode: 'stale_merge_recovered'
    });
    let recoveredEvents = await cargoClient.skillMergeRequest.event.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id,
      limit: 20
    });
    expect(recoveredEvents.items.at(-1)).toMatchObject({
      type: 'merge_failed',
      errorCode: 'stale_merge_recovered'
    });
    expect(recoveredEvents.items.at(-1)?.actor).toBeUndefined();

    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });
    await expect(
      cargoClient.skillMergeRequest.resolveItem({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        itemId: skillItem.id,
        actorId: upstreamEditor.id,
        resolutionType: 'accept_source'
      })
    ).rejects.toThrow('Only open merge requests can change');
    await expect(
      cargoClient.skillMergeRequest.perform({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        actorId: upstreamEditor.id
      })
    ).rejects.toThrow('Only open merge requests can merge');
    let applyResolvedItems = skillMergeRequestApplyInternalService.applyResolvedItems.bind(
      skillMergeRequestApplyInternalService
    );
    vi.spyOn(
      skillMergeRequestApplyInternalService,
      'applyResolvedItems'
    ).mockImplementationOnce(async input => {
      await applyResolvedItems({
        ...input,
        items: input.items.slice(0, 1)
      });
      throw new Error('Injected partial merge failure');
    });
    let staleCollaborationContent = 'Content left in collaboration storage before merge.';
    await internalDocumentCollaborationService.withDocumentLock(
      upstreamDocument.id,
      async () => {
        await internalDocumentCollaborationService.replaceStateWhileLocked({
          documentId: upstreamDocument.id,
          update: createTestYjsUpdate(staleCollaborationContent)
        });
      }
    );
    await expect(
      processSkillMergeRequestPerformJob({
        skillMergeRequestId: mergeRequest.id
      })
    ).rejects.toThrow('The merge could not be applied. Review the request and try again.');
    let recoveredPartialMerge = await cargoClient.skillMergeRequest.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(recoveredPartialMerge).toMatchObject({
      status: 'open',
      mergeErrorCode: 'apply_failed',
      mergeError: 'The merge could not be applied. Review the request and try again.'
    });
    expect(recoveredPartialMerge.mergeError).not.toContain('Injected partial merge failure');
    let failedEvents = await cargoClient.skillMergeRequest.event.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id,
      types: ['merge_failed'],
      limit: 20
    });
    expect(failedEvents.items.map(event => event.errorCode)).toEqual([
      'unresolved_after_refresh',
      'stale_merge_recovered',
      'apply_failed'
    ]);
    expect(failedEvents.items.at(-1)).toMatchObject({
      errorMessage: 'The merge could not be applied. Review the request and try again.'
    });
    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });
    let merged = await processSkillMergeRequestPerformJob({
      skillMergeRequestId: mergeRequest.id
    });
    let mergedDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id
    });
    let mergedSnapshot = await cargoClient.skillVersion.getSnapshot({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: upstream.id,
      skillVersionId: merged!.mergedTargetSkillVersion!.id
    });
    let persistedDocument = await db.document.findUniqueOrThrow({
      where: { id: upstreamDocument.id },
      include: {
        currentVersion: {
          include: {
            content: true
          }
        }
      }
    });
    let collaborationSnapshot = await internalDocumentCollaborationService.getSnapshot(
      upstreamDocument.id
    );
    let staleUpdate = await internalDocumentCollaborationService.mergeUpdate({
      documentId: upstreamDocument.id,
      generation: collaborationSnapshot.generation - 1,
      update: createTestYjsUpdate(staleCollaborationContent)
    });
    let collaborationAfterStaleUpdate = await internalDocumentCollaborationService.getSnapshot(
      upstreamDocument.id
    );

    expect(merged?.status).toBe('merged');
    expect(mergedDocument.content).toBe(forkContent);
    expect(persistedDocument.currentVersion!.content.content).toBe(forkContent);
    expect(collaborationSnapshot.update).toBeNull();
    expect(staleUpdate.stale).toBe(true);
    expect(collaborationAfterStaleUpdate).toEqual(collaborationSnapshot);
    expect(mergedSnapshot.items.find(item => item.path === '/SKILL.md')).toMatchObject({
      content: forkContent
    });

    let secondForkContent = `${forkContent} Incremental fork change.`;
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkDocumentItem.documentId!,
      actorId: forkEditor.id,
      content: secondForkContent
    });
    await flushDocumentDraft({
      documentId: forkDocumentItem.documentId!,
      force: true
    });
    let secondMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkEditor.id,
      title: 'Merge the next fork change'
    });
    let secondPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: secondMergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(secondMergeRequest.baseStrategy).toBe('inferred_current');
    expect(secondPlan.items.find(item => item.path === '/SKILL.md')).toMatchObject({
      changeType: 'modified',
      status: 'resolved',
      resolutionType: 'accept_source',
      documentMerge: {
        sourceContent: secondForkContent,
        targetContent: forkContent,
        hasConflict: false
      }
    });
  });

  it('uses the last effective merge as separate source and target baselines', async () => {
    let { tenant, environment } = await createScope();
    let upstreamEditor = await createActor(tenant.id, {
      identifier: 'skill-repeat-merge-upstream-editor',
      name: 'Skill Repeat Merge Upstream Editor'
    });
    let forkEditor = await createActor(tenant.id, {
      identifier: 'skill-repeat-merge-fork-editor',
      name: 'Skill Repeat Merge Fork Editor'
    });
    let upstream = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_repeat_merge_upstream',
      actorId: upstreamEditor.id,
      name: 'Repeat Merge Upstream'
    });
    let upstreamDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Skill',
      content: 'base content',
      actorId: upstreamEditor.id,
      store: {
        id: upstream.storeId,
        path: '/SKILL.md'
      }
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let fork = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_repeat_merge_fork',
      actorId: forkEditor.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Repeat Merge Fork'
    });
    let forkItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: fork.storeId,
      limit: 100
    });
    let forkDocumentId = forkItems.items.find(item => item.path === '/SKILL.md')!.documentId!;

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkDocumentId,
      actorId: forkEditor.id,
      content: 'fork content one'
    });
    await flushDocumentDraft({
      documentId: forkDocumentId,
      force: true
    });
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamEditor.id,
      content: 'upstream content one'
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let firstMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkEditor.id,
      title: 'First custom merge'
    });
    let firstPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: firstMergeRequest.id,
      actorId: upstreamEditor.id
    });
    let firstConflict = firstPlan.items.find(item => item.path === '/SKILL.md')!;
    await cargoClient.skillMergeRequest.resolveItem({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: firstMergeRequest.id,
      itemId: firstConflict.id,
      actorId: upstreamEditor.id,
      resolutionType: 'edit_document',
      resolution: {
        title: 'Skill',
        content: 'custom merged content'
      }
    });
    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: firstMergeRequest.id,
      actorId: upstreamEditor.id
    });
    await processSkillMergeRequestPerformJob({
      skillMergeRequestId: firstMergeRequest.id
    });

    await expect(
      cargoClient.skillMergeRequest.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        sourceSkillId: fork.id,
        actorId: forkEditor.id,
        title: 'No incremental changes'
      })
    ).rejects.toThrow('has no changes to merge');

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkDocumentId,
      actorId: forkEditor.id,
      content: 'fork content two'
    });
    await flushDocumentDraft({
      documentId: forkDocumentId,
      force: true
    });
    let secondMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkEditor.id,
      title: 'Second incremental merge'
    });
    let secondPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: secondMergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(secondMergeRequest.baseStrategy).toBe('inferred_current');
    expect(secondPlan.items).toHaveLength(1);
    expect(secondPlan.items[0]).toMatchObject({
      path: '/SKILL.md',
      changeType: 'modified',
      status: 'resolved',
      resolutionType: 'accept_source',
      documentMerge: {
        baseContent: 'fork content one',
        sourceContent: 'fork content two',
        targetContent: 'custom merged content',
        hasConflict: false
      }
    });

    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: secondMergeRequest.id,
      actorId: upstreamEditor.id
    });
    await processSkillMergeRequestPerformJob({
      skillMergeRequestId: secondMergeRequest.id
    });

    let upstreamOnlyDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Upstream Only',
      content: 'upstream only content',
      actorId: upstreamEditor.id,
      store: {
        id: upstream.storeId,
        path: '/upstream-only.md'
      }
    });
    await flushDocumentDraft({
      documentId: upstreamOnlyDocument.id,
      force: true
    });
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamEditor.id,
      content: 'independent upstream change'
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkDocumentId,
      actorId: forkEditor.id,
      content: 'fork content three'
    });
    await flushDocumentDraft({
      documentId: forkDocumentId,
      force: true
    });

    let conflictingMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkEditor.id,
      title: 'Conflicting incremental merge'
    });
    let conflictingPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: conflictingMergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(conflictingPlan.items).toHaveLength(1);
    expect(conflictingPlan.items[0]).toMatchObject({
      path: '/SKILL.md',
      changeType: 'conflicted',
      status: 'unresolved',
      conflictReason: 'source_and_target_changed'
    });
    expect(
      conflictingPlan.items.find(item => item.path === '/upstream-only.md')
    ).toBeUndefined();

    await cargoClient.skillMergeRequest.close({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: conflictingMergeRequest.id,
      actorId: upstreamEditor.id
    });
    let closedEvents = await cargoClient.skillMergeRequest.event.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: conflictingMergeRequest.id,
      actorId: upstreamEditor.id,
      limit: 20
    });
    expect(closedEvents.items.at(-1)).toMatchObject({
      type: 'closed',
      actor: { id: upstreamEditor.id }
    });
    await cargoClient.skillMergeRequest.rollback({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: secondMergeRequest.id,
      actorId: upstreamEditor.id
    });

    let afterRollbackMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkEditor.id,
      title: 'Merge after rollback'
    });
    let afterRollbackPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: afterRollbackMergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(afterRollbackMergeRequest.baseStrategy).toBe('inferred_current');
    expect(afterRollbackPlan.items).toHaveLength(1);
    expect(afterRollbackPlan.items[0]).toMatchObject({
      path: '/SKILL.md',
      changeType: 'modified',
      status: 'resolved',
      resolutionType: 'accept_source'
    });
  });

  it('does not remerge a synced sibling fork after the upstream merge is rolled back', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'skill-rollback-sibling-editor',
      name: 'Skill Rollback Sibling Editor'
    });
    let upstream = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_rollback_sibling_upstream',
      actorId: actor.id,
      name: 'Rollback Sibling Upstream'
    });
    let upstreamDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Skill',
      content: 'base content',
      actorId: actor.id,
      store: {
        id: upstream.storeId,
        path: '/SKILL.md'
      }
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let forkA = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_rollback_sibling_fork_a',
      actorId: actor.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Rollback Sibling Fork A'
    });
    let forkB = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_rollback_sibling_fork_b',
      actorId: actor.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Rollback Sibling Fork B'
    });
    let forkAItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: forkA.storeId,
      limit: 100
    });
    let forkADocumentId = forkAItems.items.find(
      item => item.path === '/SKILL.md'
    )!.documentId!;

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkADocumentId,
      actorId: actor.id,
      content: 'fork A content'
    });
    await flushDocumentDraft({
      documentId: forkADocumentId,
      force: true
    });

    let forkAMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: forkA.id,
      actorId: actor.id,
      title: 'Merge fork A'
    });
    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: forkAMergeRequest.id,
      actorId: actor.id
    });
    await processSkillMergeRequestPerformJob({
      skillMergeRequestId: forkAMergeRequest.id
    });

    let forkBSync = await cargoClient.skillForkSync.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      forkSkillId: forkB.id,
      actorId: actor.id
    });
    await processSkillForkSyncJob({
      skillForkSyncId: forkBSync.id
    });
    let processingSync = await cargoClient.skillForkSync.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillForkSyncId: forkBSync.id,
      actorId: actor.id
    });
    await processSkillMergeRequestPerformJob({
      skillMergeRequestId: processingSync.generatedMergeRequestId!
    });

    await cargoClient.skillMergeRequest.rollback({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: forkAMergeRequest.id,
      actorId: actor.id
    });
    expect(
      (
        await cargoClient.document.get({
          tenantId: tenant.id,
          environmentId: environment.id,
          documentId: upstreamDocument.id
        })
      ).content
    ).toBe('base content');

    await expect(
      cargoClient.skillMergeRequest.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        sourceSkillId: forkB.id,
        actorId: actor.id,
        title: 'Merge fork B after rollback'
      })
    ).rejects.toThrow('The source skill has no changes to merge');
  });

  it('creates, comments on, asynchronously merges, and rolls back skill merge requests', async () => {
    let { tenant, environment } = await createScope();
    let upstreamEditor = await createActor(tenant.id, {
      identifier: 'skill-merge-upstream-editor',
      name: 'Skill Merge Upstream Editor'
    });
    let forkReader = await createActor(tenant.id, {
      identifier: 'skill-merge-fork-reader',
      name: 'Skill Merge Fork Reader'
    });
    let upstream = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_merge_upstream',
      actorId: upstreamEditor.id,
      name: 'Merge Upstream'
    });
    let upstreamDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Instructions',
      content: 'base instructions',
      actorId: upstreamEditor.id,
      store: {
        id: upstream.storeId,
        path: '/instructions.md'
      }
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let fork = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_merge_fork',
      actorId: forkReader.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Merge Fork'
    });
    let forkRecord = await db.skill.findUniqueOrThrow({
      where: {
        id: fork.id
      }
    });

    expect(forkRecord.forkedFromSkillVersionOid).toBeTruthy();

    await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: upstream.id,
      actorId: forkReader.id,
      permissions: ['content_read']
    });

    let forkItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: fork.storeId,
      limit: 100
    });
    let forkDocumentItem = forkItems.items.find(item => item.path === '/instructions.md')!;

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkDocumentItem.documentId!,
      actorId: forkReader.id,
      content: 'fork instructions'
    });
    await flushDocumentDraft({
      documentId: forkDocumentItem.documentId!,
      force: true
    });
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamEditor.id,
      content: 'upstream instructions'
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let mergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkReader.id,
      title: 'Merge fork instructions',
      description: 'Bring forked instructions upstream'
    });
    let plan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });
    let anonymousMergeRequests = await cargoClient.skillMergeRequest.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let conflict = plan.items.find(item => item.path === '/instructions.md')!;

    expect(mergeRequest.status).toBe('open');
    expect(mergeRequest.createdByActor).toMatchObject({ id: forkReader.id });
    expect(anonymousMergeRequests.items).toHaveLength(0);
    expect(mergeRequest.baseStrategy).toBe('exact');
    expect(mergeRequest.requestedSourceSkillVersionId).toBeTruthy();
    expect(mergeRequest.requestedTargetSkillVersionId).toBeTruthy();
    expect(conflict).toMatchObject({
      kind: 'document',
      changeType: 'conflicted',
      status: 'unresolved',
      documentMerge: {
        baseContent: 'base instructions',
        sourceContent: 'fork instructions',
        targetContent: 'upstream instructions',
        hasConflict: true
      }
    });

    let comment = await cargoClient.skillMergeRequest.comment.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      skillMergeRequestItemId: conflict.id,
      actorId: forkReader.id,
      body: 'Please take the fork version with an edit.'
    });

    expect(comment).toMatchObject({
      skillMergeRequestItemId: conflict.id,
      actor: {
        id: forkReader.id
      },
      path: '/instructions.md'
    });
    await expect(
      cargoClient.skillMergeRequest.comment.update({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        commentId: comment.id,
        actorId: upstreamEditor.id,
        body: 'Edited by another actor.'
      })
    ).rejects.toThrow('Cannot edit another actor comment');
    await db.tenantActor.update({
      where: {
        id: upstreamEditor.id
      },
      data: {
        organizationActorId: 'oac_skill_merge_upstream_editor'
      }
    });
    await expect(
      cargoClient.skillMergeRequest.comment.update({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        commentId: comment.id,
        actorId: upstreamEditor.id,
        body: 'Edited by organization member.',
        canManageComments: true
      })
    ).resolves.toMatchObject({
      body: 'Edited by organization member.'
    });
    await cargoClient.skillMergeRequest.comment.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      commentId: comment.id,
      actorId: forkReader.id,
      body: 'Please take the fork version with an edit.'
    });
    let consumerActor = await createActor(tenant.id, {
      identifier: 'skill-merge-consumer',
      name: 'Skill Merge Consumer'
    });
    await db.tenantActor.update({
      where: {
        id: consumerActor.id
      },
      data: {
        consumerId: 'con_skill_merge_consumer'
      }
    });
    await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: fork.id,
      actorId: consumerActor.id,
      permissions: ['content_read']
    });
    await expect(
      cargoClient.skillMergeRequest.comment.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        commentId: comment.id,
        actorId: consumerActor.id,
        canManageComments: true
      })
    ).rejects.toThrow('Cannot delete another actor comment');
    await expect(
      cargoClient.skillMergeRequest.resolveItem({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        itemId: conflict.id,
        actorId: upstreamEditor.id,
        resolutionType: 'edit_document',
        resolution: {
          title: 'Instructions'
        }
      })
    ).rejects.toThrow('edit_document with content');
    await expect(
      cargoClient.skillMergeRequest.bulkResolveItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        actorId: upstreamEditor.id,
        items: [
          {
            itemId: conflict.id,
            resolutionType: 'edit_document',
            resolution: { content: 'first' }
          },
          {
            itemId: conflict.id,
            resolutionType: 'edit_document',
            resolution: { content: 'second' }
          }
        ]
      })
    ).rejects.toThrow('item IDs must be unique');

    await cargoClient.skillMergeRequest.resolveItem({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      itemId: conflict.id,
      actorId: upstreamEditor.id,
      resolutionType: 'edit_document',
      resolution: {
        title: 'Instructions',
        content: 'merged instructions'
      }
    });

    let merging = await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });

    expect(merging.status).toBe('merging');

    let merged = await processSkillMergeRequestPerformJob({
      skillMergeRequestId: mergeRequest.id
    });
    let mergedDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id
    });

    expect(merged?.status).toBe('merged');
    expect(merged?.preMergeTargetSkillVersionOid).toBeTruthy();
    expect(merged?.mergedTargetSkillVersionOid).toBeTruthy();
    expect(mergedDocument.content).toBe('merged instructions');

    let rolledBack = await cargoClient.skillMergeRequest.rollback({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id
    });
    let rolledBackDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id
    });

    expect(rolledBack.status).toBe('merged');
    expect(rolledBack.rollbackTargetSkillVersionId).toBeTruthy();
    expect(rolledBack.rolledBackByActor).toMatchObject({ id: upstreamEditor.id });
    expect(rolledBackDocument.content).toBe('upstream instructions');

    await cargoClient.skillMergeRequest.comment.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      commentId: comment.id,
      actorId: forkReader.id
    });
    let events = await cargoClient.skillMergeRequest.event.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: mergeRequest.id,
      actorId: upstreamEditor.id,
      limit: 20
    });
    expect(events.items.map(event => event.type)).toEqual([
      'created',
      'commented',
      'all_conflicts_resolved',
      'merge_started',
      'merge_completed',
      'rolled_back'
    ]);
    expect(events.items[0]?.actor).toMatchObject({ id: forkReader.id });
    expect(events.items[1]).toMatchObject({
      actor: { id: forkReader.id },
      comment: {
        id: comment.id,
        actor: { id: forkReader.id },
        body: 'Please take the fork version with an edit.',
        deletedAt: expect.any(Date)
      }
    });
    expect(events.items.slice(2).every(event => event.actor?.id === upstreamEditor.id)).toBe(
      true
    );
    expect(
      await cargoClient.skillMergeRequest.event.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        eventId: events.items[1]!.id,
        actorId: upstreamEditor.id
      })
    ).toMatchObject({
      type: 'commented',
      comment: { id: comment.id }
    });
    await expect(
      cargoClient.skillMergeRequest.rollback({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: mergeRequest.id,
        actorId: upstreamEditor.id
      })
    ).rejects.toThrow('Only unrolled-back merged requests');

    let unchangedFork = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_merge_unchanged_fork',
      actorId: forkReader.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Unchanged Merge Fork'
    });
    await expect(
      cargoClient.skillMergeRequest.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        sourceSkillId: unchangedFork.id,
        actorId: forkReader.id,
        title: 'Empty merge request'
      })
    ).rejects.toThrow('has no changes to merge');

    let rebasedFork = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_merge_rebased_fork',
      actorId: forkReader.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Rebased Merge Fork'
    });
    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Fork addition',
      content: 'added by fork',
      actorId: forkReader.id,
      store: {
        id: rebasedFork.storeId,
        path: '/fork-addition.md'
      }
    });
    let rebasedMergeRequest = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: rebasedFork.id,
      actorId: forkReader.id,
      title: 'Merge fork addition after upstream edit'
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamEditor.id,
      content: 'upstream changed after merge request creation'
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: rebasedMergeRequest.id,
      actorId: upstreamEditor.id
    });
    let rebasedMerge = await processSkillMergeRequestPerformJob({
      skillMergeRequestId: rebasedMergeRequest.id
    });

    expect(rebasedMerge?.status).toBe('merged');
    let upstreamItemsAfterRebase = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: upstream.storeId,
      limit: 100
    });
    expect(upstreamItemsAfterRebase.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/fork-addition.md'
        })
      ])
    );

    await db.skill.update({
      where: { id: fork.id },
      data: { forkedFromSkillVersionOid: null }
    });
    await expect(
      cargoClient.skillMergeRequest.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        sourceSkillId: fork.id,
        actorId: forkReader.id,
        title: 'Legacy fork merge'
      })
    ).rejects.toThrow('require a fork with a recorded base version');
  });

  it('tracks skill participants from creator, store access, use, and forks', async () => {
    let { tenant, environment } = await createScope();
    let creator = await createActor(tenant.id, {
      identifier: 'skill-participant-creator',
      name: 'Skill Participant Creator'
    });
    let viewer = await createActor(tenant.id, {
      identifier: 'skill-participant-viewer',
      name: 'Skill Participant Viewer'
    });
    let editor = await createActor(tenant.id, {
      identifier: 'skill-participant-editor',
      name: 'Skill Participant Editor'
    });
    let forker = await createActor(tenant.id, {
      identifier: 'skill-participant-forker',
      name: 'Skill Participant Forker'
    });

    let parent = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_participant_parent',
      actorId: creator.id,
      name: 'Participant Parent'
    });

    let afterCreate = await cargoClient.skillParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      limit: 10
    });
    let creatorParticipant = afterCreate.items.find(item => item.actor.id === creator.id);

    expect(creatorParticipant).toMatchObject({
      object: 'cargo#skillParticipant',
      skillId: parent.id,
      roles: expect.arrayContaining(['creator', 'editor']),
      actor: {
        id: creator.id
      }
    });

    let used = await cargoClient.skill.markSkillUse({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      actorId: creator.id
    });

    expect(used).toMatchObject({
      skillId: parent.id,
      roles: expect.arrayContaining(['creator', 'editor', 'user']),
      actor: {
        id: creator.id
      }
    });

    await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: parent.storeId,
      actorId: viewer.id,
      defaultPermissions: ['content_read']
    });
    await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      actorId: editor.id,
      permissions: ['content_read', 'content_write']
    });

    let afterStoreSync = await cargoClient.skillParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      limit: 10
    });
    let viewerParticipant = afterStoreSync.items.find(item => item.actor.id === viewer.id);
    let editorParticipant = afterStoreSync.items.find(item => item.actor.id === editor.id);

    expect(viewerParticipant).toMatchObject({
      skillId: parent.id,
      roles: ['viewer'],
      actor: {
        id: viewer.id
      }
    });
    expect(editorParticipant).toMatchObject({
      skillId: parent.id,
      roles: ['editor'],
      actor: {
        id: editor.id
      }
    });

    let fetchedViewer = await cargoClient.skillParticipant.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillParticipantId: viewerParticipant!.id
    });

    expect(fetchedViewer).toMatchObject({
      id: viewerParticipant!.id,
      skillId: parent.id,
      roles: ['viewer']
    });

    await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_participant_child_fork',
      actorId: forker.id,
      parentSkill: {
        skillId: parent.id,
        type: 'fork'
      },
      name: 'Participant Child Fork'
    });

    let afterFork = await cargoClient.skillParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      limit: 10
    });
    let forkerParticipant = afterFork.items.find(item => item.actor.id === forker.id);

    expect(forkerParticipant).toMatchObject({
      skillId: parent.id,
      roles: expect.arrayContaining(['forker']),
      actor: {
        id: forker.id
      }
    });
  });

  it('creates skills from skill-template parents by cloning the underlying store template', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'skill-template-creator',
      name: 'Skill Template Creator'
    });
    let sourceStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_skill_template_source_store',
      name: 'Skill Template Source',
      access: 'public_read'
    });

    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: 'cdoc_skill_template_source_document',
      title: 'Template Skill',
      content:
        '---\ndescription: Template metadata\n---\n\n# Template Skill\n\nTemplate-backed content',
      store: {
        id: sourceStore.id,
        path: '/SKILL.md'
      }
    });
    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: 'cdoc_skill_template_source_readme',
      title: 'Readme',
      content: '# Readme\n\nSupplemental content',
      store: {
        id: sourceStore.id,
        path: '/docs/readme.md'
      }
    });

    let skillTemplate = await cargoClient.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: 'cskt_skill_parent_template',
      storeId: sourceStore.id,
      name: 'Starter Skill Template'
    });

    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_from_template_parent',
      actorId: actor.id,
      parentSkillTemplateId: skillTemplate.id,
      name: 'Skill From Template Parent'
    });

    let skillRecord = await db.skill.findUnique({
      where: {
        id: skill.id
      }
    });
    let skillTemplateRecord = await db.skillTemplate.findUnique({
      where: {
        id: skillTemplate.id
      }
    });
    let createdStoreRecord = await db.store.findUnique({
      where: {
        id: skill.storeId
      }
    });
    let createdItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: skill.storeId,
      limit: 20
    });
    let createdDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdItems.items.find(item => item.path === '/SKILL.md')!.documentId!
    });
    let createdReadmeDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdItems.items.find(item => item.path === '/docs/readme.md')!.documentId!
    });
    let createdDocumentRecord = await db.document.findUnique({
      where: {
        id: createdDocument.id
      }
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: skill.storeId
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(skill).toMatchObject({
      id: 'csk_from_template_parent',
      storeId: expect.any(String),
      parentSkillTemplateId: skillTemplate.id
    });
    expect(skillTemplate.storeId).toBe(sourceStore.id);
    expect(skillTemplate.storeTemplate.storeId).toBe(sourceStore.id);
    expect(skill.parentSkillId).toBeUndefined();
    expect(skill.store.cloneType).toBe('duplicate');
    expect(skillRecord?.parentSkillTemplateOid).toBe(skillTemplateRecord?.oid);
    expect(skillRecord?.createdByTenantActorOid).toBeTruthy();
    expect(createdStoreRecord?.parentStoreTemplateOid).toBe(
      skillTemplateRecord?.storeTemplateOid
    );
    expect(createdStoreRecord?.createdByTenantActorOid).toBeTruthy();
    expect(createdItems.items.map(item => item.path)).toContain('/SKILL.md');
    expect(createdItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(createdDocument.title).toBe(skill.name);
    expect(createdDocument.content).toBe(
      '---\ndescription: Template metadata\n---\n\n# Skill From Template Parent\n\nTemplate-backed content'
    );
    expect(createdDocument.content).not.toContain('# Template Skill');
    expect(createdReadmeDocument.title).toBe('Readme');
    expect(createdReadmeDocument.content).toBe('# Readme\n\nSupplemental content');
    expect(createdDocumentRecord?.parentDocumentOid).toBeNull();
    expect(createdDocumentRecord?.isContentOwner).toBe(true);
    expect(createdDocumentRecord?.createdByTenantActorOid).toBeTruthy();
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);
  });

  it('creates skill templates from skillId by snapshotting the skill store into a duplicated source store', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_template_source_skill',
      name: 'Template Source Skill'
    });

    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: 'cdoc_template_source_skill',
      title: 'Readme',
      content: 'snapshot me',
      store: {
        id: skill.storeId,
        path: '/docs/readme.md'
      }
    });

    let created = await cargoClient.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: 'cskt_from_skill',
      skillId: skill.id,
      name: 'Template From Skill'
    });

    let templateSourceStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeTemplate.sourceStoreId!
    });
    let templateSourceItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: templateSourceStore.id,
      limit: 20
    });
    let templateSourceDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: templateSourceItems.items.find(item => item.path === '/docs/readme.md')!
        .documentId!
    });

    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: 'cdoc_template_source_late_change',
      title: 'Later Change',
      content: 'should not be included',
      store: {
        id: skill.storeId,
        path: '/docs/later.md'
      }
    });

    let instantiatedSkill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_instantiated_from_skill_template',
      parentSkillTemplateId: created.id,
      name: 'Instantiated From Template'
    });
    let instantiatedItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: instantiatedSkill.storeId,
      limit: 20
    });
    let templateRecord = await db.skillTemplate.findUnique({
      where: {
        id: created.id
      }
    });

    expect(created.storeTemplate.type).toBe('linked_store');
    expect(created.storeTemplate.sourceStoreId).toBeTruthy();
    expect(created.storeTemplate.sourceStoreId).not.toBe(skill.storeId);
    expect(templateSourceStore.cloneType).toBe('duplicate');
    expect(templateSourceItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(templateSourceItems.items.map(item => item.path)).not.toContain('/docs/later.md');
    expect(templateSourceDocument.content).toBe('snapshot me');
    expect(templateRecord?.storeTemplateOid).toBeTruthy();
    expect(instantiatedItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(instantiatedItems.items.map(item => item.path)).not.toContain('/docs/later.md');
  });

  it('preserves standalone file template mime types when instantiating skills', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'skill-template-file-creator',
      name: 'Skill Template File Creator'
    });
    let skillTemplate = await cargoClient.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: 'cskt_standalone_file_template',
      name: 'Standalone File Template',
      items: [
        {
          path: '/assets/',
          type: 'directory'
        },
        {
          path: '/assets/readme.txt',
          type: 'file',
          content: 'template file content',
          encoding: 'utf-8',
          mimeType: 'text/plain'
        },
        {
          path: '/SKILL.md',
          type: 'document',
          content:
            '---\ndescription: Standalone template\n---\n\n# Template Skill\n\nStandalone body',
          encoding: 'utf-8'
        }
      ]
    });

    let instantiatedSkill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_from_standalone_file_template',
      actorId: actor.id,
      parentSkillTemplateId: skillTemplate.id,
      name: 'From Standalone File Template'
    });
    let skillTemplateRecord = await db.skillTemplate.findUniqueOrThrow({
      where: {
        id: skillTemplate.id
      }
    });
    let templateItemRecord = await db.storeTemplateItem.findFirst({
      where: {
        storeTemplateOid: skillTemplateRecord.storeTemplateOid,
        path: '/assets/readme.txt'
      }
    });
    let createdFileItem = await db.storeItem.findFirst({
      where: {
        store: {
          id: instantiatedSkill.storeId
        },
        path: '/assets/readme.txt'
      },
      include: {
        file: true
      }
    });
    let createdItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: instantiatedSkill.storeId,
      limit: 20
    });
    let createdSkillDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdItems.items.find(item => item.path === '/SKILL.md')!.documentId!
    });

    expect(templateItemRecord?.mimeType).toBe('text/plain');
    expect(createdFileItem?.file?.fileType).toBe('text/plain');
    expect(createdSkillDocument.title).toBe(instantiatedSkill.name);
    expect(createdSkillDocument.content).toBe(
      '---\ndescription: Standalone template\n---\n\n# From Standalone File Template\n\nStandalone body'
    );
    expect(createdSkillDocument.content).not.toContain('# Template Skill');
  });

  it('rejects skill template creation when more than one source input is provided', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_source_for_validation',
      name: 'Validation Source Skill'
    });

    await expect(
      cargoClient.skillTemplate.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillTemplateId: 'cskt_invalid_template_source',
        skillId: skill.id,
        storeId: skill.storeId,
        name: 'Invalid Template Source'
      })
    ).rejects.toThrow(
      'Provide exactly one of skillId, storeId, or items when creating a skill template'
    );
  });

  it('queues fork syncs, handles conflicts, no-ops, and preserves the bidirectional baseline', async () => {
    let { tenant, environment } = await createScope();
    let upstreamActor = await createActor(tenant.id, {
      identifier: 'fork-sync-upstream',
      name: 'Fork Sync Upstream'
    });
    let forkActor = await createActor(tenant.id, {
      identifier: 'fork-sync-fork',
      name: 'Fork Sync Fork'
    });
    let upstream = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_fork_sync_upstream',
      actorId: upstreamActor.id,
      name: 'Fork Sync Upstream'
    });
    let upstreamDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: upstreamActor.id,
      title: 'Shared',
      content: 'base',
      store: {
        id: upstream.storeId,
        path: '/shared.md'
      }
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });
    let fork = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_fork_sync_fork',
      actorId: forkActor.id,
      parentSkill: {
        skillId: upstream.id,
        type: 'fork'
      },
      name: 'Fork Sync Fork'
    });
    await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: upstream.id,
      actorId: forkActor.id,
      permissions: ['content_read']
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamActor.id,
      content: 'upstream clean change'
    });
    await flushDocumentDraft({
      documentId: upstreamDocument.id,
      force: true
    });

    let pending = await cargoClient.skillForkSync.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      forkSkillId: fork.id,
      actorId: forkActor.id
    });
    expect(pending.status).toBe('pending');

    await processSkillForkSyncJob({ skillForkSyncId: pending.id });
    let completed = await cargoClient.skillForkSync.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillForkSyncId: pending.id,
      actorId: forkActor.id
    });
    expect(completed).toMatchObject({
      status: 'completed',
      forkSkillId: fork.id,
      upstreamSkillId: upstream.id,
      generatedMergeRequestId: undefined
    });
    expect(
      (
        await cargoClient.skillForkSync.get({
          tenantId: tenant.id,
          environmentId: environment.id,
          skillForkSyncId: pending.id,
          actorId: forkActor.id
        })
      ).status
    ).toBe('completed');

    let noOp = await cargoClient.skillForkSync.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      forkSkillId: fork.id,
      actorId: forkActor.id
    });
    await processSkillForkSyncJob({ skillForkSyncId: noOp.id });
    expect(
      await cargoClient.skillForkSync.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillForkSyncId: noOp.id,
        actorId: forkActor.id
      })
    ).toMatchObject({
      status: 'completed',
      generatedMergeRequestId: undefined
    });

    let forkItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: fork.storeId,
      limit: 100
    });
    let forkDocumentId = forkItems.items.find(item => item.path === '/shared.md')!.documentId!;
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: upstreamDocument.id,
      actorId: upstreamActor.id,
      content: 'upstream conflict'
    });
    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: forkDocumentId,
      actorId: forkActor.id,
      content: 'fork conflict'
    });
    await flushDocumentDraft({ documentId: upstreamDocument.id, force: true });
    await flushDocumentDraft({ documentId: forkDocumentId, force: true });

    let conflictedSync = await cargoClient.skillForkSync.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      forkSkillId: fork.id,
      actorId: forkActor.id
    });
    await processSkillForkSyncJob({ skillForkSyncId: conflictedSync.id });
    let actionRequired = await cargoClient.skillForkSync.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillForkSyncId: conflictedSync.id,
      actorId: forkActor.id
    });
    expect(actionRequired.status).toBe('action_required');
    let conflictPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: actionRequired.generatedMergeRequestId!,
      actorId: forkActor.id
    });
    let conflict = conflictPlan.items.find(item => item.path === '/shared.md')!;
    await cargoClient.skillMergeRequest.resolveItem({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: actionRequired.generatedMergeRequestId!,
      itemId: conflict.id,
      actorId: forkActor.id,
      resolutionType: 'accept_source'
    });
    vi.spyOn(skillMergeRequestPerformQueue, 'add').mockRejectedValueOnce(
      new Error('Injected enqueue failure')
    );
    await expect(
      cargoClient.skillMergeRequest.perform({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: actionRequired.generatedMergeRequestId!,
        actorId: forkActor.id
      })
    ).rejects.toThrow('The merge could not be started. Review the request and try again.');
    expect(
      await cargoClient.skillMergeRequest.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillMergeRequestId: actionRequired.generatedMergeRequestId!,
        actorId: forkActor.id
      })
    ).toMatchObject({
      status: 'open',
      mergeErrorCode: 'enqueue_failed'
    });
    expect(
      await cargoClient.skillForkSync.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillForkSyncId: conflictedSync.id,
        actorId: forkActor.id
      })
    ).toMatchObject({
      status: 'action_required',
      error: 'The merge could not be started. Review the request and try again.'
    });
    await cargoClient.skillMergeRequest.perform({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: actionRequired.generatedMergeRequestId!,
      actorId: forkActor.id
    });
    await processSkillMergeRequestPerformJob({
      skillMergeRequestId: actionRequired.generatedMergeRequestId!
    });
    expect(
      (
        await cargoClient.skillForkSync.get({
          tenantId: tenant.id,
          environmentId: environment.id,
          skillForkSyncId: conflictedSync.id,
          actorId: forkActor.id
        })
      ).status
    ).toBe('completed');

    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: forkActor.id,
      title: 'Fork only',
      content: 'fork only',
      store: {
        id: fork.storeId,
        path: '/fork-only.md'
      }
    });
    let outgoing = await cargoClient.skillMergeRequest.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      sourceSkillId: fork.id,
      actorId: forkActor.id,
      title: 'Fork-only change'
    });
    let outgoingPlan = await cargoClient.skillMergeRequest.getPlan({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillMergeRequestId: outgoing.id,
      actorId: upstreamActor.id
    });
    expect(outgoing.direction).toBe('fork_to_upstream');
    expect(outgoing.baseStrategy).toBe('inferred_current');
    expect(outgoingPlan.items.map(item => item.path)).toEqual(['/fork-only.md']);
  });
});
