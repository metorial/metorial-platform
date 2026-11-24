import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import {
  combineQueueProcessors,
  createQueue,
  deleteInChunks,
  hourlyPacedDelay
} from '@metorial/queue';
import { pendingUploadTtlMs } from '../lib/uploadPolicy';
import { withMultipartUploadLock } from '../lib/multipartUpload';
import { getCargoFilesBucketName, getStorage } from '../storage';
import { cargoObjectDelete } from './objectDelete';

let batchSize = 500;
let purgeChunkSize = 10_000;

export let fileUploadCleanupManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/fileUpload/cleanup/many',
  workerOpts: {
    concurrency: 1
  }
});

export let fileUploadCleanupSingleQueue = createQueue<{ fileUploadId: string }>({
  name: 'cargo/fileUpload/cleanup/single',
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

export let fileUploadPurgeQueue = createQueue<{}>({
  name: 'cargo/fileUpload/purge',
  workerOpts: {
    concurrency: 1
  }
});

export let listAbandonedFileUploads = async (d: { cursor?: string; limit: number }) =>
  await db.fileUpload.findMany({
    where: {
      OR: [
        { status: 'pending', expiresAt: { lte: new Date() } },
        { status: 'canceled', multipartUploadId: { not: null } }
      ],
      id: d.cursor ? { gt: d.cursor } : undefined
    },
    orderBy: {
      id: 'asc'
    },
    select: {
      id: true,
      oid: true
    },
    take: d.limit
  });

export let cleanupFileUpload = async (d: { fileUploadId: string }) => {
  let upload = await db.fileUpload.findUnique({
    where: { id: d.fileUploadId },
    select: { multipartUploadId: true }
  });
  if (upload?.multipartUploadId) {
    return await withMultipartUploadLock(d.fileUploadId, () => cleanupUpload(d.fileUploadId));
  }
  return await cleanupUpload(d.fileUploadId);
};

let cleanupUpload = async (fileUploadId: string) => {
  let upload = await db.fileUpload.findUnique({
    where: { id: fileUploadId },
    select: {
      oid: true,
      status: true,
      storeId: true,
      multipartUploadId: true,
      fileOid: true,
      expiresAt: true
    }
  });
  if (!upload || upload.status === 'completed' || upload.fileOid) return false;
  if (upload.status === 'pending' && upload.expiresAt > new Date()) return false;

  if (upload.multipartUploadId) {
    await getStorage().abortMultipartUpload(
      getCargoFilesBucketName(),
      upload.storeId,
      upload.multipartUploadId
    );
  }

  if (upload.status === 'pending' || upload.multipartUploadId) {
    let expired = await db.fileUpload.updateMany({
      where: {
        oid: upload.oid,
        status: upload.status
      },
      data: {
        status: upload.status === 'pending' ? 'expired' : upload.status,
        multipartUploadId: null
      }
    });
    if (expired.count === 0) return false;
  }

  let filesUsingObject = await db.file.count({
    where: {
      storeId: upload.storeId
    }
  });
  if (filesUsingObject > 0) return false;

  await cargoObjectDelete.enqueue(getCargoFilesBucketName(), [upload.storeId]);

  return true;
};

export let purgeTerminalFileUploads = async () => {
  let where = {
    status: {
      in: ['completed', 'canceled', 'expired'] as Array<'completed' | 'canceled' | 'expired'>
    },
    OR: [{ status: 'completed' as const }, { multipartUploadId: null }],
    updatedAt: { lte: new Date(Date.now() - pendingUploadTtlMs) }
  };

  return await deleteInChunks({
    chunkSize: purgeChunkSize,
    selectKeys: take =>
      db.fileUpload
        .findMany({ where, take, select: { oid: true } })
        .then(r => r.map(u => u.oid)),
    deleteKeys: oids => db.fileUpload.deleteMany({ where: { oid: { in: oids } } })
  });
};

export let fileUploadCleanupManyProcessor = fileUploadCleanupManyQueue.process(async data => {
  let uploads = await listAbandonedFileUploads({
    cursor: data.cursor,
    limit: batchSize
  });
  if (uploads.length === 0) return;

  await fileUploadCleanupSingleQueue.addManyWithOps(
    uploads.map(upload => ({
      data: { fileUploadId: upload.id },
      opts: { id: `file-upload-cleanup:${upload.oid.toString()}` }
    }))
  );

  if (uploads.length === batchSize) {
    await fileUploadCleanupManyQueue.add(
      { cursor: uploads[uploads.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

export let fileUploadCleanupSingleProcessor = fileUploadCleanupSingleQueue.process(
  async data => {
    await cleanupFileUpload({ fileUploadId: data.fileUploadId });
  }
);

export let fileUploadPurgeProcessor = fileUploadPurgeQueue.process(async () => {
  let { hasMore } = await purgeTerminalFileUploads();
  if (hasMore) await fileUploadPurgeQueue.add({}, hourlyPacedDelay());
});

export let fileUploadCleanupCron = createCron(
  {
    name: 'cargo/fileUpload/cleanup/cron',
    cron: '0 * * * *'
  },
  async () => {
    await fileUploadCleanupManyQueue.add({});
    await fileUploadPurgeQueue.add({});
  }
);

export let fileUploadCleanupProcessors = combineQueueProcessors([
  fileUploadCleanupManyProcessor,
  fileUploadCleanupSingleProcessor,
  fileUploadPurgeProcessor,
  fileUploadCleanupCron
]);
