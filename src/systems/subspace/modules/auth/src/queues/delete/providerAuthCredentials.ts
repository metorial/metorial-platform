import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerAuthCredentialsDeletedQueue } from '../lifecycle/providerAuthCredentials';
import { getCutoffDate } from './_config';

export let providerAuthCredentialsArchivedCleanupCron = createCron(
  {
    name: 'sub/auth/cron/providerAuthCredentialsArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await providerAuthCredentialsDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let providerAuthCredentialsDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/auth/delete/providerAuthCredentials/many',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsDeleteManyQueueProcessor =
  providerAuthCredentialsDeleteManyQueue.process(async data => {
    let creds = await db.providerAuthCredentials.findMany({
      where: {
        origin: 'tenant_created',
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (creds.length === 0) return;

    await providerAuthCredentialsDeleteQueue.addMany(
      creds.map(providerAuthCredentials => ({
        providerAuthCredentialsId: providerAuthCredentials.id
      }))
    );

    await providerAuthCredentialsDeleteManyQueue.add({
      cursor: creds[creds.length - 1].id
    });
  });

export let providerAuthCredentialsDeleteQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/delete/providerAuthCredentials',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsDeleteQueueProcessor =
  providerAuthCredentialsDeleteQueue.process(async data => {
    let creds = await db.providerAuthCredentials.findUnique({
      where: { id: data.providerAuthCredentialsId }
    });
    if (!creds || creds.origin !== 'tenant_created' || creds.status !== 'archived') return;

    await db.providerAuthCredentials.updateMany({
      where: { oid: creds.oid },
      data: {
        status: 'deleted',
        isDefault: false,
        name: '[deleted]',
        description: null,
        metadata: {},
        slateCredentialsOid: null,
        shuttleCredentialsOid: null
      }
    });

    await providerAuthCredentialsDeletedQueue.add({
      providerAuthCredentialsId: creds.id
    });
  });
