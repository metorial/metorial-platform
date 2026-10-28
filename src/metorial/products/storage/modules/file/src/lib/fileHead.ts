import { db, type File } from '@metorial/db';
import { ObjectStorageError } from 'object-storage-client';
import { getCargoFilesBucketName, getStorage } from '../storage';

let rangeNotSatisfiableStatus = 416;

export type FileHead =
  | { status: 'ok'; bytes: Buffer; source: 'database' | 'object' }
  | { status: 'unreadable' }
  | { status: 'failed' };

export let readFileHead = async (d: {
  file: Pick<File, 'oid' | 'storeId' | 'delegatorOid'>;
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

    return { status: 'failed' };
  }
};
