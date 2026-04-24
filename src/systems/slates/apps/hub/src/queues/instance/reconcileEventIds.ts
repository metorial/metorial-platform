import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { ID } from '../../id';

let BATCH_SIZE = 100;

export let reconcileEventIdsQueue = createQueue<{}>({
  name: 'shub/sin/reconcileEvtIds',
  redisUrl: env.service.REDIS_URL
});

export let reconcileEventIdsQueueProcessor = reconcileEventIdsQueue.process(async () => {
  let didWork = false;

  let authConfigEvents = await db.slateAuthConfigEvent.findMany({
    where: { id: null },
    take: BATCH_SIZE,
    orderBy: { oid: 'asc' }
  });

  if (authConfigEvents.length > 0) {
    didWork = true;
    for (let event of authConfigEvents) {
      await db.slateAuthConfigEvent.updateMany({
        where: { oid: event.oid, id: null },
        data: { id: ID.generateIdSync('slateAuthConfigEvent') }
      });
    }
  }

  let oauthSetupEvents = await db.slateInstanceOAuthSetupEvent.findMany({
    where: { id: null },
    take: BATCH_SIZE,
    orderBy: { oid: 'asc' }
  });

  if (oauthSetupEvents.length > 0) {
    didWork = true;
    for (let event of oauthSetupEvents) {
      await db.slateInstanceOAuthSetupEvent.updateMany({
        where: { oid: event.oid, id: null },
        data: { id: ID.generateIdSync('slateInstanceOAuthSetupEvent') }
      });
    }
  }

  if (didWork) await reconcileEventIdsQueue.add({});
});
