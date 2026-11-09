import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { REMOTE_STATE_KEY_ROOT } from '../../services/repositoryRemoteState';
import { storage } from '../../storage';

let REMOTE_STATE_MAX_AGE_DAYS = 30;
let UNREFERENCED_LISTING_GRACE_MS = 60 * 60_000;
let LISTING_PAGE_SIZE = 1000;

export let remoteStateGcManyQueue = createQueue<{ continuationToken?: string }>({
  name: 'ori/rem-state/gc-many',
  workerOpts: { concurrency: 1 },
  redisUrl: env.service.REDIS_URL
});

export let remoteStateGcSingleQueue = createQueue<{
  objects: { key: string; lastModified: string }[];
}>({
  name: 'ori/rem-state/gc-single',
  workerOpts: { concurrency: 5 },
  redisUrl: env.service.REDIS_URL
});

let remoteStateGcCron = createCron(
  {
    name: 'ori/rem-state/gc',
    cron: '30 3 * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 30_000
  },
  async () => {
    await db.scmRepositoryRemoteState.deleteMany({
      where: { updatedAt: { lt: subDays(new Date(), REMOTE_STATE_MAX_AGE_DAYS) } }
    });
    await remoteStateGcManyQueue.add(
      {},
      { id: `gc:${new Date().toISOString().slice(0, 10)}` }
    );
  }
);

let remoteStateGcManyProcessor = remoteStateGcManyQueue.process(async data => {
  let page = await storage.listObjectsPage(
    env.storage.CODE_BUCKET_OBJECT_STORAGE_BUCKET,
    REMOTE_STATE_KEY_ROOT,
    LISTING_PAGE_SIZE,
    data.continuationToken
  );

  if (page.objects.length) {
    await remoteStateGcSingleQueue.add({
      objects: page.objects.map(object => ({
        key: object.key,
        lastModified: object.last_modified
      }))
    });
  }
  if (page.nextContinuationToken) {
    await remoteStateGcManyQueue.add({ continuationToken: page.nextContinuationToken });
  }
});

let remoteStateGcSingleProcessor = remoteStateGcSingleQueue.process(async data => {
  let keys = data.objects.map(object => object.key);
  let referenced = await db.scmRepositoryRemoteState.findMany({
    where: { listingKey: { in: keys } },
    select: { listingKey: true }
  });
  let referencedKeys = new Set(referenced.map(state => state.listingKey));
  let cutoff = Date.now() - UNREFERENCED_LISTING_GRACE_MS;

  let unreferenced = data.objects
    .filter(
      object =>
        !referencedKeys.has(object.key) && new Date(object.lastModified).getTime() < cutoff
    )
    .map(object => object.key);
  if (!unreferenced.length) return;

  await storage.deleteObjects(env.storage.CODE_BUCKET_OBJECT_STORAGE_BUCKET, unreferenced);
});

export let remoteStateGcProcessor = combineQueueProcessors([
  remoteStateGcCron,
  remoteStateGcManyProcessor,
  remoteStateGcSingleProcessor
]);
