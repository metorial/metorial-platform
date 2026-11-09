import { hashBytes, type ContentHashes } from '@lowerdeck/hash/content';
import type { File } from '@metorial/db';
import { db } from '@metorial/db';
import { getCargoFilesBucketName, getObjectDigests } from '../storage';

export type ContentHashFile = Pick<
  File,
  | 'oid'
  | 'storeId'
  | 'fileSize'
  | 'contentSha256'
  | 'contentSha256StoreId'
  | 'contentGitBlobSha'
  | 'contentCrc32'
>;

export type FileContentHashes = ContentHashes & {
  pendingContent: Buffer | null;
};

// Hashes are cached per storeId: template syncs rewrite storeId in place, and every content
// change goes through createFile, which assigns a new storeId.
export let hasValidContentHashes = (file: ContentHashFile) =>
  file.contentSha256StoreId === file.storeId &&
  file.contentSha256 !== null &&
  file.contentGitBlobSha !== null &&
  file.contentCrc32 !== null;

export let getCachedContentHashes = (file: ContentHashFile): ContentHashes | null => {
  if (!hasValidContentHashes(file)) return null;

  return {
    sha256: file.contentSha256!,
    gitBlobSha: file.contentGitBlobSha!,
    crc32: Number(file.contentCrc32!),
    size: file.fileSize
  };
};

// The object store streams the object through its hashers, so the bytes never reach this process.
export let hashObjectContent = async (d: {
  bucket: string;
  key: string;
}): Promise<ContentHashes> => {
  let { digests } = await getObjectDigests(d.bucket, d.key);
  if (!digests.git_blob_sha1) {
    throw new Error(`Object storage returned no git blob id for ${d.key}`);
  }

  return {
    sha256: digests.sha256,
    gitBlobSha: digests.git_blob_sha1,
    crc32: digests.crc32,
    size: digests.size
  };
};

// The cached size is File.fileSize, so a hash of differently sized bytes can't be cached.
export let getContentHashColumns = (d: {
  storeId: string;
  size: number;
  hashes: ContentHashes | undefined;
}) =>
  d.hashes && d.hashes.size === d.size
    ? {
        contentSha256: d.hashes.sha256,
        contentSha256StoreId: d.storeId,
        contentGitBlobSha: d.hashes.gitBlobSha,
        contentCrc32: BigInt(d.hashes.crc32)
      }
    : null;

export let persistContentHashes = async (d: {
  file: ContentHashFile;
  hashes: ContentHashes;
}) => {
  let columns = getContentHashColumns({
    storeId: d.file.storeId,
    size: d.file.fileSize,
    hashes: d.hashes
  });
  if (!columns) return false;

  let updated = await db.file.updateMany({
    where: { oid: d.file.oid, storeId: d.file.storeId },
    data: columns
  });

  return updated.count > 0;
};

export let getFileContentHashes = async (d: {
  file: ContentHashFile;
}): Promise<FileContentHashes> => {
  // Pending content isn't at storeId yet, so its hashes describe bytes the object doesn't have.
  let pending = await db.filePendingContent.findUnique({
    where: { fileOid: d.file.oid },
    select: { content: true }
  });
  if (pending) {
    let pendingContent = Buffer.from(pending.content);
    return { ...hashBytes(pendingContent), pendingContent };
  }

  let cached = getCachedContentHashes(d.file);
  if (cached) return { ...cached, pendingContent: null };

  let hashes = await hashObjectContent({
    bucket: getCargoFilesBucketName(),
    key: d.file.storeId
  });
  await persistContentHashes({ file: d.file, hashes });

  return { ...hashes, pendingContent: null };
};
