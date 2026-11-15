import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { createQueueCheckpoint } from '@lowerdeck/queue-checkpoint';
import { db } from '@metorial-subspace/db';
import { env } from '../env';
import { providerIssueRecorderService } from '../services/providerIssueRecorder';

let PAGE_SIZE = 500;

let sources = ['session_error', 'auth_config_error', 'protoguard_alert'] as const;

type BackfillSource = (typeof sources)[number];

// The checkpoint only records that the one-time backfill was started; rows created after the
// cutoff are attached to issues by the live write paths.
let checkpoint = createQueueCheckpoint({ db, queue: 'sub/pis/backfill' });

let providerIssueBackfillCron = createCron(
  {
    name: 'sub/pis/backfill/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 * * * *'
  },
  async () => {
    if (await checkpoint.since()) return;

    let cutoff = new Date();

    await providerIssueBackfillManyQueue.addMany(
      sources.map(source => ({ source, cutoff: cutoff.toISOString() }))
    );
    await checkpoint.commit(cutoff);
  }
);

let providerIssueBackfillManyQueue = createQueue<{
  source: BackfillSource;
  cutoff: string;
  cursor?: string;
}>({
  name: 'sub/pis/backfill/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let providerIssueBackfillManyProcessor = providerIssueBackfillManyQueue.process(async data => {
  let where = {
    issueOid: null,
    createdAt: { lt: new Date(data.cutoff) },
    oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
  };
  let page = {
    where,
    select: { oid: true, id: true },
    orderBy: { oid: 'asc' as const },
    take: PAGE_SIZE
  };

  let rows =
    data.source == 'session_error'
      ? await db.sessionError.findMany({ ...page, where: { ...where, isProcessing: false } })
      : data.source == 'auth_config_error'
        ? await db.providerAuthConfigError.findMany({
            ...page,
            where: { ...where, isProcessing: false }
          })
        : await db.protoGuardAlert.findMany(page);

  if (!rows.length) return;

  await providerIssueBackfillSingleQueue.addManyWithOps(
    rows.map(row => ({ data: { source: data.source, id: row.id }, opts: { id: row.id } }))
  );

  if (rows.length == PAGE_SIZE) {
    await providerIssueBackfillManyQueue.add(
      { ...data, cursor: String(rows[rows.length - 1]!.oid) },
      hourlyPacedDelay()
    );
  }
});

let providerIssueBackfillSingleQueue = createQueue<{ source: BackfillSource; id: string }>({
  name: 'sub/pis/backfill/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 50, duration: 1000 } }
});

let providerIssueBackfillSingleProcessor = providerIssueBackfillSingleQueue.process(
  async data => {
    if (data.source == 'session_error') {
      await providerIssueRecorderService.recordSessionError({ sessionErrorId: data.id });
    } else if (data.source == 'auth_config_error') {
      await providerIssueRecorderService.recordAuthConfigError({ authConfigErrorId: data.id });
    } else {
      await providerIssueRecorderService.recordProtoGuardAlert({ protoGuardAlertId: data.id });
    }
  }
);

export let providerIssueBackfillProcessors = combineQueueProcessors([
  providerIssueBackfillCron,
  providerIssueBackfillManyProcessor,
  providerIssueBackfillSingleProcessor
]);
