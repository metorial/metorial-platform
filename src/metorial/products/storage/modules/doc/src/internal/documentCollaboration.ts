import { delay } from '@lowerdeck/delay';
import { generatePlainId } from '@lowerdeck/id';
import { createRedisClient } from '@lowerdeck/redis';
import { Service } from '@lowerdeck/service';
import { getConfig } from '@metorial/config';
import { Buffer } from 'node:buffer';
import * as Y from 'yjs';

let collaborationTtlSeconds = 7 * 24 * 60 * 60;
let lockTtlMs = 15000;
let maxLockAttempts = 100;
let lockRetryDelayMs = 25;
let dirtyDocumentsHash = 'cargo:document:collaboration:dirty';
let queuedDocumentsHash = 'cargo:document:collaboration:queued';
let actorDocumentsHash = 'cargo:document:collaboration:actor';

let redisFactory = createRedisClient({
  redisUrl: getConfig().redisUrl
});
let redisClientPromise: Promise<any> | undefined;

let getRedis = async () => {
  redisClientPromise ??= redisFactory.eager();
  return await redisClientPromise;
};

let collaborationKeys = (documentId: string) => ({
  state: `cargo:document:collaboration:${documentId}:state`,
  generation: `cargo:document:collaboration:${documentId}:generation`,
  lock: `cargo:document:collaboration:${documentId}:lock`
});

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

let claimDirtyDocumentScriptSha = getRedis().then(redis =>
  redis.scriptLoad(claimDirtyDocumentScript)
);
let clearDocumentMarkersUpToRevisionScriptSha = getRedis().then(redis =>
  redis.scriptLoad(clearDocumentMarkersUpToRevisionScript)
);

let encodeUpdate = (update: Uint8Array) => Buffer.from(update).toString('base64');
let decodeUpdate = (update: string) => new Uint8Array(Buffer.from(update, 'base64'));

class InternalDocumentCollaborationServiceImpl {
  async withDocumentLock<T>(documentId: string, cb: () => Promise<T>) {
    let redis = await getRedis();
    let token = generatePlainId(16);
    let keys = collaborationKeys(documentId);

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

    throw new Error(`Timed out waiting for document collaboration lock: ${documentId}`);
  }

  async getStateUpdate(documentId: string) {
    let redis = await getRedis();
    let raw = await redis.get(collaborationKeys(documentId).state);
    return typeof raw == 'string' && raw.length > 0 ? raw : null;
  }

  async getGeneration(documentId: string) {
    let redis = await getRedis();
    let raw = await redis.get(collaborationKeys(documentId).generation);
    return raw === null ? 0 : Number(raw);
  }

  async getSnapshot(documentId: string) {
    let [update, generation] = await Promise.all([
      this.getStateUpdate(documentId),
      this.getGeneration(documentId)
    ]);
    return { update, generation };
  }

  async initializeState(d: { documentId: string; update: string; generation?: number }) {
    return await this.withDocumentLock(d.documentId, async () => {
      let redis = await getRedis();
      let keys = collaborationKeys(d.documentId);
      let generation = await this.getGeneration(d.documentId);
      let existing = await redis.get(keys.state);
      if (d.generation !== undefined && d.generation !== generation) {
        return {
          initialized: false,
          stale: true,
          update: typeof existing == 'string' ? existing : null,
          generation
        };
      }
      if (typeof existing == 'string' && existing.length > 0) {
        return {
          initialized: false,
          stale: false,
          update: existing,
          generation
        };
      }

      let doc = new Y.Doc();

      Y.applyUpdate(doc, decodeUpdate(d.update));

      let merged = encodeUpdate(Y.encodeStateAsUpdate(doc));
      await redis.set(keys.state, merged, {
        EX: collaborationTtlSeconds,
        NX: true
      });

      doc.destroy();
      return {
        initialized: true,
        stale: false,
        update: merged,
        generation
      };
    });
  }

  async mergeUpdate(d: {
    documentId: string;
    update: string;
    actorId?: string;
    generation?: number;
  }) {
    return await this.withDocumentLock(d.documentId, async () => {
      let redis = await getRedis();
      let keys = collaborationKeys(d.documentId);
      let generation = await this.getGeneration(d.documentId);
      let existing = await redis.get(keys.state);
      if (d.generation !== undefined && d.generation !== generation) {
        return {
          stale: true,
          update: typeof existing == 'string' ? existing : null,
          generation
        };
      }
      let doc = new Y.Doc();

      if (typeof existing == 'string' && existing.length > 0) {
        Y.applyUpdate(doc, decodeUpdate(existing));
      }

      Y.applyUpdate(doc, decodeUpdate(d.update));

      let merged = encodeUpdate(Y.encodeStateAsUpdate(doc));
      await redis.set(keys.state, merged, {
        EX: collaborationTtlSeconds
      });
      let revision = await redis.hIncrBy(dirtyDocumentsHash, d.documentId, 1);

      if (d.actorId) {
        await redis.hSet(actorDocumentsHash, d.documentId, d.actorId);
      }

      doc.destroy();
      return {
        stale: false,
        update: merged,
        revision: Number(revision),
        generation
      };
    });
  }

  async replaceStateWhileLocked(d: { documentId: string; update: string | null }) {
    let redis = await getRedis();
    let keys = collaborationKeys(d.documentId);

    if (d.update) {
      await redis.set(keys.state, d.update, {
        EX: collaborationTtlSeconds
      });
    } else {
      await redis.del(keys.state);
    }
    let generation = Number(await redis.incr(keys.generation));
    await Promise.all([
      redis.expire(keys.generation, collaborationTtlSeconds),
      redis.hDel(dirtyDocumentsHash, d.documentId),
      redis.hDel(queuedDocumentsHash, d.documentId),
      redis.hDel(actorDocumentsHash, d.documentId)
    ]);

    return { update: d.update, generation };
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

  async getActorId(documentId: string) {
    let redis = await getRedis();
    let actorId = await redis.hGet(actorDocumentsHash, documentId);
    return typeof actorId == 'string' && actorId.length > 0 ? actorId : undefined;
  }

  async clearState(documentId: string) {
    let redis = await getRedis();
    await Promise.all([
      redis.del(collaborationKeys(documentId).state),
      redis.hDel(dirtyDocumentsHash, documentId),
      redis.hDel(queuedDocumentsHash, documentId),
      redis.hDel(actorDocumentsHash, documentId)
    ]);
  }
}

export let internalDocumentCollaborationService = Service.create(
  'cargoInternalDocumentCollaborationService',
  () => new InternalDocumentCollaborationServiceImpl()
).build();
