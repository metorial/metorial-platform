import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerConfigDeletedQueue } from '../lifecycle/providerConfig';
import { getCutoffDate } from './_config';

export let providerConfigArchivedCleanupCron = createCron(
  {
    name: 'sub/dep/cron/providerConfigArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await providerConfigDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let providerConfigDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/dep/delete/providerConfig/many',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigDeleteManyQueueProcessor = providerConfigDeleteManyQueue.process(
  async data => {
    let providerConfigs = await db.providerConfig.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providerConfigs.length === 0) return;

    await providerConfigDeleteQueue.addMany(
      providerConfigs.map(providerConfig => ({ providerConfigId: providerConfig.id }))
    );

    await providerConfigDeleteManyQueue.add({
      cursor: providerConfigs[providerConfigs.length - 1].id
    });
  }
);

export let providerConfigDeleteQueue = createQueue<{
  providerConfigId: string;
  skipVaultCleanup?: boolean;
}>({
  name: 'sub/dep/delete/providerConfig',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigDeleteQueueProcessor = providerConfigDeleteQueue.process(
  async data => {
    let providerConfig = await db.providerConfig.findUnique({
      where: { id: data.providerConfigId },
      include: {
        currentVersion: true,
        vault: true
      }
    });
    if (!providerConfig || providerConfig.status !== 'archived') return;

    let relatedConfigs = [
      { oid: providerConfig.oid, id: providerConfig.id },
      ...(await db.providerConfig.findMany({
        where: { parentConfigOid: providerConfig.oid },
        select: { oid: true, id: true }
      }))
    ];
    let relatedConfigOids = relatedConfigs.map(config => config.oid);

    await db.sessionProvider.updateMany({
      where: { configOid: { in: relatedConfigOids } },
      data: { status: 'deleted', isParentDeleted: true }
    });

    await db.sessionTemplateProvider.updateMany({
      where: { configOid: { in: relatedConfigOids } },
      data: { status: 'deleted' }
    });

    await db.providerDeployment.updateMany({
      where: { defaultConfigOid: { in: relatedConfigOids } },
      data: { defaultConfigOid: null }
    });

    await db.providerConfigVersion.updateMany({
      where: { configOid: { in: relatedConfigOids } },
      data: {
        slateInstanceOid: null,
        shuttleConfigOid: null
      }
    });

    await db.providerConfig.updateMany({
      where: { oid: { in: relatedConfigOids } },
      data: {
        status: 'deleted',
        isDefault: false,
        name: '[deleted]',
        description: null,
        metadata: {}
      }
    });

    await Promise.all(
      relatedConfigs.map(config =>
        providerConfigDeletedQueue.add({ providerConfigId: config.id })
      )
    );
  }
);
