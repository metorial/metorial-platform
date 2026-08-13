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

export let syncIntegrationInstanceSessionTemplatesQueue = createQueue<{
  integrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedSessionTemplate/syncMany',
  redisUrl: env.service.REDIS_URL
});

export let enqueueSyncIntegrationInstanceSessionTemplates = async (d: {
  integrationInstanceId: string;
  cursor?: string;
}) => {
  await syncIntegrationInstanceSessionTemplatesQueue.add(d, {
    id: queueJobId('iistm', d.integrationInstanceId, d.cursor ?? 'start')
  });
};

export let enqueueSyncIntegrationInstanceSessionTemplatesMany = async (
  items: {
    integrationInstanceId: string;
    cursor?: string;
  }[]
) => {
  if (!items.length) return;

  await syncIntegrationInstanceSessionTemplatesQueue.addManyWithOps(
    items.map(d => ({
      data: d,
      opts: {
        id: queueJobId('iistm', d.integrationInstanceId, d.cursor ?? 'start')
      }
    }))
  );
};

export let syncIntegrationInstanceSessionTemplatesQueueProcessor =
  syncIntegrationInstanceSessionTemplatesQueue.process(async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (
      !integrationInstance ||
      integrationInstance.status === 'archived' ||
      integrationInstance.status === 'deleted'
    ) {
      return;
    }

    let sessionTemplates = await db.sessionTemplate.findMany({
      where: {
        integrationInstanceOid: integrationInstance.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessionTemplates.length === 0) return;

    await enqueueSyncIntegrationInstanceSessionTemplateMany(
      sessionTemplates.map(sessionTemplate => sessionTemplate.id)
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await enqueueSyncIntegrationInstanceSessionTemplates({
      integrationInstanceId: data.integrationInstanceId,
      cursor: lastSessionTemplate.id
    });
  });

export let syncIntegrationInstanceSessionTemplateQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/linkedSessionTemplate/sync',
  redisUrl: env.service.REDIS_URL
});

export let enqueueSyncIntegrationInstanceSessionTemplate = async (
  sessionTemplateId: string
) => {
  await syncIntegrationInstanceSessionTemplateQueue.add(
    { sessionTemplateId },
    { id: queueJobId('iist', sessionTemplateId) }
  );
};

export let enqueueSyncIntegrationInstanceSessionTemplateMany = async (
  sessionTemplateIds: string[]
) => {
  if (!sessionTemplateIds.length) return;

  await syncIntegrationInstanceSessionTemplateQueue.addManyWithOps(
    sessionTemplateIds.map(sessionTemplateId => ({
      data: { sessionTemplateId },
      opts: { id: queueJobId('iist', sessionTemplateId) }
    }))
  );
};

