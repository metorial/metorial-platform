import { db, withTransaction } from '@metorial/db';
import { getCargoFilesBucketName, getObjectStream, getStorage } from '../storage';
import {
  isBufferableTextFile,
  maxBufferedFileSize,
  textFileExtensions
} from './fileContentPolicy';

let pendingContentDurationMs = 60 * 60 * 1000;

export let shouldBufferFileContent = (d: { fileName: string; size: number }) =>
  isBufferableTextFile(d);

export let getPendingFileContentFlushAfter = () =>
  new Date(Date.now() + pendingContentDurationMs);

export let getStoredFileContent = async (d: { file: { oid: bigint; storeId: string } }) => {
  let pending = await db.filePendingContent.findUnique({
    where: {
      fileOid: d.file.oid
    },
    select: {
      content: true
    }
  });

  if (pending) {
    return {
      data: Buffer.from(pending.content),
      source: 'database' as const
    };
  }

  let object = await getStorage().getObject(getCargoFilesBucketName(), d.file.storeId);
  return {
    data: object.data,
    contentType: object.metadata.content_type,
    source: 'object' as const
  };
};

/**
 * Same as getStoredFileContent, but hands back a stream for object-backed content
 * so that serving a file costs a chunk of memory rather than its full size.
 */
export let getStoredFileContentStream = async (d: {
  file: { oid: bigint; storeId: string };
}) => {
  let pending = await db.filePendingContent.findUnique({
    where: {
      fileOid: d.file.oid
    },
    select: {
      content: true
    }
  });

  if (pending) {
    let data = Buffer.from(pending.content);

    return {
      body: data as Buffer | ReadableStream<Uint8Array>,
      size: data.byteLength as number | undefined,
      contentType: undefined as string | undefined,
      source: 'database' as const
    };
  }

  let object = await getObjectStream(getCargoFilesBucketName(), d.file.storeId);

  return {
    body: object.stream as Buffer | ReadableStream<Uint8Array>,
    size: object.size,
    contentType: object.contentType,
    source: 'object' as const
  };
};

/// True while a file's content still lives in the database and has not been
/// flushed to object storage, meaning it cannot be served from a signed URL.
export let hasPendingFileContent = async (fileOid: bigint) =>
  (await db.filePendingContent.count({ where: { fileOid } })) > 0;

export let deletePendingFileContent = async (fileOid: bigint) =>
  await withTransaction(
    async db =>
      await db.filePendingContent.deleteMany({
        where: {
          fileOid
        }
      }),
    { ifExists: true }
  );

export let pendingFileContentConfig = {
  maxBufferedFileSize,
  pendingContentDurationMs,
  textFileExtensions
};
