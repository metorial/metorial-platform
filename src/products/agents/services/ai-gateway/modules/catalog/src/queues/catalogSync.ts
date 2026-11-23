import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '@mtsrc/ai-gateway-db';
import { env } from '../env';
import { pollCatalog, syncCatalog } from '../lib/ingest';

let catalogSyncEnabled = () => env.catalog.pollMinutes > 0;

let catalogIngestQueue = createQueue<{ fingerprint?: string }>({
  name: 'aig/catalog/ingest',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let catalogIngestProcessor = catalogIngestQueue.process(async () => {
  let result = await syncCatalog();
  console.log('[ai-gateway] model catalog sync', result.status);
});

export let queueCatalogIngest = async (fingerprint?: string) => {
  await catalogIngestQueue.add(
    { fingerprint },
    { id: `catalog-ingest-${fingerprint ?? 'boot'}` }
  );
};

let catalogPollCron = createCron(
  {
    name: 'aig/catalog/poll/cron',
    cron: `*/${Math.max(1, env.catalog.pollMinutes)} * * * *`,
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 30_000
  },
  async () => {
    let result = await pollCatalog();
    if (result.changed) await queueCatalogIngest(result.fingerprint);
  }
);

export let onCatalogWorkerStart = async () => {
  if (!catalogSyncEnabled()) return;

  let synced = await db.catalogSync.findFirst({
    where: { url: env.catalog.url, lastSyncedAt: { not: null } }
  });
  if (!synced) await queueCatalogIngest();
};

export let catalogQueueProcessor = combineQueueProcessors([
  catalogIngestProcessor,
  ...(catalogSyncEnabled() ? [catalogPollCron] : [])
]);
