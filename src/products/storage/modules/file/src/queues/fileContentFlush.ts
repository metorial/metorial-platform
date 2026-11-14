import { hashBytes } from '@lowerdeck/hash/content';
import { createCron } from '@metorial/cron';
import { db, withTransaction } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { putCargoObject } from '../lib/cargoObjects';
import { hasValidContentHashes, persistContentHashes } from '../lib/contentHashes';
import { cleanupDeletedFileStorage } from './fileCleanup';

let batchSize = 100;

export let fileContentFlushManyQueue = createQueue<{
  dueBefore: string;
  cursor?: string;
}>({
  name: 'cargo/file/contentFlush/many',
  workerOpts: {
    concurrency: 1
  }
});

export let fileContentFlushSingleQueue = createQueue<{ fileId: string }>({
  name: 'cargo/file/contentFlush/single',
  workerOpts: {
    concurrency: 5
  }
});

export let listPendingFileContentToFlush = async (d: {
  dueBefore: Date;
  cursor?: string;
  limit: number;
}) =>
  await db.filePendingContent.findMany({
    where: {
      flushAfter: { lte: d.dueBefore },
      file: {
        id: d.cursor ? { gt: d.cursor } : undefined
      }
    },
    orderBy: {
      file: {
        id: 'asc'
      }
    },
    select: {
      file: {
        select: {
          id: true,
          oid: true
        }
      }
    },
    take: d.limit
  });

export let flushPendingFileContent = async (d: { fileId: string }) => {
  let pending = await db.filePendingContent.findFirst({
    where: {
      file: {
        id: d.fileId
      }
    },
    include: {
      file: true
    }
  });
  if (!pending || pending.flushAfter > new Date()) return false;

  if (pending.file.status !== 'active') {
    await db.filePendingContent.deleteMany({
      where: {
        oid: pending.oid,
        revision: pending.revision
      }
    });
    return false;
  }

  let content = new Uint8Array(pending.content);
  await putCargoObject({
    key: pending.file.storeId,
    content,
    contentType: pending.file.fileType
  });

  let result = await withTransaction(async db => {
    let currentFile = await db.file.findUnique({
      where: { id: pending.file.id },
      select: { status: true }
    });
    if (!currentFile || currentFile.status !== 'active') {
      await db.filePendingContent.deleteMany({
        where: {
          oid: pending.oid,
          revision: pending.revision
        }
      });
      return 'deleted' as const;
    }

    let deleted = await db.filePendingContent.deleteMany({
      where: {
        oid: pending.oid,
        revision: pending.revision
      }
    });

    return deleted.count > 0 ? ('flushed' as const) : ('stale' as const);
  });

  if (result === 'deleted') {
    await cleanupDeletedFileStorage({
      fileId: pending.file.id,
      storeId: pending.file.storeId
    });
  }

  if (result === 'flushed' && !hasValidContentHashes(pending.file)) {
    await persistContentHashes({ file: pending.file, hashes: hashBytes(content) });
  }

  return result === 'flushed';
};

export let fileContentFlushManyProcessor = fileContentFlushManyQueue.process(async data => {
  let files = await listPendingFileContentToFlush({
    dueBefore: new Date(data.dueBefore),
    cursor: data.cursor,
    limit: batchSize
  });
  if (files.length === 0) return;

  await fileContentFlushSingleQueue.addManyWithOps(
    files.map(({ file }) => ({
      data: { fileId: file.id },
      opts: { id: `file-content-flush:${file.oid.toString()}` }
    }))
  );

  if (files.length === batchSize) {
    await fileContentFlushManyQueue.add({
      dueBefore: data.dueBefore,
      cursor: files[files.length - 1]!.file.id
    });
  }
});

export let fileContentFlushSingleProcessor = fileContentFlushSingleQueue.process(
  async data => {
    await flushPendingFileContent({ fileId: data.fileId });
  }
);

export let fileContentFlushCron = createCron(
  {
    name: 'cargo/file/contentFlush/cron',
    cron: '*/15 * * * *'
  },
  async () => {
    await fileContentFlushManyQueue.add({
      dueBefore: new Date().toISOString()
    });
  }
);

export let fileContentFlushProcessors = combineQueueProcessors([
  fileContentFlushManyProcessor,
  fileContentFlushSingleProcessor,
  fileContentFlushCron
]);
