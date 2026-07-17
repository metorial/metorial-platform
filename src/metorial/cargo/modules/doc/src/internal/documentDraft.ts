import { delay } from '@lowerdeck/delay';
import { generatePlainId } from '@lowerdeck/id';
import { createRedisClient } from '@lowerdeck/redis';
import { Service } from '@lowerdeck/service';
import { getConfig } from '@metorial/config';

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
let dirtyDocumentsHash = 'cargo:document:dirty';
let queuedDocumentsHash = 'cargo:document:queued';

let redisFactory = createRedisClient({
  redisUrl: getConfig().redisUrl
});
let redisClientPromise: Promise<any> | undefined;

let claimDirtyDocumentScript = `
local dirtyRevision = redis.call("HGET", KEYS[1], ARGV[1])
if dirtyRevision then
    redis.call("HDEL", KEYS[1], ARGV[1])
    redis.call("HSET", KEYS[2], ARGV[1], dirtyRevision)
    return dirtyRevision
end

local queuedRevision = redis.call("HGET", KEYS[2], ARGV[1])
return queuedRevision
`;

let clearDocumentMarkersUpToRevisionScript = `
local flushedRevision = tonumber(ARGV[2])

local dirtyRevision = redis.call("HGET", KEYS[1], ARGV[1])
if dirtyRevision and tonumber(dirtyRevision) <= flushedRevision then
    redis.call("HDEL", KEYS[1], ARGV[1])
end

local queuedRevision = redis.call("HGET", KEYS[2], ARGV[1])
if queuedRevision and tonumber(queuedRevision) <= flushedRevision then
    redis.call("HDEL", KEYS[2], ARGV[1])
end

return 1
`;

let getRedis = async () => {
  redisClientPromise ??= redisFactory.eager();
  return await redisClientPromise;
};

let claimDirtyDocumentScriptSha = getRedis().then(redis =>
  redis.scriptLoad(claimDirtyDocumentScript)
);
let clearDocumentMarkersUpToRevisionScriptSha = getRedis().then(redis =>
  redis.scriptLoad(clearDocumentMarkersUpToRevisionScript)
);

let draftKeys = (documentId: string) => ({
  draft: `cargo:document:draft:${documentId}`,
  lock: `cargo:document:draft:${documentId}:lock`
});

class InternalDocumentDraftServiceImpl {
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

  async markDocumentDirty(documentId: string, revision: number) {
    let redis = await getRedis();
    await redis.hSet(dirtyDocumentsHash, documentId, revision.toString());
  }

  async listDirtyDocumentIds() {
    let redis = await getRedis();
    let [dirtyDocumentIds, queuedDocumentIds] = await Promise.all([
      redis.hKeys(dirtyDocumentsHash),
      redis.hKeys(queuedDocumentsHash)
    ]);

    return [...new Set([...dirtyDocumentIds, ...queuedDocumentIds])];
  }

  async claimDirtyDocumentRevision(documentId: string) {
    let redis = await getRedis();
    let result = await redis.evalSha(await claimDirtyDocumentScriptSha, {
      keys: [dirtyDocumentsHash, queuedDocumentsHash],
      arguments: [documentId]
    });

    if (!result) return null;

    return typeof result == 'string' ? parseInt(result, 10) : Number(result);
  }

  async clearDocumentMarkersUpToRevision(documentId: string, revision: number) {
    let redis = await getRedis();
    await redis.evalSha(await clearDocumentMarkersUpToRevisionScriptSha, {
      keys: [dirtyDocumentsHash, queuedDocumentsHash],
      arguments: [documentId, revision.toString()]
    });
  }

  async clearDocumentState(documentId: string) {
    let redis = await getRedis();
    await Promise.all([
      redis.del(draftKeys(documentId).draft),
      redis.hDel(dirtyDocumentsHash, documentId),
      redis.hDel(queuedDocumentsHash, documentId)
    ]);
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

export let internalDocumentDraftService = Service.create(
  'cargoInternalDocumentDraftService',
  () => new InternalDocumentDraftServiceImpl()
).build();
