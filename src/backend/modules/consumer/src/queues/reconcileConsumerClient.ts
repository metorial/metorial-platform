import { createCron } from '@metorial/cron';
import { db, ID } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { consumerOAuthClientService } from '../services/consumerOAuth';

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
        consumerAuthClientConsumerSurfaces: { none: {} },
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
      include: {
        legacyDoNotUseConsumerSurface: {
          include: {
            portal: true,
            organization: true,
            instance: {
              include: {
                project: true,
                organization: true
              }
            }
          }
        },
        consumerAuthClientConsumerSurfaces: {
          include: {
            consumerClient: true,
            consumerSurface: {
              include: {
                portal: true,
                organization: true,
                instance: {
                  include: {
                    project: true,
                    organization: true
                  }
                }
              }
            }
          }
        },
        legacyDoNotUseConsumerClient: true,
        skillPlugin: true,
        magicMcpServer: true,
        magicMcpEndpoint: true
      }
    });
    if (!consumerAuthClient) {
      return;
    }

    if (
      consumerAuthClient.legacyDoNotUseConsumerSurface &&
      consumerAuthClient.consumerAuthClientConsumerSurfaces.length == 0
    ) {
      let consumerClient =
        consumerAuthClient.legacyDoNotUseConsumerClient ??
        (await consumerOAuthClientService.upsertConsumerClient({
          consumerSurface: consumerAuthClient.legacyDoNotUseConsumerSurface,
          name: consumerAuthClient.name,
          redirectUris: consumerAuthClient.redirectUris
        }));

      await db.consumerAuthClientConsumerSurface.upsert({
        where: {
          consumerSurfaceOid_consumerAuthClientOid: {
            consumerSurfaceOid: consumerAuthClient.legacyDoNotUseConsumerSurface.oid,
            consumerAuthClientOid: consumerAuthClient.oid
          }
        },
        create: {
          id: await ID.generateId('consumerAuthClient'),
          consumerSurfaceOid: consumerAuthClient.legacyDoNotUseConsumerSurface.oid,
          consumerAuthClientOid: consumerAuthClient.oid,
          consumerClientOid: consumerClient.oid
        },
        update: {
          consumerClientOid: consumerClient.oid
        }
      });
    }

    await consumerOAuthClientService.linkConsumerAuthClientToConsumerClient({
      consumerAuthClient: await db.consumerAuthClient.findUniqueOrThrow({
        where: {
          oid: consumerAuthClient.oid
        },
        include: {
          consumerAuthClientConsumerSurfaces: {
            include: {
              consumerClient: true,
              consumerSurface: {
                include: {
                  portal: true,
                  organization: true,
                  instance: {
                    include: {
                      project: true,
                      organization: true
                    }
                  }
                }
              }
            }
          },
          skillPlugin: true,
          magicMcpServer: true,
          magicMcpEndpoint: true
        }
      })
    });
  });

export let reconcileConsumerClientProcessors = combineQueueProcessors([
  reconcileConsumerClientCron,
  reconcileConsumerClientManyQueueProcessor,
  reconcileConsumerClientSingleQueueProcessor
]);
