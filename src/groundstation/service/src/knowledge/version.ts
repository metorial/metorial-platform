import type { KnowledgeSnapshot } from '../../prisma/generated/client';
import { db } from '../db';
import { tryRedis } from '../sessions/redis';

export let knowledgeVersionKey = 'gs:knowledge:version';

export let currentSnapshot = () =>
  db.knowledgeSnapshot.findFirst({
    where: { status: 'current' },
    orderBy: { generatedAt: 'desc' }
  });

// A price correction changes knowledge without a new snapshot; it touches the current snapshot's
// `updatedAt`, so the version changes and caches drop their period timelines.
export let knowledgeVersionOf = (snapshot: Pick<KnowledgeSnapshot, 'id' | 'updatedAt'>) =>
  `${snapshot.id}.${snapshot.updatedAt.getTime()}`;

export let publishKnowledgeVersion = async (
  snapshot: Pick<KnowledgeSnapshot, 'id' | 'updatedAt'>
) => {
  await tryRedis(redis => redis.set(knowledgeVersionKey, knowledgeVersionOf(snapshot)));
};

export let readPublishedVersion = async () =>
  await tryRedis(async redis => ({ version: await redis.get(knowledgeVersionKey) }));
