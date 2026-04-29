import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { consumerOAuthService } from '../services/consumerOAuth';

let BATCH_SIZE = 100;

export let reconcileConsumerClientCron = createCron(
  {
    name: 'port/oauth/client/reconcile/cron',
    cron: process.env.NODE_ENV === 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await reconcileConsumerClientManyQueue.add({});
  }
);

export let reconcileConsumerClientManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'port/oauth/client/reconcile/many'
});

export let reconcileConsumerClientManyQueueProcessor =
  reconcileConsumerClientManyQueue.process(async data => {
    let items = await db.consumerAuthClient.findMany({
      where: {
        consumerClientOid: null,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: {
        id: true
      },
      take: BATCH_SIZE,
      orderBy: {
        id: 'asc'
      }
    });

    if (items.length === 0) {
      return;
    }

    await reconcileConsumerClientSingleQueue.addMany(
      items.map(item => ({
        consumerAuthClientId: item.id
      }))
    );

    await reconcileConsumerClientManyQueue.add({
      cursor: items[items.length - 1]!.id
    });
  });

export let reconcileConsumerClientSingleQueue = createQueue<{
  consumerAuthClientId: string;
}>({
  name: 'port/oauth/client/reconcile/single',
  workerOpts: {
    concurrency: 10
  }
});

export let reconcileConsumerClientSingleQueueProcessor =
  reconcileConsumerClientSingleQueue.process(async data => {
    let consumerAuthClient = await db.consumerAuthClient.findUnique({
      where: {
        id: data.consumerAuthClientId
      },
      select: {
        oid: true,
        name: true,
        redirectUris: true,
        consumerSurfaceOid: true
      }
    });
    if (!consumerAuthClient) {
      return;
    }

    await consumerOAuthService.linkConsumerAuthClientToConsumerClient({
      consumerAuthClient
    });
  });

export let reconcileConsumerClientProcessors = combineQueueProcessors([
  reconcileConsumerClientCron,
  reconcileConsumerClientManyQueueProcessor,
  reconcileConsumerClientSingleQueueProcessor
]);
