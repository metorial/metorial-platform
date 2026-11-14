import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import type { ScmRepositorySync } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';

let NON_TERMINAL_SYNC_STATUSES = [
  'pending',
  'creating_branch',
  'syncing_contents',
  'creating_pr',
  'waiting_for_ci',
  'waiting_for_review',
  'merging'
] as const;

let FRESH_LANE_STATUSES = ['merged', 'complete_direct_push', 'complete_no_changes'] as const;

let CLEANUP_PAGE_SIZE = 500;

let cleanupCandidateSelect = {
  oid: true,
  sourceType: true,
  repositoryAccessMode: true,
  repoOid: true,
  sourceKey: true,
  baseBranch: true,
  status: true,
  baseCommitSha: true,
  providerPrId: true,
  supersededBySyncOid: true
} as const;

type CleanupCandidate = Pick<ScmRepositorySync, keyof typeof cleanupCandidateSelect>;

let getLaneKey = (sync: Pick<CleanupCandidate, 'repoOid' | 'sourceKey' | 'baseBranch'>) =>
  `${sync.repoOid}:${sync.sourceKey}:${sync.baseBranch}`;

let isIn = (statuses: readonly string[], status: string) => statuses.includes(status);

// Manifest syncs form lanes (repo, source, base branch) whose newest branch-holding sync is what
// the next sync adopts, so it must outlive the retention window while its PR or branch may be live.
// A superseded PR is closed by its successor's createPr, so it stays until that successor settles.
// Older syncs of the chain can go; their continuation/supersession pointers are SetNull.
export let getRetainedRepositorySyncOids = async (page: CleanupCandidate[]) => {
  let manifest = page.filter(sync => sync.sourceType === 'manifest');

  let supersederOids = [
    ...new Set(
      manifest
        .filter(sync => sync.providerPrId && sync.supersededBySyncOid)
        .map(sync => sync.supersededBySyncOid!)
    )
  ];
  let liveSuperseders = new Set(
    supersederOids.length
      ? (
          await db.scmRepositorySync.findMany({
            where: {
              oid: { in: supersederOids },
              status: { in: [...NON_TERMINAL_SYNC_STATUSES] }
            },
            select: { oid: true }
          })
        ).map(sync => sync.oid)
      : []
  );

  let laneCandidates = manifest.filter(
    sync =>
      sync.repositoryAccessMode === 'pull_request' &&
      sync.baseCommitSha &&
      !isIn(FRESH_LANE_STATUSES, sync.status)
  );
  let lanes = [...new Map(laneCandidates.map(sync => [getLaneKey(sync), sync])).values()];
  let laneHeads = new Map<string, bigint | null>();
  if (lanes.length) {
    let heads = await db.scmRepositorySync.groupBy({
      by: ['repoOid', 'sourceKey', 'baseBranch'],
      where: {
        sourceType: 'manifest',
        repositoryAccessMode: 'pull_request',
        baseCommitSha: { not: null },
        OR: lanes.map(sync => ({
          repoOid: sync.repoOid,
          sourceKey: sync.sourceKey,
          baseBranch: sync.baseBranch
        }))
      },
      _max: { oid: true }
    });
    for (let head of heads) laneHeads.set(getLaneKey(head), head._max.oid);
  }

  let retained = new Set<bigint>();
  for (let sync of manifest) {
    if (
      isIn(NON_TERMINAL_SYNC_STATUSES, sync.status) ||
      (sync.status === 'complete_unmerged' && sync.providerPrId) ||
      (sync.providerPrId &&
        sync.supersededBySyncOid &&
        liveSuperseders.has(sync.supersededBySyncOid))
    ) {
      retained.add(sync.oid);
    }
  }
  for (let sync of laneCandidates) {
    if (laneHeads.get(getLaneKey(sync)) === sync.oid) retained.add(sync.oid);
  }

  return retained;
};

// oid and createdAt grow together, so the newest expired sync bounds the walk by primary key.
export let deleteExpiredRepositorySyncs = async (cutoff: Date) => {
  let boundary = await db.scmRepositorySync.findFirst({
    where: { createdAt: { lt: cutoff } },
    orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
    select: { oid: true }
  });
  if (!boundary) return;

  let cursor = 0n;
  while (true) {
    let page = await db.scmRepositorySync.findMany({
      where: { oid: { gt: cursor, lte: boundary.oid }, createdAt: { lt: cutoff } },
      orderBy: { oid: 'asc' },
      take: CLEANUP_PAGE_SIZE,
      select: cleanupCandidateSelect
    });
    if (!page.length) return;

    let retained = await getRetainedRepositorySyncOids(page);
    let expired = page.filter(sync => !retained.has(sync.oid)).map(sync => sync.oid);
    if (expired.length) {
      await db.scmRepositorySync.deleteMany({ where: { oid: { in: expired } } });
    }

    if (page.length < CLEANUP_PAGE_SIZE) return;
    cursor = page[page.length - 1]!.oid;
  }
};

export let cleanupProcessor = createCron(
  {
    name: 'ori/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 30_000
  },
  async () => {
    let now = new Date();
    let oneWeekAgo = subDays(now, 7);
    let twoWeeksAgo = subDays(now, 14);

    await db.scmRepositoryWebhookReceivedEvent.deleteMany({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });

    await deleteExpiredRepositorySyncs(twoWeeksAgo);
  }
);
