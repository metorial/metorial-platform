import { createQueue } from '@lowerdeck/queue';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { env } from '../../env';
import { sessionTemplateArchivedQueue } from './sessionTemplate';
import { sessionTemplateProviderCreatedQueue } from './sessionTemplateProvider';

let defaultToolFilter = { type: 'v1.allow_all' } satisfies PrismaJson.ToolFilter;

export let syncDelegatedIntegrationInstanceSessionTemplatesQueue = createQueue<{
  delegatedIntegrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedDelegatedIntegrationTemplate/syncMany',
  redisUrl: env.service.REDIS_URL
});

export let syncDelegatedIntegrationInstanceSessionTemplatesQueueProcessor =
  syncDelegatedIntegrationInstanceSessionTemplatesQueue.process(async data => {
    let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.findUnique({
      where: { id: data.delegatedIntegrationInstanceId }
    });
    if (
      !delegatedIntegrationInstance ||
      delegatedIntegrationInstance.status === 'archived' ||
      delegatedIntegrationInstance.status === 'deleted'
    ) {
      return;
    }

    let sessionTemplates = await db.sessionTemplate.findMany({
      where: {
        delegatedIntegrationInstanceOid: delegatedIntegrationInstance.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessionTemplates.length === 0) return;

    await syncDelegatedIntegrationInstanceSessionTemplateQueue.addMany(
      sessionTemplates.map(sessionTemplate => ({
        sessionTemplateId: sessionTemplate.id
      }))
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await syncDelegatedIntegrationInstanceSessionTemplatesQueue.add({
      delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId,
      cursor: lastSessionTemplate.id
    });
  });

export let syncDelegatedIntegrationInstanceSessionTemplateQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/linkedDelegatedIntegrationTemplate/sync',
  redisUrl: env.service.REDIS_URL
});

export let syncDelegatedIntegrationInstanceSessionTemplate = async (data: {
  sessionTemplateId: string;
}) => {
  let sessionTemplate = await db.sessionTemplate.findUnique({
    where: { id: data.sessionTemplateId },
    include: { delegatedIntegrationInstance: true }
  });
  let delegatedIntegrationInstance = sessionTemplate?.delegatedIntegrationInstance;
  if (
    !sessionTemplate ||
    !delegatedIntegrationInstance ||
    !sessionTemplate.delegatedIntegrationInstanceOid ||
    sessionTemplate.status !== 'active' ||
    delegatedIntegrationInstance.status === 'archived' ||
    delegatedIntegrationInstance.status === 'deleted'
  ) {
    return;
  }

  let delegatedProviders = await db.delegatedIntegrationInstanceProvider.findMany({
    where: {
      delegatedIntegrationInstanceOid: sessionTemplate.delegatedIntegrationInstanceOid,
      status: 'active',
      isParentDeleted: false,
      delegatedIntegrationInstanceSource: {
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

  let materialProviders = delegatedProviders.filter(
    delegatedProvider =>
      !!delegatedProvider.integrationInstanceProvider.currentVersion?.configOid
  );
  let materialProviderOids = new Set(
    materialProviders.map(delegatedProvider => delegatedProvider.oid.toString())
  );

  let existingTemplateProviders = await db.sessionTemplateProvider.findMany({
    where: {
      sessionTemplateOid: sessionTemplate.oid,
      status: { not: 'deleted' }
    }
  });
  let existingByDelegatedProviderOid = new Map(
    existingTemplateProviders
      .filter(provider => provider.delegatedIntegrationInstanceProviderOid)
      .map(provider => [provider.delegatedIntegrationInstanceProviderOid!, provider])
  );

  let createdSessionTemplateProviderIds = await withTransaction(async db => {
    let createdSessionTemplateProviderIds: string[] = [];

    for (let delegatedProvider of materialProviders) {
      let sourceProvider = delegatedProvider.integrationInstanceProvider;
      let currentVersion = sourceProvider.currentVersion!;
      let existing = existingByDelegatedProviderOid.get(delegatedProvider.oid);
      let toolFilter =
        (currentVersion.toolFilter as PrismaJson.ToolFilter | null) ??
        (currentVersion.integrationProviderVersion
          .toolFilter as PrismaJson.ToolFilter | null) ??
        defaultToolFilter;

      let data = {
        status: 'active' as const,
        toolFilter,
        sessionTemplateOid: sessionTemplate.oid,
        providerOid: sourceProvider.integrationProvider.providerOid,
        deploymentOid: currentVersion.integrationProviderVersion.deploymentOid,
        configOid: currentVersion.configOid!,
        authConfigOid: currentVersion.authConfigOid,
        integrationInstanceProviderOid: sourceProvider.oid,
        delegatedIntegrationInstanceProviderOid: delegatedProvider.oid,
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
          { delegatedIntegrationInstanceProviderOid: null },
          {
            delegatedIntegrationInstanceProviderOid: {
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
};

export let syncDelegatedIntegrationInstanceSessionTemplateQueueProcessor =
  syncDelegatedIntegrationInstanceSessionTemplateQueue.process(
    syncDelegatedIntegrationInstanceSessionTemplate
  );

export let archiveDelegatedIntegrationInstanceSessionTemplatesQueue = createQueue<{
  delegatedIntegrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/linkedDelegatedIntegrationTemplate/archiveMany',
  redisUrl: env.service.REDIS_URL
});

export let archiveDelegatedIntegrationInstanceSessionTemplatesQueueProcessor =
  archiveDelegatedIntegrationInstanceSessionTemplatesQueue.process(async data => {
    let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.findUnique({
      where: { id: data.delegatedIntegrationInstanceId }
    });
    if (!delegatedIntegrationInstance || delegatedIntegrationInstance.status !== 'archived') {
      return;
    }

    let sessionTemplates = await db.sessionTemplate.findMany({
      where: {
        delegatedIntegrationInstanceOid: delegatedIntegrationInstance.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessionTemplates.length === 0) return;

    await archiveDelegatedIntegrationInstanceSessionTemplateQueue.addMany(
      sessionTemplates.map(sessionTemplate => ({
        sessionTemplateId: sessionTemplate.id
      }))
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await archiveDelegatedIntegrationInstanceSessionTemplatesQueue.add({
      delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId,
      cursor: lastSessionTemplate.id
    });
  });

export let archiveDelegatedIntegrationInstanceSessionTemplateQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/linkedDelegatedIntegrationTemplate/archive',
  redisUrl: env.service.REDIS_URL
});

export let archiveDelegatedIntegrationInstanceSessionTemplateQueueProcessor =
  archiveDelegatedIntegrationInstanceSessionTemplateQueue.process(async data => {
    let sessionTemplate = await db.sessionTemplate.findUnique({
      where: { id: data.sessionTemplateId },
      include: { delegatedIntegrationInstance: true }
    });
    let delegatedIntegrationInstance = sessionTemplate?.delegatedIntegrationInstance;
    if (
      !sessionTemplate ||
      !delegatedIntegrationInstance ||
      !sessionTemplate.delegatedIntegrationInstanceOid ||
      sessionTemplate.status !== 'active' ||
      delegatedIntegrationInstance.status !== 'archived'
    ) {
      return;
    }

    let archivedAt = delegatedIntegrationInstance.archivedAt ?? new Date();

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
