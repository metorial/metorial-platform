import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';

export let sessionTemplateProviderCreatedQueue = createQueue<{
  sessionTemplateProviderId: string;
}>({
  name: 'sub/ses/lc/sessionTemplateProvider/created',
  redisUrl: env.service.REDIS_URL
});

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

export let syncSessionTemplateHash = async (data: { sessionTemplateId: string }) => {
  let sessionTemplate = await db.sessionTemplate.findUnique({
    where: { id: data.sessionTemplateId }
  });
  if (!sessionTemplate || sessionTemplate.status !== 'active') {
    return;
  }

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
};

export let sessionTemplateSyncHashQueueProcessor =
  sessionTemplateSyncHashQueue.process(syncSessionTemplateHash);
