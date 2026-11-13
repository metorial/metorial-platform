import type { KnowledgeSnapshot } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { createVersionKey, redisKey } from '@mtsrc/agent-tracking-redis';

let versionKey = createVersionKey(redisKey('knowledge', 'version'));

export let knowledgeVersionKey = versionKey.key;

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
  await versionKey.publish(knowledgeVersionOf(snapshot));
};

export let readPublishedVersion = () => versionKey.read();
