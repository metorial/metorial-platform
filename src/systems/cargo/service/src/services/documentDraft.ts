import { delay } from '@lowerdeck/delay';
import { generatePlainId } from '@lowerdeck/id';
import { createRedisClient } from '@lowerdeck/redis';
import { Service } from '@lowerdeck/service';
import { env } from '../env';

export type DocumentDraft = {
  documentId: string;
  title: string;
  content: string;
  actorIds: string[];
  revision: number;
  updatedAt: string;
  flushAfter: string;
};

let draftTtlSeconds = 7 * 24 * 60 * 60;
let lockTtlMs = 15000;
let maxLockAttempts = 100;
let lockRetryDelayMs = 25;

let redisFactory = createRedisClient({
  redisUrl: env.service.REDIS_URL
});
let redisClientPromise: Promise<any> | undefined;

let getRedis = async () => {
  redisClientPromise ??= redisFactory.eager();
  return await redisClientPromise;
};

let draftKeys = (documentId: string) => ({
  draft: `cargo:document:draft:${documentId}`,
  lock: `cargo:document:draft:${documentId}:lock`
});

class DocumentDraftServiceImpl {
  async getDraftByDocumentId(documentId: string): Promise<DocumentDraft | null> {
    let redis = await getRedis();
    let raw = await redis.get(draftKeys(documentId).draft);
    if (!raw) return null;
    return JSON.parse(raw) as DocumentDraft;
  }

  async setDraft(draft: DocumentDraft) {
    let redis = await getRedis();
    await redis.set(draftKeys(draft.documentId).draft, JSON.stringify(draft), {
      EX: draftTtlSeconds
    });
  }

  async deleteDraft(documentId: string) {
    let redis = await getRedis();
    await redis.del(draftKeys(documentId).draft);
  }

  async withDocumentLock<T>(documentId: string, cb: () => Promise<T>) {
    let redis = await getRedis();
    let token = generatePlainId(16);
    let keys = draftKeys(documentId);

    for (let attempt = 0; attempt < maxLockAttempts; attempt++) {
      let locked = await redis.set(keys.lock, token, {
        PX: lockTtlMs,
        NX: true
      });
      if (locked === 'OK') {
        try {
          return await cb();
        } finally {
          let currentToken = await redis.get(keys.lock);
          if (currentToken === token) {
            await redis.del(keys.lock);
          }
        }
      }

      await delay(lockRetryDelayMs);
    }

    throw new Error(`Timed out waiting for document draft lock: ${documentId}`);
  }
}

export let documentDraftService = Service.create(
  'cargoDocumentDraftService',
  () => new DocumentDraftServiceImpl()
).build();
