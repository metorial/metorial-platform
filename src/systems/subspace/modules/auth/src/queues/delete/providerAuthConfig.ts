import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerAuthConfigDeletedQueue } from '../lifecycle/providerAuthConfig';
import { getCutoffDate } from './_config';

export let providerAuthConfigArchivedCleanupCron = createCron(
  {
    name: 'sub/auth/cron/providerAuthConfigArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await providerAuthConfigDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let providerAuthConfigDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/auth/delete/providerAuthConfig/many',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigDeleteManyQueueProcessor = providerAuthConfigDeleteManyQueue.process(
  async data => {
    let authConfigs = await db.providerAuthConfig.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (authConfigs.length === 0) return;

    await providerAuthConfigDeleteQueue.addMany(
      authConfigs.map(authConfig => ({ providerAuthConfigId: authConfig.id }))
    );

    await providerAuthConfigDeleteManyQueue.add({
      cursor: authConfigs[authConfigs.length - 1].id
    });
  }
);

export let providerAuthConfigDeleteQueue = createQueue<{ providerAuthConfigId: string }>({
  name: 'sub/auth/delete/providerAuthConfig',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigDeleteQueueProcessor = providerAuthConfigDeleteQueue.process(
  async data => {
    let authConfig = await db.providerAuthConfig.findUnique({
      where: { id: data.providerAuthConfigId }
    });
    if (!authConfig || authConfig.status !== 'archived') return;

    await db.sessionProvider.updateMany({
      where: { authConfigOid: authConfig.oid },
      data: { status: 'deleted', isParentDeleted: true }
    });

    await db.sessionTemplateProvider.updateMany({
      where: { authConfigOid: authConfig.oid },
      data: { status: 'deleted' }
    });

    await db.providerDeployment.updateMany({
      where: { defaultAuthConfigOid: authConfig.oid },
      data: { defaultAuthConfigOid: null }
    });

    await db.providerAuthConfigVersion.updateMany({
      where: { authConfigOid: authConfig.oid },
      data: {
        slateAuthConfigOid: null,
        shuttleAuthConfigOid: null,
        authCredentialsOid: null
      }
    });

    await db.providerAuthConfig.updateMany({
      where: { oid: authConfig.oid },
      data: {
        status: 'deleted',
        isDefault: false,
        name: '[deleted]',
        description: null,
        metadata: {},
        authCredentialsOid: null
      }
    });

    await providerAuthConfigDeletedQueue.add({
      providerAuthConfigId: authConfig.id
    });
  }
);
