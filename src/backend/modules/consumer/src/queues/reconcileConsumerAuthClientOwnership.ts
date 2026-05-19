import { db, ID } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { consumerOAuthClientService } from '../services/consumerOAuth';

let BATCH_SIZE = 100;

export let reconcileConsumerAuthClientOwnershipManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'port/oauth/client/reconcile-ownership/many'
});

export let reconcileConsumerAuthClientOwnershipManyQueueProcessor =
  reconcileConsumerAuthClientOwnershipManyQueue.process(async data => {
    let items = await db.consumerAuthClient.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: {
        id: true
      },
      orderBy: {
        id: 'asc'
      },
      take: BATCH_SIZE
    });

    if (items.length == 0) return;

    await reconcileConsumerAuthClientOwnershipSingleQueue.addMany(
      items.map(item => ({
        consumerAuthClientId: item.id
      }))
    );

    await reconcileConsumerAuthClientOwnershipManyQueue.add({
      cursor: items[items.length - 1]!.id
    });
  });

export let reconcileConsumerAuthClientOwnershipSingleQueue = createQueue<{
  consumerAuthClientId: string;
}>({
  name: 'port/oauth/client/reconcile-ownership/single',
  workerOpts: {
    concurrency: 10
  }
});

let uniqueBigints = (values: (bigint | null | undefined)[]) =>
  Array.from(new Set(values.filter((value): value is bigint => value != null)));

export let reconcileConsumerAuthClientOwnershipSingleQueueProcessor =
  reconcileConsumerAuthClientOwnershipSingleQueue.process(async data => {
    let consumerAuthClient = await db.consumerAuthClient.findUnique({
      where: {
        id: data.consumerAuthClientId
      },
      include: {
        legacyDoNotUseConsumerSurface: true,
        consumerAuthClientConsumerSurfaces: {
          include: {
            consumerClient: true,
            consumerSurface: true
          }
        },
        magicMcpServer: true,
        magicMcpEndpoint: true,
        skillPlugin: true,
        legacyDoNotUseConsumerClient: {
          include: {
            legacyDoNotUseConsumerSurface: true
          }
        }
      }
    });
    if (!consumerAuthClient) return;

    if (consumerAuthClient.legacyDoNotUseConsumerSurface) {
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

    let surfaces = [
      consumerAuthClient.legacyDoNotUseConsumerSurface,
      ...consumerAuthClient.consumerAuthClientConsumerSurfaces.map(ref => ref.consumerSurface)
    ].filter((surface): surface is NonNullable<typeof surface> => !!surface);
    let instanceOids = uniqueBigints([
      consumerAuthClient.instanceOid,
      consumerAuthClient.magicMcpServer?.instanceOid,
      consumerAuthClient.magicMcpEndpoint?.instanceOid,
      consumerAuthClient.skillPlugin?.instanceOid,
      ...surfaces.map(surface => surface.instanceOid)
    ]);
    let organizationOids = uniqueBigints([
      consumerAuthClient.organizationOid,
      consumerAuthClient.skillPlugin?.organizationOid,
      ...surfaces.map(surface => surface.organizationOid)
    ]);

    if (instanceOids.length == 1 && organizationOids.length == 1) {
      await db.consumerAuthClient.update({
        where: {
          oid: consumerAuthClient.oid
        },
        data: {
          instanceOid: instanceOids[0],
          organizationOid: organizationOids[0]
        }
      });
    } else if (instanceOids.length > 1 || organizationOids.length > 1) {
      console.error('Unable to reconcile ConsumerAuthClient ownership', {
        consumerAuthClientId: consumerAuthClient.id,
        instanceOids: instanceOids.map(String),
        organizationOids: organizationOids.map(String)
      });
    }

    for (let ref of consumerAuthClient.consumerAuthClientConsumerSurfaces) {
      await db.consumerClient.updateMany({
        where: {
          oid: ref.consumerClient.oid,
          OR: [{ instanceOid: null }, { organizationOid: null }]
        },
        data: {
          instanceOid: ref.consumerSurface.instanceOid,
          organizationOid: ref.consumerSurface.organizationOid
        }
      });
    }

    if (consumerAuthClient.legacyDoNotUseConsumerClient?.legacyDoNotUseConsumerSurface) {
      await db.consumerClient.updateMany({
        where: {
          oid: consumerAuthClient.legacyDoNotUseConsumerClient.oid,
          OR: [{ instanceOid: null }, { organizationOid: null }]
        },
        data: {
          instanceOid:
            consumerAuthClient.legacyDoNotUseConsumerClient.legacyDoNotUseConsumerSurface
              .instanceOid,
          organizationOid:
            consumerAuthClient.legacyDoNotUseConsumerClient.legacyDoNotUseConsumerSurface
              .organizationOid
        }
      });
    }
  });

void reconcileConsumerAuthClientOwnershipManyQueue.add({});

export let reconcileConsumerAuthClientOwnershipProcessors = combineQueueProcessors([
  reconcileConsumerAuthClientOwnershipManyQueueProcessor,
  reconcileConsumerAuthClientOwnershipSingleQueueProcessor
]);
