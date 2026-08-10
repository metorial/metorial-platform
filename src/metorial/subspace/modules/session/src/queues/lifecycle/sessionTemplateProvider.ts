import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import { queueJobId, withSessionTemplateSyncLock } from '../../lib/sessionTemplateSync';
import { enqueueSessionTemplateInvalidateRuntime } from './sessionTemplate';

export let sessionTemplateProviderCreatedQueue = createQueue<{
  sessionTemplateProviderId: string;
}>({
  name: 'sub/ses/lc/sessionTemplateProvider/created',
  redisUrl: env.service.REDIS_URL
});

export let enqueueSessionTemplateProviderCreated = async (
  sessionTemplateProviderId: string
) => {
  await sessionTemplateProviderCreatedQueue.add(
    { sessionTemplateProviderId },
    { id: queueJobId('stpc', sessionTemplateProviderId) }
  );
};

export let enqueueSessionTemplateProvidersCreated = async (
  sessionTemplateProviderIds: string[]
) => {
  if (!sessionTemplateProviderIds.length) return;

  await sessionTemplateProviderCreatedQueue.addManyWithOps(
    sessionTemplateProviderIds.map(sessionTemplateProviderId => ({
      data: { sessionTemplateProviderId },
      opts: { id: queueJobId('stpc', sessionTemplateProviderId) }
    }))
  );
};

export let sessionTemplateProviderCreatedQueueProcessor =
  sessionTemplateProviderCreatedQueue.process(async data => {
    let sessionTemplateProvider = await db.sessionTemplateProvider.findUniqueOrThrow({
      where: { id: data.sessionTemplateProviderId }
    });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: sessionTemplateProvider.tenantOid,
          solutionOid: sessionTemplateProvider.solutionOid,
          environmentOid: sessionTemplateProvider.environmentOid,
          providerOid: sessionTemplateProvider.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: sessionTemplateProvider.tenantOid,
        solutionOid: sessionTemplateProvider.solutionOid,
        environmentOid: sessionTemplateProvider.environmentOid,
        providerOid: sessionTemplateProvider.providerOid,
        sessionTemplates: 1,
        firstSessionTemplateAt: new Date(),
        lastSessionTemplateAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        sessionTemplates: { increment: 1 },
        lastSessionTemplateAt: new Date(),
        lastUseAt: new Date()
      }
    });
  });

export let sessionTemplateSyncHashQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/sessionTemplate/syncHash',
  redisUrl: env.service.REDIS_URL
});

export let enqueueSessionTemplateSyncHash = async (sessionTemplateId: string) => {
  await sessionTemplateSyncHashQueue.add(
    { sessionTemplateId },
    { id: queueJobId('sth', sessionTemplateId) }
  );
};

export let sessionTemplateSyncHashQueueProcessor = sessionTemplateSyncHashQueue.process(
  async data => {
    await withSessionTemplateSyncLock(data.sessionTemplateId, async () => {
      let sessionTemplate = await db.sessionTemplate.findUnique({
        where: { id: data.sessionTemplateId }
      });
      if (!sessionTemplate || sessionTemplate.status !== 'active') {
        return;
      }
      let previousHash = sessionTemplate.hash;

      let providers = await db.sessionTemplateProvider.findMany({
        where: {
          sessionTemplateOid: sessionTemplate.oid,
          status: 'active'
        },
        select: {
          providerOid: true,
          deploymentOid: true,
          configOid: true,
          authConfigOid: true,
          toolFilter: true
        }
      });

      let hash = await Hash.sha256(
        canonicalize([
          sessionTemplate.oid.toString(),
          sessionTemplate.status,
          sessionTemplate.integrationInstanceGroupOid?.toString() ?? null,
          sessionTemplate.integrationInstanceOid?.toString() ?? null,
          sessionTemplate.identityActorOid?.toString() ?? null,
          sessionTemplate.identityOid?.toString() ?? null,
          providers
            .map(provider => ({
              providerOid: provider.providerOid.toString(),
              deploymentOid: provider.deploymentOid.toString(),
              configOid: provider.configOid.toString(),
              authConfigOid: provider.authConfigOid?.toString() ?? null,
              toolFilter: provider.toolFilter
            }))
            .map(p => canonicalize(p))
            .sort()
        ])
      );

      await db.sessionTemplate.update({
        where: { oid: sessionTemplate.oid },
        data: { hash }
      });

      if (previousHash !== hash) {
        await enqueueSessionTemplateInvalidateRuntime({
          sessionTemplateId: sessionTemplate.id
        });
      }
    });
  }
);
