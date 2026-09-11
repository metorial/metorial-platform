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
