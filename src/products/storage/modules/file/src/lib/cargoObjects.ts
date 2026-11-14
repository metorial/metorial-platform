import { withTransaction } from '@metorial/db';
import { createHash } from 'node:crypto';
import { ObjectStorageError } from 'object-storage-client';
import { getCargoFilesBucketName, getStorage } from '../storage';

let contentAddressedKeyPrefix = 'sha256/';
let contentAddressedContentType = 'application/octet-stream';

export let getContentAddressedKey = (sha256: string) =>
  `${contentAddressedKeyPrefix}${sha256}`;

export let isContentAddressedKey = (key: string) => key.startsWith(contentAddressedKeyPrefix);

export let isObjectMissingError = (error: unknown) =>
  error instanceof ObjectStorageError && error.statusCode === 404;

// Writers of a content-addressed File row and deleters of its object serialize on this lock, so a
// delete either sees the committed row or finishes before the writer re-checks the object.
// Only meaningful inside a transaction; the lock is released when the outermost one ends.
export let lockCargoObject = async (key: string) =>
  await withTransaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cargo-object:${key}`}, 0))`;
  });

// Content-addressed objects are shared by every File with the same bytes, so they carry no
// per-file metadata and their bytes must match their key.
export let putCargoObject = async (d: {
  key: string;
  content: Uint8Array;
  contentType?: string;
}) => {
  if (!isContentAddressedKey(d.key)) {
    return await getStorage().putObject(
      getCargoFilesBucketName(),
      d.key,
      d.content,
      d.contentType
    );
  }

  let key = getContentAddressedKey(createHash('sha256').update(d.content).digest('hex'));
  if (key !== d.key) {
    throw new Error(`Refusing to write content that does not match ${d.key}`);
  }

  return await getStorage().putObject(
    getCargoFilesBucketName(),
    d.key,
    d.content,
    contentAddressedContentType
  );
};

export let ensureCargoObject = async (d: { key: string; content: Uint8Array }) => {
  let exists = await getStorage()
    .headObject(getCargoFilesBucketName(), d.key)
    .then(() => true)
    .catch(error => {
      if (isObjectMissingError(error)) return false;
      return null;
    });
  if (exists) return false;

  await putCargoObject(d);

  return true;
};

export let deleteCargoObjectIfUnreferenced = async (d: { bucket: string; key: string }) => {
  if (!d.key) return false;

  return await withTransaction(async db => {
    await lockCargoObject(d.key);

    let referencingFile = await db.file.findFirst({
      where: { storeId: d.key, status: 'active' },
      select: { oid: true }
    });
    if (referencingFile) return false;

    await getStorage().deleteObject(d.bucket, d.key);

    return true;
  });
};
