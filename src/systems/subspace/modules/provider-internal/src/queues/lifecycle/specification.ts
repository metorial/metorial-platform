import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

export let specificationCreatedQueue = createQueue<{ specificationId: string }>({
  name: 'sub/pint/lc/specification/created',
  redisUrl: env.service.REDIS_URL
});

export let specificationCreatedQueueProcessor = specificationCreatedQueue.process(
  async data => {
    let spec = await db.providerSpecification.findUnique({
      where: { id: data.specificationId },
      include: {
        providerAuthMethods: { select: { oid: true, globalOid: true } },
        providerTools: { select: { oid: true, globalOid: true } },
        providerTriggers: { select: { oid: true, globalOid: true } }
      }
    });
    if (!spec) throw new QueueRetryError();

    await specificationCreatedAssocToolQueue.addMany(
      spec.providerTools.map(t => ({ toolOid: t.oid, globalOid: t.globalOid }))
    );

    await specificationCreatedAssocAuthMethodQueue.addMany(
      spec.providerAuthMethods.map(am => ({
        authMethodOid: am.oid,
        globalOid: am.globalOid
      }))
    );

    await specificationCreatedAssocTriggerQueue.addMany(
      spec.providerTriggers.map(t => ({
        triggerOid: t.oid,
        globalOid: t.globalOid
      }))
    );
  }
);

let specificationCreatedAssocToolQueue = createQueue<{
  toolOid: bigint;
  globalOid: bigint;
}>({
  name: 'sub/pint/lc/specification/created/assoc-tool',
  redisUrl: env.service.REDIS_URL
});

export let specificationCreatedAssocToolQueueProcessor =
  specificationCreatedAssocToolQueue.process(async data => {
    await db.providerToolGlobal.updateMany({
      where: { oid: data.globalOid },
      data: { currentInstanceOid: data.toolOid }
    });
  });

let specificationCreatedAssocAuthMethodQueue = createQueue<{
  authMethodOid: bigint;
  globalOid: bigint;
}>({
  name: 'sub/pint/lc/specification/created/assoc-auth-method',
  redisUrl: env.service.REDIS_URL
});

export let specificationCreatedAssocAuthMethodQueueProcessor =
  specificationCreatedAssocAuthMethodQueue.process(async data => {
    await db.providerAuthMethodGlobal.updateMany({
      where: { oid: data.globalOid },
      data: { currentInstanceOid: data.authMethodOid }
    });
  });

let specificationCreatedAssocTriggerQueue = createQueue<{
  triggerOid: bigint;
  globalOid: bigint;
}>({
  name: 'sub/pint/lc/specification/created/assoc-trigger',
  redisUrl: env.service.REDIS_URL
});

export let specificationCreatedAssocTriggerQueueProcessor =
  specificationCreatedAssocTriggerQueue.process(async data => {
    await db.providerTriggerGlobal.updateMany({
      where: { oid: data.globalOid },
      data: { currentInstanceOid: data.triggerOid }
    });
  });
