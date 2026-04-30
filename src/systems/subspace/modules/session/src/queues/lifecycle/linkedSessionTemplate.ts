import { createQueue } from '@lowerdeck/queue';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { buildIntegrationProviderToolFilterChain } from '@metorial-subspace/module-provider-internal';
import { env } from '../../env';
import { sessionTemplateArchivedQueue } from './sessionTemplate';
import { sessionTemplateProviderCreatedQueue } from './sessionTemplateProvider';

export let syncIntegrationInstanceSessionTemplatesQueue = createQueue<{
  integrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedSessionTemplate/syncMany',
  redisUrl: env.service.REDIS_URL
});

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

    await syncIntegrationInstanceSessionTemplateQueue.addMany(
      sessionTemplates.map(sessionTemplate => ({
        sessionTemplateId: sessionTemplate.id
      }))
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await syncIntegrationInstanceSessionTemplatesQueue.add({
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

export let syncIntegrationInstanceSessionTemplateQueueProcessor =
  syncIntegrationInstanceSessionTemplateQueue.process(async data => {
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

    if (createdSessionTemplateProviderIds.length) {
      await sessionTemplateProviderCreatedQueue.addMany(
        createdSessionTemplateProviderIds.map(sessionTemplateProviderId => ({
          sessionTemplateProviderId
        }))
      );
    }
  });

export let archiveIntegrationInstanceSessionTemplatesQueue = createQueue<{
  integrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedSessionTemplate/archiveMany',
  redisUrl: env.service.REDIS_URL
});

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

    await archiveIntegrationInstanceSessionTemplateQueue.addMany(
      sessionTemplates.map(sessionTemplate => ({
        sessionTemplateId: sessionTemplate.id
      }))
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await archiveIntegrationInstanceSessionTemplatesQueue.add({
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

export let archiveIntegrationInstanceSessionTemplateQueueProcessor =
  archiveIntegrationInstanceSessionTemplateQueue.process(async data => {
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

    await sessionTemplateArchivedQueue.add({
      sessionTemplateId: sessionTemplate.id
    });
  });
