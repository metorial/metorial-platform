import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';

export let createCredentialsUpdateEventsQueue = createQueue<{
  credentialsOid: bigint;
  cursor?: string;
}>({
  name: 'shub/soat/credUpdEvt/many',
  redisUrl: env.service.REDIS_URL
});

export let createCredentialsUpdateEventsQueueProcessor =
  createCredentialsUpdateEventsQueue.process(async data => {
    let instances = await db.slateInstance.findMany({
      where: {
        authConfigs: {
          some: {
            oauthCredentialsOid: data.credentialsOid
          }
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      take: 100,
      orderBy: { id: 'asc' },
      select: { oid: true, tenantOid: true }
    });

    await createCredentialsUpdateEventQueue.addMany(
      instances.map(i => ({ instanceOid: i.oid, tenantOid: i.tenantOid }))
    );
  });

let createCredentialsUpdateEventQueue = createQueue<{
  instanceOid: bigint;
  tenantOid: bigint;
}>({
  name: 'shub/soat/credUpdEvt',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let createCredentialsUpdateEventQueueProcessor =
  createCredentialsUpdateEventQueue.process(async data => {
    await db.slateInstanceEvent.create({
      data: {
        ...getId('slateInstanceEvent'),
        type: 'slate_auth_credentials_updated',
        instanceOid: data.instanceOid,
        tenantOid: data.tenantOid,
        payload: {}
      }
    });
  });
