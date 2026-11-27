import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../../env';
import { providerAuthCredentialsDeletedQueue } from '../lifecycle/providerAuthCredentials';

let providerAuthCredentialsArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/auth/cron/providerAuthCredentialsArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/auth/delete/providerAuthCredentials/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.providerAuthCredentials.findMany({
      where: { origin: 'tenant_created', ...archivedCleanupWhere({ cursor }) },
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids =>
    providerAuthCredentialsDeleteQueue.addMany(
      ids.map(id => ({ providerAuthCredentialsId: id }))
    )
});

export let providerAuthCredentialsArchivedCleanupCron =
  providerAuthCredentialsArchivedCleanup.cron;
export let providerAuthCredentialsDeleteManyQueue =
  providerAuthCredentialsArchivedCleanup.manyQueue;
export let providerAuthCredentialsDeleteManyQueueProcessor =
  providerAuthCredentialsArchivedCleanup.manyProcessor;

export let providerAuthCredentialsDeleteQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/delete/providerAuthCredentials',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
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
        slateCredentialsOid: data.slateCredentialsOid
          ? BigInt(data.slateCredentialsOid)
          : null,
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
