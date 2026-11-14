import { db, type File } from '@metorial/db';
import { ObjectStorageError } from 'object-storage-client';
import { getCargoFilesBucketName, getStorage } from '../storage';

let rangeNotSatisfiableStatus = 416;
let fullReadFallbackMaxBytes = 16 * 1024 * 1024;

export type FileHead =
  | { status: 'ok'; bytes: Buffer; source: 'database' | 'object' }
  | { status: 'unreadable' }
  | { status: 'failed' };

export let readFileHead = async (d: {
  file: Pick<File, 'oid' | 'storeId' | 'delegatorOid'> & Partial<Pick<File, 'fileSize'>>;
  bytes: number;
}): Promise<FileHead> => {
  if (d.file.delegatorOid) return { status: 'unreadable' };

  let pending = await db.filePendingContent.findUnique({
    where: { fileOid: d.file.oid },
    select: { content: true }
  });

  if (pending) {
    return {
      status: 'ok',
      bytes: Buffer.from(pending.content).subarray(0, d.bytes),
      source: 'database'
    };
  }

  try {
    let object = await getStorage().getObjectRange(getCargoFilesBucketName(), d.file.storeId, {
      start: 0,
      end: d.bytes - 1
    });

    return { status: 'ok', bytes: object.data, source: 'object' };
  } catch (error) {
    if (error instanceof ObjectStorageError && error.statusCode == rangeNotSatisfiableStatus) {
      return { status: 'ok', bytes: Buffer.alloc(0), source: 'object' };
    }

    return await readHeadFromFullObject(d, error);
  }
};

// Storage servers that ignore Range answer with the whole object, which the client reports as an
// error. Reading the object and cutting the head from it keeps those files reviewable.
let readHeadFromFullObject = async (
  d: { file: Pick<File, 'storeId'> & Partial<Pick<File, 'fileSize'>>; bytes: number },
  rangeError: unknown
): Promise<FileHead> => {
  if (d.file.fileSize != undefined && Number(d.file.fileSize) > fullReadFallbackMaxBytes) {
    console.error('Range read of file failed and file is too large for a full read', rangeError);
    return { status: 'failed' };
  }

  try {
    let object = await getStorage().getObject(getCargoFilesBucketName(), d.file.storeId);
    return { status: 'ok', bytes: object.data.subarray(0, d.bytes), source: 'object' };
  } catch (error) {
    console.error('Failed to read file head from object storage', rangeError, error);
    return { status: 'failed' };
  }
};
