import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { triggerRoutingMatcherServiceInternal } from '../../internal/triggerRoutingMatcherServiceInternal';
import { prepareMatchers } from '../../lib/triggerRoutingMatcherSerialize';

let batchSize = 100;

export let triggerRoutingMatcherResyncQueue = createQueue<{
  authConfigId: string;
  cursor?: string;
}>({
  name: 'shub/trg/mtch/resync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let resyncRoutingMatchers = async (d: { authConfigId: string; cursor?: string }) => {
  let authConfig = await db.slateAuthConfig.findUnique({
    where: { id: d.authConfigId },
    select: { oid: true, tenantOid: true, routingMatchers: true }
  });
  if (!authConfig) return;

  let prepared = await prepareMatchers(authConfig.routingMatchers);
  if (prepared.length === 0) return;

  let instances = await db.triggerRegistrationInstance.findMany({
    where: {
      triggerRegistration: {
        status: { not: 'deleted' },
        authConfigOid: authConfig.oid,
        tenantOid: authConfig.tenantOid
      },
      id: d.cursor ? { gt: d.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    include: { triggerGroup: true }
  });
  if (instances.length === 0) return;

  for (let instance of instances) {
    let invocation = instance.triggerGroup.spec.invocation;
    if (invocation.type !== 'webhook' || invocation.registration.mode !== 'manual') continue;

    await triggerRoutingMatcherServiceInternal.setInstanceMatchers({
      tenantOid: authConfig.tenantOid,
      triggerGroupOid: instance.triggerGroupOid,
      triggerRegistrationInstanceOid: instance.oid,
      matchers: authConfig.routingMatchers
    });
  }

  if (instances.length < batchSize) return;

  await triggerRoutingMatcherResyncQueue.add({
    authConfigId: d.authConfigId,
    cursor: instances[instances.length - 1]!.id
  });
};

export let triggerRoutingMatcherResyncQueueProcessor =
  triggerRoutingMatcherResyncQueue.process(async data => resyncRoutingMatchers(data));
