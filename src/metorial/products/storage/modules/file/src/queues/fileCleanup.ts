import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { getCargoFilesBucketName, getStorage } from '../storage';
let batchSize = 100;

export let fileCleanupManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/file/cleanup/many',
  workerOpts: {
    concurrency: 1
  }
});

export let fileCleanupSingleQueue = createQueue<{ fileId: string }>({
  name: 'cargo/file/cleanup/single',
  workerOpts: {
    concurrency: 1
  }
});

export let listDeletedFilesWithStorage = async (d: { cursor?: string; limit: number }) =>
  await db.file.findMany({
    where: {
      id: d.cursor ? { gt: d.cursor } : undefined,
      status: 'deleted',
      storeId: { not: '' }
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

export let cleanupDeletedFileStorage = async (d: { fileId: string; storeId?: string }) => {
  let file = await db.file.findUnique({
    where: {
      id: d.fileId
    },
    select: {
      status: true,
      storeId: true
    }
  });
  let storeId = d.storeId ?? file?.storeId;
  if (!file || file.status !== 'deleted' || !storeId) return false;

  let activeFileCount = await db.file.count({
    where: {
      status: 'active',
      storeId
    }
  });
  if (activeFileCount > 0) return false;

  await getStorage().deleteObject(getCargoFilesBucketName(), storeId);

  return true;
};

export let fileCleanupManyProcessor = fileCleanupManyQueue.process(async data => {
  let files = await listDeletedFilesWithStorage({
    cursor: data.cursor,
    limit: batchSize
  });
  if (files.length === 0) return;

  await fileCleanupSingleQueue.addManyWithOps(
    files.map(file => ({
      data: { fileId: file.id },
      opts: { id: `file-cleanup:${file.oid.toString()}` }
    }))
  );

  if (files.length === batchSize) {
    await fileCleanupManyQueue.add({
      cursor: files[files.length - 1]!.id
    });
  }
});

export let fileCleanupSingleProcessor = fileCleanupSingleQueue.process(async data => {
  await cleanupDeletedFileStorage({
    fileId: data.fileId
  });
});

export let fileCleanupCron = createCron(
  {
    name: 'cargo/file/cleanup/cron',
    cron: '0 0 * * *'
  },
  async () => {
    await fileCleanupManyQueue.add({});
  }
);

export let fileCleanupProcessors = combineQueueProcessors([
  fileCleanupManyProcessor,
  fileCleanupSingleProcessor,
  fileCleanupCron
]);
