import { createCron } from '@mtsrc/cron';
import { combineQueueProcessors, createQueue } from '@mtsrc/queue';
import { db, env, withTransaction } from '@metorial-cargo/db';
import { internalDocumentDraftService } from '@metorial-cargo/module-doc';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;

export let fileExpirationManyQueue = createQueue<{
  cursor?: string;
}>({
  redisUrl,
  name: 'cargo/file/expiration/many',
  workerOpts: {
    concurrency: 1
  }
});

export let fileExpirationSingleQueue = createQueue<{
  fileId: string;
}>({
  redisUrl,
  name: 'cargo/file/expiration/single',
  workerOpts: {
    concurrency: 1
  }
});

export let fileExpirationManyProcessor = fileExpirationManyQueue.process(async data => {
  let files = await db.file.findMany({
    where: {
      status: 'active',
      expiresAt: {
        lte: new Date()
      },
      id: data.cursor
        ? {
            gt: data.cursor
          }
        : undefined
    },
    orderBy: {
      id: 'asc'
    },
    take: batchSize,
    select: {
      oid: true,
      id: true
    }
  });

  if (files.length === 0) return;

  await fileExpirationSingleQueue.addManyWithOps(
    files.map(file => ({
      data: { fileId: file.id },
      opts: { id: file.id }
    }))
  );

  if (files.length === batchSize) {
    await fileExpirationManyQueue.add({
      cursor: files[files.length - 1]!.id
    });
  }
});

export let fileExpirationSingleProcessor = fileExpirationSingleQueue.process(async data => {
  let documentId = await withTransaction(async db => {
    let file = await db.file.findUnique({
      where: {
        id: data.fileId
      },
      select: {
        oid: true,
        status: true,
        expiresAt: true,
        document: {
          select: {
            id: true
          }
        }
      }
    });
    let now = new Date();

    if (!file || file.status !== 'active' || !file.expiresAt || file.expiresAt > now) {
      return null;
    }

    let affectedStoreOids = (
      await db.storeItem.findMany({
        where: {
          reference: {
            fileLink: {
              fileOid: file.oid
            }
          }
        },
        distinct: ['storeOid'],
        select: {
          storeOid: true
        }
      })
    ).map(item => item.storeOid);

    let updated = await db.file.updateMany({
      where: {
        oid: file.oid,
        status: 'active',
        expiresAt: {
          lte: now
        }
      },
      data: {
        status: 'deleted'
      }
    });
    if (updated.count === 0) return null;

    await db.fileReference.deleteMany({
      where: {
        fileLink: {
          fileOid: file.oid
        }
      }
    });

    await db.fileLink.deleteMany({
      where: {
        fileOid: file.oid
      }
    });

    let changedAt = new Date();
    for (let storeOid of affectedStoreOids) {
      let itemCount = await db.storeItem.count({
        where: {
          storeOid
        }
      });

      await db.store.updateMany({
        where: {
          oid: storeOid
        },
        data: {
          itemCount,
          lastEditedAt: changedAt
        }
      });

      await db.store.updateMany({
        where: {
          oid: storeOid,
          dirtyAt: null
        },
        data: {
          dirtyAt: changedAt
        }
      });
    }

    return file.document?.id ?? null;
  });

  if (documentId) {
    await internalDocumentDraftService.clearDocumentState(documentId);
  }
});

export let fileExpirationCron = createCron(
  {
    redisUrl,
    name: 'cargo/file/expiration/cron',
    cron: '0 * * * *'
  },
  async () => {
    await fileExpirationManyQueue.add({});
  }
);

export let fileExpirationProcessors = combineQueueProcessors([
  fileExpirationManyProcessor,
  fileExpirationSingleProcessor,
  fileExpirationCron
]);
