import { createCron } from '@mtsrc/cron';
import { createQueue } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
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

    let lastProviderAuthCredentials = creds[creds.length - 1];
    if (!lastProviderAuthCredentials) return;

    await providerAuthCredentialsDeleteManyQueue.add({
      cursor: lastProviderAuthCredentials.id
    });
  });

export let providerAuthCredentialsDeleteQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/delete/providerAuthCredentials',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsBackendDeleteQueue = createQueue<{
  tenantOid: string;
  backendOid: string;
  slateCredentialsOid?: string | null;
  shuttleCredentialsOid?: string | null;
}>({
  name: 'sub/auth/delete/providerAuthCredentials/backend',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsBackendDeleteQueueProcessor =
  providerAuthCredentialsBackendDeleteQueue.process(async data => {
    let tenant = await db.tenant.findUnique({
      where: { oid: BigInt(data.tenantOid) }
    });
    if (!tenant) return;

    let backend = await getBackend({
      entity: { backendOid: BigInt(data.backendOid) }
    });

    await backend.auth.deleteProviderAuthCredentials({
      tenant,
      backing: {
        slateCredentialsOid: data.slateCredentialsOid ? BigInt(data.slateCredentialsOid) : null,
        shuttleCredentialsOid: data.shuttleCredentialsOid
          ? BigInt(data.shuttleCredentialsOid)
          : null
      }
    });
  });

export let providerAuthCredentialsDeleteQueueProcessor =
  providerAuthCredentialsDeleteQueue.process(async data => {
    let creds = await db.providerAuthCredentials.findUnique({
      where: { id: data.providerAuthCredentialsId },
      include: {
        tenant: true
      }
    });
    if (
      !creds ||
      !creds.tenant ||
      creds.origin !== 'tenant_created' ||
      creds.status !== 'archived'
    ) {
      return;
    }

    await providerAuthCredentialsBackendDeleteQueue.add({
      tenantOid: creds.tenant.oid.toString(),
      backendOid: creds.backendOid.toString(),
      slateCredentialsOid: creds.slateCredentialsOid?.toString() ?? null,
      shuttleCredentialsOid: creds.shuttleCredentialsOid?.toString() ?? null
    });

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
