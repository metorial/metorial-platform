import { createQueue } from '@lowerdeck/queue';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { buildIntegrationProviderToolFilterChain } from '@metorial-subspace/module-provider-internal';
import { env } from '../../env';
import { sessionTemplateArchivedQueue } from './sessionTemplate';
import {
  sessionTemplateProviderCreatedQueue,
  sessionTemplateSyncHashQueue
} from './sessionTemplateProvider';

export let syncIntegrationInstanceGroupSessionTemplatesQueue = createQueue<{
  integrationInstanceGroupId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedIntegrationInstanceGroupTemplate/syncMany',
  redisUrl: env.service.REDIS_URL
});

export let syncIntegrationInstanceGroupSessionTemplatesQueueProcessor =
  syncIntegrationInstanceGroupSessionTemplatesQueue.process(async data => {
    let integrationInstanceGroup = await db.integrationInstanceGroup.findUnique({
      where: { id: data.integrationInstanceGroupId }
    });
    if (
      !integrationInstanceGroup ||
      integrationInstanceGroup.status === 'archived' ||
      integrationInstanceGroup.status === 'deleted'
    ) {
      return;
    }

    let sessionTemplates = await db.sessionTemplate.findMany({
      where: {
        integrationInstanceGroupOid: integrationInstanceGroup.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessionTemplates.length === 0) return;

    await syncIntegrationInstanceGroupSessionTemplateQueue.addMany(
      sessionTemplates.map(sessionTemplate => ({
        sessionTemplateId: sessionTemplate.id
      }))
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await syncIntegrationInstanceGroupSessionTemplatesQueue.add({
      integrationInstanceGroupId: data.integrationInstanceGroupId,
      cursor: lastSessionTemplate.id
    });
  });

export let syncIntegrationInstanceGroupSessionTemplateQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/linkedIntegrationInstanceGroupTemplate/sync',
  redisUrl: env.service.REDIS_URL
});

export let syncIntegrationInstanceGroupSessionTemplate = async (data: {
  sessionTemplateId: string;
}) => {
  let sessionTemplate = await db.sessionTemplate.findUnique({
    where: { id: data.sessionTemplateId },
    include: { integrationInstanceGroup: true }
  });
  let integrationInstanceGroup = sessionTemplate?.integrationInstanceGroup;
  if (
    !sessionTemplate ||
    !integrationInstanceGroup ||
    !sessionTemplate.integrationInstanceGroupOid ||
    sessionTemplate.status !== 'active' ||
    integrationInstanceGroup.status === 'archived' ||
    integrationInstanceGroup.status === 'deleted'
  ) {
    return;
  }

  let groupProviders = await db.integrationInstanceGroupProvider.findMany({
    where: {
      integrationInstanceGroupOid: sessionTemplate.integrationInstanceGroupOid,
      status: 'active',
      isParentDeleted: false,
      integrationInstanceGroupSource: {
        status: 'active',
        isParentDeleted: false
      },
      integrationInstanceProvider: {
        status: 'active',
        isParentDeleted: false
      }
    },
    orderBy: { id: 'asc' },
    include: {
      integration: true,
      integrationProvider: true,
      integrationInstanceProvider: {
        include: {
          integrationProvider: true,
          currentVersion: {
            include: {
              integrationProviderVersion: true
            }
          }
        }
      }
    }
  });

  let materialProviders = groupProviders.filter(
    groupProvider => !!groupProvider.integrationInstanceProvider.currentVersion?.configOid
  );
  let materialProviderOids = new Set(
    materialProviders.map(groupProvider => groupProvider.oid.toString())
  );

  let existingTemplateProviders = await db.sessionTemplateProvider.findMany({
    where: {
      sessionTemplateOid: sessionTemplate.oid,
      status: { not: 'deleted' }
    }
  });
  let existingByDelegatedProviderOid = new Map(
    existingTemplateProviders
      .filter(provider => provider.integrationInstanceGroupProviderOid)
      .map(provider => [provider.integrationInstanceGroupProviderOid!, provider])
  );

  let createdSessionTemplateProviderIds = await withTransaction(async db => {
    let createdSessionTemplateProviderIds: string[] = [];

    for (let groupProvider of materialProviders) {
      let sourceProvider = groupProvider.integrationInstanceProvider;
      let currentVersion = sourceProvider.currentVersion!;
      let existing = existingByDelegatedProviderOid.get(groupProvider.oid);
      let toolFilter = buildIntegrationProviderToolFilterChain({
        canAttachCustomToolFilters: groupProvider.integration.canAttachCustomToolFilters,
        canOverrideToolFilters: groupProvider.integration.canOverrideToolFilters,
        integrationProviderToolFilter: currentVersion.integrationProviderVersion
          .toolFilter as PrismaJson.ToolFilter | null,
        integrationInstanceProviderToolFilter:
          currentVersion.toolFilter as PrismaJson.ToolFilter | null,
        integrationInstanceProviderIsOverride: currentVersion.isOverrideToolFilter,
        integrationInstanceGroupProviderToolFilter:
          groupProvider.toolFilter as PrismaJson.ToolFilter | null,
        integrationInstanceGroupProviderIsOverride: groupProvider.isOverrideToolFilter
      });

      let data = {
        status: 'active' as const,
        toolFilter,
        sessionTemplateOid: sessionTemplate.oid,
        providerOid: sourceProvider.integrationProvider.providerOid,
        deploymentOid: currentVersion.integrationProviderVersion.deploymentOid,
        configOid: currentVersion.configOid!,
        authConfigOid: currentVersion.authConfigOid,
        integrationInstanceProviderOid: sourceProvider.oid,
        integrationInstanceGroupProviderOid: groupProvider.oid,
        tenantOid: sessionTemplate.tenantOid,
        solutionOid: sessionTemplate.solutionOid,
        environmentOid: sessionTemplate.environmentOid
      };

      if (existing) {
        await db.sessionTemplateProvider.update({
          where: { oid: existing.oid },
          data
        });
      } else {
        let created = await db.sessionTemplateProvider.create({
          data: {
            ...getId('sessionTemplateProvider'),
            ...data
          },
          select: { id: true }
        });
        createdSessionTemplateProviderIds.push(created.id);
      }
    }

    await db.sessionTemplateProvider.updateMany({
      where: {
        sessionTemplateOid: sessionTemplate.oid,
        status: 'active',
        OR: [
          { integrationInstanceGroupProviderOid: null },
          {
            integrationInstanceGroupProviderOid: {
              notIn: Array.from(materialProviderOids).map(oid => BigInt(oid))
            }
          }
        ]
      },
      data: { status: 'archived' }
    });

    return createdSessionTemplateProviderIds;
  });

  if (createdSessionTemplateProviderIds.length) {
    await sessionTemplateProviderCreatedQueue.addMany(
      createdSessionTemplateProviderIds.map(sessionTemplateProviderId => ({
        sessionTemplateProviderId
      }))
    );
  }

  await sessionTemplateSyncHashQueue.add({
    sessionTemplateId: sessionTemplate.id
  });
};

export let syncIntegrationInstanceGroupSessionTemplateQueueProcessor =
  syncIntegrationInstanceGroupSessionTemplateQueue.process(
    syncIntegrationInstanceGroupSessionTemplate
  );

export let archiveIntegrationInstanceGroupSessionTemplatesQueue = createQueue<{
  integrationInstanceGroupId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedIntegrationInstanceGroupTemplate/archiveMany',
  redisUrl: env.service.REDIS_URL
});

