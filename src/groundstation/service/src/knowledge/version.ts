import { db } from '../db';
import { tryRedis } from '../sessions/redis';

export let knowledgeVersionKey = 'gs:knowledge:version';

export let currentSnapshot = () =>
  db.knowledgeSnapshot.findFirst({
    where: { status: 'current' },
    orderBy: { generatedAt: 'desc' }
  });

export let publishKnowledgeVersion = async (snapshotId: string) => {
  await tryRedis(redis => redis.set(knowledgeVersionKey, snapshotId));
};

export let readPublishedVersion = async () =>
  await tryRedis(async redis => ({ version: await redis.get(knowledgeVersionKey) }));
