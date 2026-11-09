import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, pacedDelay } from '@metorial/queue';
import { isObjectMissingError } from '../lib/cargoObjects';
import { getFileContentHashes, hasValidContentHashes } from '../lib/contentHashes';

let backfillPageSize = 500;

export let fileHashQueue = createQueue<{ fileId: string }>({
  name: 'cargo/storage/file/hash',
  workerOpts: {
    concurrency: 10,
    limiter: { max: 50, duration: 1000 }
  }
});

export let fileHashBackfillQueue = createQueue<{ instanceId?: string; cursor?: string }>({
  name: 'cargo/storage/file/hash-backfill',
  workerOpts: {
    concurrency: 1
  }
});

export let getFileHashJobId = (file: { id: string; storeId: string }) =>
  `file-hash:${file.id}:${file.storeId}`;

export let listFilesMissingContentHashes = async (d: {
  instanceId?: string;
  cursor?: string;
  limit: number;
}) =>
  await db.file.findMany({
    where: {
      id: d.cursor ? { gt: d.cursor } : undefined,
      status: 'active',
      storeId: { not: '' },
      delegatorOid: null,
      instance: d.instanceId ? { id: d.instanceId } : undefined,
      storeItems: { some: { store: { skill: { isNot: null } } } },
      OR: [
        { contentSha256: null },
        { contentGitBlobSha: null },
        { contentCrc32: null },
        { contentSha256StoreId: null },
        { NOT: { contentSha256StoreId: { equals: db.file.fields.storeId } } }
      ]
    },
    orderBy: { id: 'asc' },
    select: { id: true, storeId: true },
    take: d.limit
  });

export let fileHashProcessor = fileHashQueue.process(async data => {
  let file = await db.file.findUnique({ where: { id: data.fileId } });
  if (!file || file.status !== 'active' || !file.storeId || file.delegatorOid) return;
  if (hasValidContentHashes(file)) return;

  try {
    await getFileContentHashes({ file });
  } catch (error) {
    if (isObjectMissingError(error)) return;
    throw error;
  }
});

export let fileHashBackfillProcessor = fileHashBackfillQueue.process(async data => {
  let files = await listFilesMissingContentHashes({
    instanceId: data.instanceId,
    cursor: data.cursor,
    limit: backfillPageSize
  });
  if (files.length === 0) return;

  await fileHashQueue.addManyWithOps(
    files.map(file => ({
      data: { fileId: file.id },
      opts: { id: getFileHashJobId(file) }
    }))
  );

  if (files.length === backfillPageSize) {
    await fileHashBackfillQueue.add(
      { instanceId: data.instanceId, cursor: files[files.length - 1]!.id },
      pacedDelay({ baseMs: 5_000, jitterMs: 5_000 })
    );
  }
});

export let fileHashBackfillCron = createCron(
  {
    name: 'cargo/storage/file/hash-backfill/cron',
    cron: '17 3 * * *'
  },
  async () => {
    await fileHashBackfillQueue.add({});
  }
);

export let fileHashProcessors = combineQueueProcessors([
  fileHashProcessor,
  fileHashBackfillProcessor,
  fileHashBackfillCron
]);