export let archiveIntegrationInstanceGroupSessionTemplatesQueueProcessor =
  archiveIntegrationInstanceGroupSessionTemplatesQueue.process(async data => {
    let integrationInstanceGroup = await db.integrationInstanceGroup.findUnique({
      where: { id: data.integrationInstanceGroupId }
    });
    if (!integrationInstanceGroup || integrationInstanceGroup.status !== 'archived') {
      return;
    }

    let sessionTemplates = await db.sessionTemplate.findMany({
      where: {
        integrationInstanceGroupOid: integrationInstanceGroup.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessionTemplates.length === 0) return;

    await archiveIntegrationInstanceGroupSessionTemplateQueue.addMany(
      sessionTemplates.map(sessionTemplate => ({
        sessionTemplateId: sessionTemplate.id
      }))
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await archiveIntegrationInstanceGroupSessionTemplatesQueue.add({
      integrationInstanceGroupId: data.integrationInstanceGroupId,
      cursor: lastSessionTemplate.id
    });
  });

export let archiveIntegrationInstanceGroupSessionTemplateQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/linkedIntegrationInstanceGroupTemplate/archive',
  redisUrl: env.service.REDIS_URL
});

export let archiveIntegrationInstanceGroupSessionTemplateQueueProcessor =
  archiveIntegrationInstanceGroupSessionTemplateQueue.process(async data => {
    let sessionTemplate = await db.sessionTemplate.findUnique({
      where: { id: data.sessionTemplateId },
      include: { integrationInstanceGroup: true }
    });
    let integrationInstanceGroup = sessionTemplate?.integrationInstanceGroup;
    if (
      !sessionTemplate ||
      !integrationInstanceGroup ||
      !sessionTemplate.integrationInstanceGroupOid ||
      sessionTemplate.status !== 'active' ||
      integrationInstanceGroup.status !== 'archived'
    ) {
      return;
    }

    let archivedAt = integrationInstanceGroup.archivedAt ?? new Date();

    await withTransaction(async db => {
      await db.sessionTemplateProvider.updateMany({
        where: { sessionTemplateOid: sessionTemplate.oid },
        data: { status: 'archived' }
      });

      await db.sessionTemplate.update({
        where: { oid: sessionTemplate.oid },
        data: {
          status: 'archived',
          archivedAt
        }
      });
    });

    await sessionTemplateArchivedQueue.add({
      sessionTemplateId: sessionTemplate.id
    });
  });
