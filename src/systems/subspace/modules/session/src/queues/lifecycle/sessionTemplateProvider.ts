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
