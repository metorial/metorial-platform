import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { identityInternalService } from '@metorial-subspace/module-identity';
import { identityDeletedQueue } from '@metorial-subspace/module-identity/src/queues/lifecycle/identity';
import {
  archiveIntegrationInstanceSessionTemplatesQueue,
  syncIntegrationInstanceSessionTemplatesQueue
} from '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate';
import { syncDelegatedIntegrationInstanceSessionTemplatesQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedDelegatedIntegrationTemplate';
import { env } from '../../env';
import { indexIntegrationInstanceQueue } from '../search/integrationInstance';
import { integrationInstanceProviderSetQueue } from './integrationInstanceProvider';

let syncIntegrationInstanceProviderCredentials = async (integrationInstanceId: string) => {
  let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
    where: {
      integrationInstance: {
        id: integrationInstanceId
      },
      status: {
        not: 'deleted'
      }
    },
    select: {
      id: true
    }
  });
  if (integrationInstanceProviders.length === 0) return;

  await identityInternalService.syncIntegrationInstanceProviderCredentials({
    integrationInstanceProviderIds: integrationInstanceProviders.map(
      integrationInstanceProvider => integrationInstanceProvider.id
    )
  });
};

export let runIntegrationInstanceArchivedEffects = async (d: {
  integrationInstanceId: string;
  integrationInstanceOid: bigint;
  archivedAt: Date;
}) => {
  let archivedIntegrationInstanceProviders = await db.integrationInstanceProvider.findMany({
    where: { integrationInstanceOid: d.integrationInstanceOid, status: 'active' },
    select: { id: true }
  });

  await db.integrationInstanceProvider.updateMany({
    where: { integrationInstanceOid: d.integrationInstanceOid, status: 'active' },
    data: {
      status: 'archived',
      archivedAt: d.archivedAt
    }
  });

  let ownedIdentities = await db.identity.findMany({
    where: {
      ownedByIntegrationInstanceOid: d.integrationInstanceOid,
      status: 'active'
    },
    select: {
      oid: true,
      id: true
    }
  });
  if (ownedIdentities.length) {
    await db.identity.updateMany({
      where: {
        oid: {
          in: ownedIdentities.map(identity => identity.oid)
        }
      },
      data: {
        status: 'archived',
        archivedAt: d.archivedAt,
        needsReconciliation: true
      }
    });

    await identityDeletedQueue.addMany(
      ownedIdentities.map(identity => ({
        identityId: identity.id
      }))
    );
  }

  await indexIntegrationInstanceQueue.add({
    integrationInstanceId: d.integrationInstanceId
  });
  await archiveIntegrationInstanceSessionTemplatesQueue.add({
    integrationInstanceId: d.integrationInstanceId
  });
  if (archivedIntegrationInstanceProviders.length) {
    await integrationInstanceProviderSetQueue.addMany(
      archivedIntegrationInstanceProviders.map(integrationInstanceProvider => ({
        integrationInstanceId: d.integrationInstanceId,
        integrationInstanceProviderId: integrationInstanceProvider.id
      }))
    );
  }
  await integrationInstanceArchiveDelegatedSourcesManyQueue.add({
    integrationInstanceId: d.integrationInstanceId
  });
  await syncIntegrationInstanceProviderCredentials(d.integrationInstanceId);
};

export let integrationInstanceArchiveDelegatedSourcesManyQueue = createQueue<{
  integrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationInstance/archiveDelegatedSourcesMany',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceArchiveDelegatedSourcesManyQueueProcessor =
  integrationInstanceArchiveDelegatedSourcesManyQueue.process(async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (!integrationInstance || integrationInstance.status !== 'archived') return;

    let delegatedSources = await db.delegatedIntegrationInstanceSource.findMany({
      where: {
        integrationInstanceOid: integrationInstance.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      include: { delegatedIntegrationInstance: true }
    });
    if (delegatedSources.length === 0) return;

    let archivedAt = integrationInstance.archivedAt ?? new Date();

    await db.delegatedIntegrationInstanceSource.updateMany({
      where: { oid: { in: delegatedSources.map(source => source.oid) } },
      data: {
        status: 'archived',
        archivedAt
      }
    });
    await db.delegatedIntegrationInstanceProvider.updateMany({
      where: {
        delegatedIntegrationInstanceSourceOid: {
          in: delegatedSources.map(source => source.oid)
        },
        status: 'active'
      },
      data: {
        status: 'archived',
        archivedAt
      }
    });

    await syncDelegatedIntegrationInstanceSessionTemplatesQueue.addMany(
      Array.from(
        new Set(delegatedSources.map(source => source.delegatedIntegrationInstance.id))
      ).map(delegatedIntegrationInstanceId => ({ delegatedIntegrationInstanceId }))
    );

    let lastSource = delegatedSources[delegatedSources.length - 1];
    if (!lastSource) return;

    await integrationInstanceArchiveDelegatedSourcesManyQueue.add({
      integrationInstanceId: data.integrationInstanceId,
      cursor: lastSource.id
    });
  });

export let integrationInstanceCreatedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/created',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceCreatedQueueProcessor = integrationInstanceCreatedQueue.process(
  async data => {
    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
    await syncIntegrationInstanceSessionTemplatesQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
    await syncIntegrationInstanceProviderCredentials(data.integrationInstanceId);
  }
);

export let integrationInstanceUpdatedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/updated',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceUpdatedQueueProcessor = integrationInstanceUpdatedQueue.process(
  async data => {
    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
    await syncIntegrationInstanceSessionTemplatesQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
    await syncIntegrationInstanceProviderCredentials(data.integrationInstanceId);
  }
);

export let integrationInstanceArchivedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/archived',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceArchivedQueueProcessor =
  integrationInstanceArchivedQueue.process(async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (!integrationInstance || integrationInstance.status !== 'archived') return;

    await runIntegrationInstanceArchivedEffects({
      integrationInstanceId: data.integrationInstanceId,
      integrationInstanceOid: integrationInstance.oid,
      archivedAt: integrationInstance.archivedAt ?? new Date()
    });
  });

export let integrationInstanceDeletedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/deleted',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceDeletedQueueProcessor = integrationInstanceDeletedQueue.process(
  async data => {
    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
  }
);
