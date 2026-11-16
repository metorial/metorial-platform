import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import { KnowledgeFingerprintMovedError, pollKnowledge, syncKnowledge } from '../lib/ingest';
import { currentSnapshot } from '../lib/version';

let changeRetentionDays = 400;
let pruneBatchSize = 5000;
let dayMs = 24 * 60 * 60 * 1000;

export let knowledgeSyncEnabled = () => env.knowledge.pollMinutes > 0;

export let knowledgeIngestQueue = createQueue<{ fingerprint?: string }>({
  name: 'at/knowledge/ingest',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let knowledgeIngestProcessor = knowledgeIngestQueue.process(async () => {
  try {
    let result = await syncKnowledge();
    console.log(
      '[agent-tracking] model knowledge sync',
      result.status,
      result.snapshotId ?? ''
    );
  } catch (error) {
    if (error instanceof KnowledgeFingerprintMovedError) throw new QueueRetryError();
    throw error;
  }
});

export let queueKnowledgeIngest = async (fingerprint?: string) => {
  await knowledgeIngestQueue.add(
    { fingerprint },
    { id: `knowledge-ingest-${fingerprint ?? 'boot'}` }
  );
};

let knowledgePollCron = createCron(
  {
    name: 'at/knowledge/poll/cron',
    cron: `*/${Math.max(1, env.knowledge.pollMinutes)} * * * *`,
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 30_000
  },
  async () => {
    let result = await pollKnowledge();
    if (result.changed) await queueKnowledgeIngest(result.fingerprint);
  }
);

export let pruneKnowledgeChanges = async (d: { now?: Date } = {}) => {
  let cutoff = new Date((d.now ?? new Date()).getTime() - changeRetentionDays * dayMs);
  let deleted = 0;

  for (;;) {
    let count = await db.$executeRawUnsafe(
      `DELETE FROM "KnowledgeChange" WHERE oid IN (
         SELECT oid FROM "KnowledgeChange" WHERE "createdAt" < $1 LIMIT ${pruneBatchSize}
       )`,
      cutoff
    );

    deleted += count;
    if (count < pruneBatchSize) return { deleted };
  }
};

let knowledgePruneCron = createCron(
  {
    name: 'at/knowledge/prune/cron',
    cron: '45 3 * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 60_000
  },
  async () => {
    await pruneKnowledgeChanges();
  }
);

export let onKnowledgeWorkerStart = async () => {
  if (!knowledgeSyncEnabled()) return;
  if (await currentSnapshot()) return;

  await queueKnowledgeIngest();
};

export let knowledgeSyncProcessor = combineQueueProcessors([
  knowledgeIngestProcessor,
  knowledgePruneCron,
  ...(knowledgeSyncEnabled() ? [knowledgePollCron] : [])
]);
