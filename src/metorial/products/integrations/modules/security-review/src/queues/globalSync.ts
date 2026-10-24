import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import {
  commitWatermarkScan,
  createQueueCheckpoint,
  enqueueWatermarkScan,
  type WatermarkScanJob
} from '@lowerdeck/queue-checkpoint';
import { db } from '@metorial-subspace/db';
import {
  SECURITY_REVIEW_SYNC_PAGE_SIZE,
  securityReviewGlobalRepository
} from '@metorial/multi-region';
import { env } from '../env';
import { internalSecurityReviewMirrorService } from '../internal/securityReviewMirror';
import { enqueueSecurityReviews } from './run';

let STALE_RUNNING_MS = 3 * 60 * 1000;

let checkpoint = createQueueCheckpoint({ db, queue: 'sub/srev/global/mirror' });

export let globalMirrorCron = createCron(
  {
    name: 'sub/srev/global/mirror/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '*/2 * * * *'
  },
  async () => {
    await enqueueWatermarkScan({
      checkpoint,
      queue: globalMirrorManyQueue,
      extra: { table: 'reviews' as const }
    });
  }
);

type MirrorScanJob = WatermarkScanJob & { table: 'reviews' | 'revisions' };

let globalMirrorManyQueue = createQueue<MirrorScanJob>({
  name: 'sub/srev/global/mirror/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Reviews and revisions are walked one after the other within the same scan, so the
// watermark is only committed once both tables have been fully paged.
let globalMirrorManyProcessor = globalMirrorManyQueue.process(async job => {
  let since = job.since ? new Date(job.since) : new Date(0);

  let page =
    job.table == 'reviews'
      ? (
          await securityReviewGlobalRepository.listReviewsUpdatedSince({
            since,
            cursor: job.cursor
          })
        ).map(review => ({ cursor: review.id, reviewId: review.id }))
      : (
          await securityReviewGlobalRepository.listRevisionsUpdatedSince({
            since,
            cursor: job.cursor
          })
        ).map(revision => ({ cursor: revision.id, reviewId: revision.reviewId }));

  let reviewIds = [...new Set(page.map(row => row.reviewId))];
  if (reviewIds.length) {
    await globalMirrorSingleQueue.addManyWithOps(
      reviewIds.map(globalReviewId => ({
        data: { globalReviewId },
        opts: { id: globalReviewId }
      }))
    );
  }

  if (page.length == SECURITY_REVIEW_SYNC_PAGE_SIZE) {
    await globalMirrorManyQueue.add(
      { ...job, cursor: page[page.length - 1]!.cursor },
      hourlyPacedDelay()
    );
    return;
  }

  if (job.table == 'reviews') {
    await globalMirrorManyQueue.add({ ...job, table: 'revisions', cursor: undefined });
    return;
  }

  await commitWatermarkScan({ checkpoint, job });
});

let globalMirrorSingleQueue = createQueue<{ globalReviewId: string }>({
  name: 'sub/srev/global/mirror/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

let globalMirrorSingleProcessor = globalMirrorSingleQueue.process(async data => {
  await internalSecurityReviewMirrorService.mirrorGlobalReview({
    globalReviewId: data.globalReviewId
  });
});

// A region that dies mid-run leaves a running global revision behind. Once its heartbeat is
// older than the lease TTL, any region may fail it and start a fresh run.
let staleTakeoverCron = createCron(
  { name: 'sub/srev/global/stale/cron', redisUrl: env.service.REDIS_URL, cron: '* * * * *' },
  async () => {
    let stale = await securityReviewGlobalRepository.listStaleRunningRevisions({
      heartbeatBefore: new Date(Date.now() - STALE_RUNNING_MS)
    });
    if (!stale.length) return;

    for (let revision of stale) {
      await securityReviewGlobalRepository.updateRevision({
        id: revision.id,
        data: {
          status: 'failed',
          failureCode: 'abandoned',
          stage: null,
          activity: null,
          completedAt: new Date()
        }
      });
    }

    let local = await db.securityReview.findMany({
      where: {
        globalId: { in: [...new Set(stale.map(revision => revision.reviewId))] },
        status: { in: ['active', 'outdated'] }
      },
      select: { id: true }
    });

    await enqueueSecurityReviews(
      local.map(review => ({
        reviewId: review.id,
        trigger: 'scheduled' as const,
        reason: 'The previous run was interrupted.'
      }))
    );
  }
);

export let securityReviewGlobalProcessors = combineQueueProcessors([
  globalMirrorCron,
  globalMirrorManyProcessor,
  globalMirrorSingleProcessor,
  staleTakeoverCron
]);
