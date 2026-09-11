import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
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

export let providerAuthConfigDeleteManyQueueProcessor =
  providerAuthConfigDeleteManyQueue.process(async data => {
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

    let lastAuthConfig = authConfigs[authConfigs.length - 1];
    if (!lastAuthConfig) return;

    await providerAuthConfigDeleteManyQueue.add({
      cursor: lastAuthConfig.id
    });
  });

export let providerAuthConfigDeleteQueue = createQueue<{ providerAuthConfigId: string }>({
  name: 'sub/auth/delete/providerAuthConfig',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigBackendDeleteQueue = createQueue<{
  tenantOid: string;
  backendOid: string;
  slateAuthConfigOid?: string | null;
  shuttleAuthConfigOid?: string | null;
}>({
  name: 'sub/auth/delete/providerAuthConfig/backend',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigBackendDeleteQueueProcessor =
  providerAuthConfigBackendDeleteQueue.process(async data => {
    let tenant = await db.tenant.findUnique({
      where: { oid: BigInt(data.tenantOid) }
    });
    if (!tenant) return;

    let backend = await getBackend({
      entity: { backendOid: BigInt(data.backendOid) }
    });

    await backend.auth.deleteProviderAuthConfig({
      tenant,
      backing: {
        slateAuthConfigOid: data.slateAuthConfigOid ? BigInt(data.slateAuthConfigOid) : null,
        shuttleAuthConfigOid: data.shuttleAuthConfigOid
          ? BigInt(data.shuttleAuthConfigOid)
          : null
      }
    });
  });

export let providerAuthConfigDeleteQueueProcessor = providerAuthConfigDeleteQueue.process(
  async data => {
    let authConfig = await db.providerAuthConfig.findUnique({
      where: { id: data.providerAuthConfigId },
      include: {
        tenant: true,
        currentVersion: true
      }
    });
    if (!authConfig || authConfig.status !== 'archived') return;

    await providerAuthConfigBackendDeleteQueue.add({
      tenantOid: authConfig.tenant.oid.toString(),
      backendOid: authConfig.backendOid.toString(),
      slateAuthConfigOid: authConfig.currentVersion?.slateAuthConfigOid?.toString() ?? null,
      shuttleAuthConfigOid: authConfig.currentVersion?.shuttleAuthConfigOid?.toString() ?? null
    });

    await db.sessionProvider.updateMany({
      where: { authConfigOid: authConfig.oid },
      data: { status: 'deleted', isParentDeleted: true }
    });

    await db.sessionTemplateProvider.updateMany({
      where: { authConfigOid: authConfig.oid },
      data: { status: 'deleted' }
    });

    await db.identityCredential.updateMany({
      where: { authConfigOid: authConfig.oid },
      data: { status: 'archived', archivedAt: new Date() }
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