export let syncIntegrationInstanceSessionTemplateQueueProcessor =
  syncIntegrationInstanceSessionTemplateQueue.process(async data => {
    await withSessionTemplateSyncLock(data.sessionTemplateId, async () => {
      let sessionTemplate = await db.sessionTemplate.findUnique({
        where: { id: data.sessionTemplateId },
        include: { integrationInstance: true }
      });
      let integrationInstance = sessionTemplate?.integrationInstance;
      if (
        !sessionTemplate ||
        !integrationInstance ||
        !sessionTemplate.integrationInstanceOid ||
        sessionTemplate.status !== 'active' ||
        integrationInstance.status === 'archived' ||
        integrationInstance.status === 'deleted'
      ) {
        return;
      }

      let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
        where: {
          integrationInstanceOid: sessionTemplate.integrationInstanceOid,
          status: 'active',
          isParentDeleted: false
        },
        orderBy: { id: 'asc' },
        include: {
          integration: true,
          integrationProvider: true,
          currentVersion: {
            include: {
              integrationProviderVersion: true
            }
          }
        }
      });

      let materialProviders = integrationInstanceProviders.filter(
        integrationInstanceProvider => !!integrationInstanceProvider.currentVersion?.configOid
      );
      let materialProviderOids = new Set(
        materialProviders.map(integrationInstanceProvider =>
          integrationInstanceProvider.oid.toString()
        )
      );

      let existingTemplateProviders = await db.sessionTemplateProvider.findMany({
        where: {
          sessionTemplateOid: sessionTemplate.oid,
          status: { not: 'deleted' }
        }
      });
      let existingByIntegrationInstanceProviderOid = new Map(
        existingTemplateProviders
          .filter(provider => provider.integrationInstanceProviderOid)
          .map(provider => [provider.integrationInstanceProviderOid!, provider])
      );

      let createdSessionTemplateProviderIds = await withTransaction(async db => {
        let createdSessionTemplateProviderIds: string[] = [];

        await db.sessionTemplate.update({
          where: { oid: sessionTemplate.oid },
          data: {
            identityActorOid: integrationInstance.identityActorOid ?? null,
            identityOid: integrationInstance.identityOid ?? null
          }
        });

        for (let integrationInstanceProvider of materialProviders) {
          let currentVersion = integrationInstanceProvider.currentVersion!;
          let existing = existingByIntegrationInstanceProviderOid.get(
            integrationInstanceProvider.oid
          );
          let toolFilter = buildIntegrationProviderToolFilterChain({
            canAttachCustomToolFilters:
              integrationInstanceProvider.integration.canAttachCustomToolFilters,
            canOverrideToolFilters:
              integrationInstanceProvider.integration.canOverrideToolFilters,
            integrationProviderToolFilter: currentVersion.integrationProviderVersion
              .toolFilter as PrismaJson.ToolFilter | null,
            integrationInstanceProviderToolFilter:
              currentVersion.toolFilter as PrismaJson.ToolFilter | null,
            integrationInstanceProviderIsOverride: currentVersion.isOverrideToolFilter
          });

          let data = {
            status: 'active' as const,
            toolFilter,
            sessionTemplateOid: sessionTemplate.oid,
            providerOid: integrationInstanceProvider.integrationProvider.providerOid,
            deploymentOid: currentVersion.integrationProviderVersion.deploymentOid,
            configOid: currentVersion.configOid!,
            authConfigOid: currentVersion.authConfigOid,
            integrationInstanceProviderOid: integrationInstanceProvider.oid,
            tenantOid: sessionTemplate.tenantOid,
            projectOid: sessionTemplate.projectOid,
            solutionOid: sessionTemplate.solutionOid,
            environmentOid: sessionTemplate.environmentOid,
            instanceOid: sessionTemplate.instanceOid
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
              { integrationInstanceProviderOid: null },
              {
                integrationInstanceProviderOid: {
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
  });

export let archiveIntegrationInstanceSessionTemplatesQueue = createQueue<{
  integrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedSessionTemplate/archiveMany',
  redisUrl: env.service.REDIS_URL
});

export let enqueueArchiveIntegrationInstanceSessionTemplates = async (d: {
  integrationInstanceId: string;
  cursor?: string;
}) => {
  await archiveIntegrationInstanceSessionTemplatesQueue.add(d, {
    id: queueJobId('iiatm', d.integrationInstanceId, d.cursor ?? 'start')
  });
};

export let archiveIntegrationInstanceSessionTemplatesQueueProcessor =
  archiveIntegrationInstanceSessionTemplatesQueue.process(async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (!integrationInstance || integrationInstance.status !== 'archived') return;

    let sessionTemplates = await db.sessionTemplate.findMany({
      where: {
        integrationInstanceOid: integrationInstance.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessionTemplates.length === 0) return;

    await enqueueArchiveIntegrationInstanceSessionTemplateMany(
      sessionTemplates.map(sessionTemplate => sessionTemplate.id)
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await enqueueArchiveIntegrationInstanceSessionTemplates({
      integrationInstanceId: data.integrationInstanceId,
      cursor: lastSessionTemplate.id
    });
  });

export let archiveIntegrationInstanceSessionTemplateQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/linkedSessionTemplate/archive',
  redisUrl: env.service.REDIS_URL
});

export let enqueueArchiveIntegrationInstanceSessionTemplate = async (
  sessionTemplateId: string
) => {
  await archiveIntegrationInstanceSessionTemplateQueue.add(
    { sessionTemplateId },
    { id: queueJobId('iiat', sessionTemplateId) }
  );
};

export let enqueueArchiveIntegrationInstanceSessionTemplateMany = async (
  sessionTemplateIds: string[]
) => {
  if (!sessionTemplateIds.length) return;

  await archiveIntegrationInstanceSessionTemplateQueue.addManyWithOps(
    sessionTemplateIds.map(sessionTemplateId => ({
      data: { sessionTemplateId },
      opts: { id: queueJobId('iiat', sessionTemplateId) }
    }))
  );
};

export let archiveIntegrationInstanceSessionTemplateQueueProcessor =
  archiveIntegrationInstanceSessionTemplateQueue.process(async data => {
    await withSessionTemplateSyncLock(data.sessionTemplateId, async () => {
      let sessionTemplate = await db.sessionTemplate.findUnique({
        where: { id: data.sessionTemplateId },
        include: { integrationInstance: true }
      });
      let integrationInstance = sessionTemplate?.integrationInstance;
      if (
        !sessionTemplate ||
        !integrationInstance ||
        !sessionTemplate.integrationInstanceOid ||
        sessionTemplate.status !== 'active' ||
        integrationInstance.status !== 'archived'
      ) {
        return;
      }

      let archivedAt = integrationInstance.archivedAt ?? new Date();

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
