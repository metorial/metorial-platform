import { createCron } from '@mtsrc/cron';
import { combineQueueProcessors, createQueue } from '@mtsrc/queue';
import { db, env, withTransaction } from '@metorial-cargo/db';
import { subDays } from 'date-fns';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;

export let documentCleanupManyQueue = createQueue<{ cursor?: string }>({
  redisUrl,
  name: 'cargo/doc/cleanup/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentCleanupSingleQueue = createQueue<{ documentVersionId: string }>({
  redisUrl,
  name: 'cargo/doc/cleanup/single',
  workerOpts: {
    concurrency: 5
  }
});

export let listStaleDocumentVersions = async (d: { cursor?: string; limit: number }) =>
  await db.documentVersion.findMany({
    where: {
      id: d.cursor ? { gt: d.cursor } : undefined,
      createdAt: {
        lt: subDays(new Date(), 30)
      },
      currentVersionOfDocuments: {
        none: {}
      }
    },
    orderBy: {
      id: 'asc'
    },
    select: {
      id: true
    },
    take: d.limit
  });

export let documentCleanupManyProcessor = documentCleanupManyQueue.process(async data => {
  let versions = await listStaleDocumentVersions({
    cursor: data.cursor,
    limit: batchSize
  });
  if (versions.length === 0) return;

  await documentCleanupSingleQueue.addMany(
    versions.map(version => ({
      documentVersionId: version.id
    }))
  );

  if (versions.length === batchSize) {
    await documentCleanupManyQueue.add({
      cursor: versions[versions.length - 1]!.id
    });
  }
});

export let cleanupDocumentVersion = async (d: { documentVersionId: string }) => {
  let version = await db.documentVersion.findUnique({
    where: {
      id: d.documentVersionId
    },
    include: {
      currentVersionOfDocuments: {
        select: {
          id: true
        }
      }
    }
  });
  if (!version || version.currentVersionOfDocuments.length > 0) return false;

  let contentOid = version.contentOid;

  await withTransaction(async db => {
    await db.documentVersion.updateMany({
      where: {
        previousVersionOid: version.oid
      },
      data: {
        previousVersionOid: null
      }
    });

    await db.documentVersion.delete({
      where: {
        id: version.id
      }
    });
  });

  let [documentCount, versionCount] = await Promise.all([
    db.document.count({
      where: {
        contentOid
      }
    }),
    db.documentVersion.count({
      where: {
        contentOid
      }
    })
  ]);

  if (documentCount === 0 && versionCount === 0) {
    await db.documentContent.delete({
      where: {
        oid: contentOid
      }
    });
  }

  return true;
};

export let documentCleanupSingleProcessor = documentCleanupSingleQueue.process(async data => {
  await cleanupDocumentVersion(data);
});

export let documentCleanupCron = createCron(
  {
    redisUrl,
    name: 'cargo/doc/cleanup/cron',
    cron: '0 * * * *'
  },
  async () => {
    await documentCleanupManyQueue.add({});
  }
);

export let documentCleanupProcessors = combineQueueProcessors([
  documentCleanupManyProcessor,
  documentCleanupSingleProcessor,
  documentCleanupCron
]);
