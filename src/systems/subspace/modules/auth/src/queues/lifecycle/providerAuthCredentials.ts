import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderAuthCredentialsQueue } from '../search/providerAuthCredentials';
import { providerAuthConfigArchivedQueue } from './providerAuthConfig';

export let providerAuthCredentialsCreatedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/lc/providerAuthCredentials/created',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsCreatedQueueProcessor =
  providerAuthCredentialsCreatedQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findUniqueOrThrow({
      where: { id: data.providerAuthCredentialsId }
    });
    let { tenantOid, solutionOid, environmentOid, providerOid, origin } =
      providerAuthCredentials;

    if (origin !== 'managed_public') {
      await indexProviderAuthCredentialsQueue.add({
        providerAuthCredentialsId: data.providerAuthCredentialsId
      });
    }

    if (origin !== 'tenant_created') {
      return;
    }

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: tenantOid!,
          solutionOid: solutionOid!,
          environmentOid: environmentOid!,
          providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: tenantOid!,
        solutionOid: solutionOid!,
        environmentOid: environmentOid!,
        providerOid,
        credentials: 1,
        firstCredentialAt: new Date(),
        lastCredentialAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        credentials: { increment: 1 },
        lastCredentialAt: new Date(),
        lastUseAt: new Date()
      }
    });
  });

export let providerAuthCredentialsUpdatedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/lc/providerAuthCredentials/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsUpdatedQueueProcessor =
  providerAuthCredentialsUpdatedQueue.process(async data => {
    await indexProviderAuthCredentialsQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });
  });

export let providerAuthCredentialsArchivedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/lc/providerAuthCredentials/archived',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsArchivedQueueProcessor =
  providerAuthCredentialsArchivedQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findUnique({
      where: { id: data.providerAuthCredentialsId }
    });
    if (!providerAuthCredentials) return;

    await indexProviderAuthCredentialsQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });

    if (providerAuthCredentials.origin !== 'tenant_created') return;

    await providerAuthCredentialsArchiveAuthConfigsManyQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });
  });

export let providerAuthCredentialsArchiveAuthConfigsManyQueue = createQueue<{
  providerAuthCredentialsId: string;
  cursor?: string;
}>({
  name: 'sub/auth/lc/providerAuthCredentials/archiveAuthConfigsMany',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsArchiveAuthConfigsManyQueueProcessor =
  providerAuthCredentialsArchiveAuthConfigsManyQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findUnique({
      where: { id: data.providerAuthCredentialsId }
    });
    if (!providerAuthCredentials || providerAuthCredentials.origin !== 'tenant_created')
      return;

    let archivedAt = providerAuthCredentials.archivedAt ?? new Date();

    let authConfigs = await db.providerAuthConfig.findMany({
      where: {
        authCredentialsOid: providerAuthCredentials.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (authConfigs.length === 0) return;

    await db.providerAuthConfig.updateMany({
      where: { oid: { in: authConfigs.map(authConfig => authConfig.oid) } },
      data: { status: 'archived', archivedAt, isDefault: false }
    });

    await providerAuthConfigArchivedQueue.addMany(
      authConfigs.map(authConfig => ({
        providerAuthConfigId: authConfig.id
      }))
    );

    await providerAuthCredentialsArchiveAuthConfigsManyQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId,
      cursor: authConfigs[authConfigs.length - 1].id
    });
  });

export let providerAuthCredentialsDeletedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/lc/providerAuthCredentials/deleted',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsDeletedQueueProcessor =
  providerAuthCredentialsDeletedQueue.process(async data => {
    await indexProviderAuthCredentialsQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });
  });
