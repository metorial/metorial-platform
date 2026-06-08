import { createQueue } from '@lowerdeck/queue';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { buildIntegrationProviderToolFilterChain } from '@metorial-subspace/module-provider-internal';
import { env } from '../../env';
import { queueJobId, withSessionTemplateSyncLock } from '../../lib/sessionTemplateSync';
import { sessionTemplateArchivedQueue } from './sessionTemplate';
import {
  enqueueSessionTemplateProvidersCreated,
  enqueueSessionTemplateSyncHash
} from './sessionTemplateProvider';

export let syncIntegrationInstanceGroupSessionTemplatesQueue = createQueue<{
  integrationInstanceGroupId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedIntegrationInstanceGroupTemplate/syncMany',
  redisUrl: env.service.REDIS_URL
});

export let enqueueSyncIntegrationInstanceGroupSessionTemplates = async (d: {
  integrationInstanceGroupId: string;
  cursor?: string;
}) => {
  await syncIntegrationInstanceGroupSessionTemplatesQueue.add(d, {
    id: queueJobId('iigstm', d.integrationInstanceGroupId, d.cursor ?? 'start')
  });
};

export let enqueueSyncIntegrationInstanceGroupSessionTemplatesMany = async (
  items: {
    integrationInstanceGroupId: string;
    cursor?: string;
  }[]
) => {
  if (!items.length) return;

  await syncIntegrationInstanceGroupSessionTemplatesQueue.addManyWithOps(
    items.map(d => ({
      data: d,
      opts: {
        id: queueJobId('iigstm', d.integrationInstanceGroupId, d.cursor ?? 'start')
      }
    }))
  );
};

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

    await enqueueSyncIntegrationInstanceGroupSessionTemplateMany(
      sessionTemplates.map(sessionTemplate => sessionTemplate.id)
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await enqueueSyncIntegrationInstanceGroupSessionTemplates({
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

export let enqueueSyncIntegrationInstanceGroupSessionTemplate = async (
  sessionTemplateId: string
) => {
  await syncIntegrationInstanceGroupSessionTemplateQueue.add(
    { sessionTemplateId },
    { id: queueJobId('iigst', sessionTemplateId) }
  );
};

export let enqueueSyncIntegrationInstanceGroupSessionTemplateMany = async (
  sessionTemplateIds: string[]
) => {
  if (!sessionTemplateIds.length) return;

  await syncIntegrationInstanceGroupSessionTemplateQueue.addManyWithOps(
    sessionTemplateIds.map(sessionTemplateId => ({
      data: { sessionTemplateId },
      opts: { id: queueJobId('iigst', sessionTemplateId) }
    }))
  );
};

export let syncIntegrationInstanceGroupSessionTemplate = async (data: {
  sessionTemplateId: string;
}) => {
  await withSessionTemplateSyncLock(data.sessionTemplateId, async () => {
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

      await db.sessionTemplate.update({
        where: { oid: sessionTemplate.oid },
        data: {
          identityActorOid: integrationInstanceGroup.identityActorOid ?? null,
          identityOid: integrationInstanceGroup.identityOid ?? null
        }
      });

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

    await enqueueSessionTemplateProvidersCreated(createdSessionTemplateProviderIds);

    await enqueueSessionTemplateSyncHash(sessionTemplate.id);
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

export let enqueueArchiveIntegrationInstanceGroupSessionTemplates = async (d: {
  integrationInstanceGroupId: string;
  cursor?: string;
}) => {
  await archiveIntegrationInstanceGroupSessionTemplatesQueue.add(d, {
    id: queueJobId('iigatm', d.integrationInstanceGroupId, d.cursor ?? 'start')
  });
};

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

    await enqueueArchiveIntegrationInstanceGroupSessionTemplateMany(
      sessionTemplates.map(sessionTemplate => sessionTemplate.id)
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await enqueueArchiveIntegrationInstanceGroupSessionTemplates({
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

export let enqueueArchiveIntegrationInstanceGroupSessionTemplate = async (
  sessionTemplateId: string
) => {
  await archiveIntegrationInstanceGroupSessionTemplateQueue.add(
    { sessionTemplateId },
    { id: queueJobId('iigat', sessionTemplateId) }
  );
};

export let enqueueArchiveIntegrationInstanceGroupSessionTemplateMany = async (
  sessionTemplateIds: string[]
) => {
  if (!sessionTemplateIds.length) return;

  await archiveIntegrationInstanceGroupSessionTemplateQueue.addManyWithOps(
    sessionTemplateIds.map(sessionTemplateId => ({
      data: { sessionTemplateId },
      opts: { id: queueJobId('iigat', sessionTemplateId) }
    }))
  );
};

export let archiveIntegrationInstanceGroupSessionTemplateQueueProcessor =
  archiveIntegrationInstanceGroupSessionTemplateQueue.process(async data => {
    await withSessionTemplateSyncLock(data.sessionTemplateId, async () => {
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

      await sessionTemplateArchivedQueue.add(
        { sessionTemplateId: sessionTemplate.id },
        { id: queueJobId('sta', sessionTemplate.id) }
      );
    });
  });
