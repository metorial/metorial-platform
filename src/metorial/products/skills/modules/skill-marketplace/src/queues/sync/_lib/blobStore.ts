import { hashBytes } from '@lowerdeck/hash/content';
import { withTransaction } from '@metorial/db';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import PQueue from 'p-queue';

let putConcurrency = 8;
let rowChunkSize = 500;

export let skillSyncBlobKeyPrefix = 'skill-sync/blobs/sha256/';
export let skillSyncBlobContentType = 'application/octet-stream';

export type SkillSyncBlobRef = {
  key: string;
  sha256: string;
  gitBlobSha: string;
  crc32: number;
  byteSize: number;
};

export let getSkillSyncBlobKey = (sha256: string) => `${skillSyncBlobKeyPrefix}${sha256}`;

export let isObjectMissingError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  (error as { statusCode?: unknown }).statusCode === 404;

let chunk = <T>(items: T[], size: number) => {
  let chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

// Blob and manifest writers and the garbage collectors serialize on these locks. Keys are locked
// in one sorted order so overlapping sets can't deadlock. Only meaningful inside a transaction;
// the locks are released when the outermost one ends.
export let lockSkillSyncObjects = async (keys: string[]) =>
  await withTransaction(async db => {
    let sorted = [...new Set(keys)].sort().map(key => `skill-sync-object:${key}`);

    for (let keysChunk of chunk(sorted, rowChunkSize)) {
      await db.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(t.k, 0))
        FROM unnest(${keysChunk}::text[]) WITH ORDINALITY AS t(k, i)
        ORDER BY t.i
      `;
    }
  });

let upsertSkillSyncBlobRows = async (blobs: SkillSyncBlobRef[]) =>
  await withTransaction(async db => {
    let now = new Date();

    for (let blobsChunk of chunk(blobs, rowChunkSize)) {
      await db.skillSyncBlob.createMany({
        data: blobsChunk.map(blob => ({
          key: blob.key,
          sha256: blob.sha256,
          gitBlobSha: blob.gitBlobSha,
          crc32: BigInt(blob.crc32),
          byteSize: BigInt(blob.byteSize),
          lastReferencedAt: now
        })),
        skipDuplicates: true
      });

      await db.skillSyncBlob.updateMany({
        where: { key: { in: blobsChunk.map(blob => blob.key) } },
        data: { lastReferencedAt: now }
      });
    }
  });

let putBlobObject = async (blob: { key: string; bytes: Uint8Array }) =>
  await getStorage().putObject(
    getCargoFilesBucketName(),
    blob.key,
    blob.bytes,
    skillSyncBlobContentType
  );

let ensureBlobObject = async (blob: { key: string; bytes: Uint8Array }) => {
  let exists = await getStorage()
    .headObject(getCargoFilesBucketName(), blob.key)
    .then(() => true)
    .catch(error => {
      if (isObjectMissingError(error)) return false;
      throw error;
    });
  if (exists) return false;

  await putBlobObject(blob);
  return true;
};

// Content-addressed write protocol for generated content:
// 1. the SkillSyncBlob row is upserted under the key's lock before the object exists, so a crash
//    leaves a tracked, collectable blob rather than an untracked object;
// 2. the object is written;
// 3. the caller's referencing rows are written under the same locks, which also re-create a row
//    garbage collection removed in between;
// 4. after commit, a missing object (deleted between 1 and 3) is written again.
export let putSkillSyncBlobs = async <T>(d: {
  blobs: { bytes: Uint8Array }[];
  reference: (blobs: SkillSyncBlobRef[]) => Promise<T>;
}) => {
  let hashed = d.blobs.map(blob => {
    let hashes = hashBytes(blob.bytes);

    return {
      bytes: blob.bytes,
      ref: {
        key: getSkillSyncBlobKey(hashes.sha256),
        sha256: hashes.sha256,
        gitBlobSha: hashes.gitBlobSha,
        crc32: hashes.crc32,
        byteSize: hashes.size
      } satisfies SkillSyncBlobRef
    };
  });

  let unique = [...new Map(hashed.map(blob => [blob.ref.key, blob])).values()];
  let keys = unique.map(blob => blob.ref.key);
  let refs = hashed.map(blob => blob.ref);

  if (unique.length) {
    await withTransaction(async () => {
      await lockSkillSyncObjects(keys);
      await upsertSkillSyncBlobRows(unique.map(blob => blob.ref));
    });

    let queue = new PQueue({ concurrency: putConcurrency });
    await queue.addAll(
      unique.map(blob => () => putBlobObject({ key: blob.ref.key, bytes: blob.bytes }))
    );
  }

  let result = await withTransaction(async () => {
    if (unique.length) {
      await lockSkillSyncObjects(keys);
      await upsertSkillSyncBlobRows(unique.map(blob => blob.ref));
    }

    return await d.reference(refs);
  });

  let rewritten = 0;
  if (unique.length) {
    let queue = new PQueue({ concurrency: putConcurrency });
    let results = await queue.addAll(
      unique.map(blob => () => ensureBlobObject({ key: blob.ref.key, bytes: blob.bytes }))
    );
    rewritten = results.filter(Boolean).length;
  }

  return { blobs: refs, result, written: unique.length, rewritten };
};
