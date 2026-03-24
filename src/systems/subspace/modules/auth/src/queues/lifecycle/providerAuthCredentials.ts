import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderAuthCredentialsQueue } from '../search/providerAuthCredentials';

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
