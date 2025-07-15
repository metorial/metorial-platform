import { createCron } from '@metorial/cron';
import { db, ID } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { OAuthDiscovery } from '../lib/discovery';
import { OAuthUtils } from '../lib/oauthUtils';
import { oauthConfigValidator } from '../types';

let autoDiscoverCron = createCron(
  {
    name: 'oat/a-disc-cron',
    cron: '0 0 * * *'
  },
  async () => {
    await autoDiscoverQueue.add({}, { id: 'init' });
  }
);

let autoDiscoverQueue = createQueue({
  name: 'oat/a-disc'
});

let autoDiscoverQueueProcessor = autoDiscoverQueue.process(async () => {
  let cursor: string | undefined = undefined;

  while (true) {
    let chunk = (await db.providerOAuthDiscoveryDocument.findMany({
      where: {
        id: cursor ? { gt: cursor } : undefined
      },
      take: 100,
      orderBy: { id: 'asc' },
      select: { id: true }
    })) as { id: string }[];
    if (chunk.length === 0) break;

    await autoDiscoverSingleQueue.addManyWithOps(
      chunk.map(doc => ({
        data: { discoveryDocumentId: doc.id },
        opts: { id: doc.id }
      }))
    );

    cursor = chunk[chunk.length - 1].id;
  }
});

let autoDiscoverSingleQueue = createQueue<{ discoveryDocumentId: string }>({
  name: 'oat/a-disc-single',
  workerOpts: { concurrency: 10, limiter: { max: 25, duration: 1000 } }
});

let autoDiscoverSingleQueueProcessor = autoDiscoverSingleQueue.process(async data => {
  let discoveryDocument = await db.providerOAuthDiscoveryDocument.findUnique({
    where: { id: data.discoveryDocumentId }
  });
  if (!discoveryDocument) return;

  let oldConfigHash = discoveryDocument.configHash;

  let doc = await OAuthDiscovery.discover(discoveryDocument.discoveryUrl);
  if (!doc) return;

  let configHash = await OAuthUtils.getConfigHash(doc);
  if (configHash === discoveryDocument.configHash) return;

  let valRes = oauthConfigValidator.validate(doc);
  if (!valRes.success) return;

  await db.providerOAuthDiscoveryDocument.updateMany({
    where: { oid: discoveryDocument.oid },
    data: {
      config: doc as any,
      configHash,
      refreshedAt: new Date(),

      version: { increment: 1 },

      providerName: OAuthUtils.getProviderName(doc),
      providerUrl: OAuthUtils.getProviderUrl(doc)
    }
  });

  await autoDiscoverPropagateQueue.add(
    {
      discoveryDocumentId: discoveryDocument.id,
      discoveryUrl: discoveryDocument.discoveryUrl,
      oldConfigHash
    },
    { id: discoveryDocument.id }
  );
});

let autoDiscoverPropagateQueue = createQueue<{
  discoveryDocumentId: string;
  oldConfigHash: string;
  discoveryUrl: string;
}>({
  name: 'oat/a-disc-prop',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let autoDiscoverPropagateQueueProcessor = autoDiscoverPropagateQueue.process(async data => {
  let cursor: string | undefined = undefined;

  while (true) {
    let chunk = (await db.providerOAuthConnection.findMany({
      where: {
        configHash: data.oldConfigHash,
        discoveryUrl: data.discoveryUrl,
        id: cursor ? { gt: cursor } : undefined
      },
      take: 100,
      orderBy: { id: 'asc' },
      select: { id: true }
    })) as { id: string }[];
    if (chunk.length === 0) break;

    await autoDiscoverPropagateApplyQueue.addManyWithOps(
      chunk.map(conn => ({
        data: {
          discoveryDocumentId: data.discoveryDocumentId,
          connectionId: conn.id
        },
        opts: { id: conn.id }
      }))
    );

    cursor = chunk[chunk.length - 1].id;
  }
});

let autoDiscoverPropagateApplyQueue = createQueue<{
  discoveryDocumentId: string;
  connectionId: string;
}>({
  name: 'oat/a-disc-prop-apply'
});

let autoDiscoverPropagateApplyQueueProcessor = autoDiscoverPropagateApplyQueue.process(
  async data => {
    let discoveryDocument = await db.providerOAuthDiscoveryDocument.findUnique({
      where: { id: data.discoveryDocumentId }
    });
    if (!discoveryDocument) return;

    let connection = await db.providerOAuthConnection.update({
      where: { id: data.connectionId },
      data: {
        config: discoveryDocument.config as any,
        configHash: discoveryDocument.configHash,
        providerName: discoveryDocument.providerName,
        providerUrl: discoveryDocument.providerUrl
      }
    });

    await db.providerOAuthConnectionEvent.create({
      data: {
        id: await ID.generateId('oauthConnectionEvent'),
        event: 'config_auto_updated',
        connectionOid: connection.oid,
        metadata: {
          discoveryDocumentId: discoveryDocument.id
        }
      }
    });
  }
);

export let autoUpdateQueueProcessor = combineQueueProcessors([
  autoDiscoverQueueProcessor,
  autoDiscoverSingleQueueProcessor,
  autoDiscoverPropagateQueueProcessor,
  autoDiscoverPropagateApplyQueueProcessor,
  autoDiscoverCron
]);
