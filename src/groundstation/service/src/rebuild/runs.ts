import {
  Prisma,
  type Instance,
  type Organization,
  type Project,
  type RebuildRunStatus
} from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import type { RebuildFilter } from '../knowledge/types';
import {
  mergeRebuildFilters,
  normalizeLayers,
  normalizeRebuildFilter,
  parseRebuildCursor,
  type RebuildLayer
} from './plan';

let coalesceLockSpace = 730_122_502;

export let activeRebuildStatuses: RebuildRunStatus[] = ['queued', 'running'];

export let rebuildRunInclude = {
  organization: true,
  project: true,
  instance: { include: { project: true } }
} satisfies Prisma.RebuildRunInclude;

export type RebuildRunWithRelations = Prisma.RebuildRunGetPayload<{
  include: typeof rebuildRunInclude;
}>;

type RebuildRunInput = {
  organization: Organization;
  project?: Project | null;
  instance?: Instance | null;
  range: { from: Date; to: Date };
  layers: RebuildLayer[];
  reason: string;
  filter?: RebuildFilter | null;
};

let filterValue = (filter: RebuildFilter | null | undefined) =>
  filter ? normalizeRebuildFilter(filter) : Prisma.DbNull;

export let createRebuildRun = async (d: RebuildRunInput) =>
  await withTransaction(
    async tdb =>
      await tdb.rebuildRun.create({
        data: {
          ...getId('rebuildRun'),
          layers: d.layers,
          reason: d.reason,
          filter: filterValue(d.filter),
          rangeFrom: d.range.from,
          rangeTo: d.range.to,
          organizationOid: d.organization.oid,
          projectOid: d.project?.oid ?? null,
          instanceOid: d.instance?.oid ?? null
        },
        include: rebuildRunInclude
      }),
    { ifExists: true }
  );

// 08 §8: a run that hasn't started yet for the same scope, reason and layers is widened (union of
// filters and ranges) instead of getting a duplicate. The advisory lock serializes concurrent
// triggers for one organization; a run that starts meanwhile is guarded by its `updatedAt`.
export let queueRebuildRun = async (d: RebuildRunInput) =>
  await withTransaction(async tdb => {
    await tdb.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${coalesceLockSpace}, hashtext($1))`,
      d.organization.id
    );

    let layers = normalizeLayers(d.layers);
    let queued = await tdb.rebuildRun.findFirst({
      where: {
        organizationOid: d.organization.oid,
        projectOid: d.project?.oid ?? null,
        instanceOid: d.instance?.oid ?? null,
        reason: d.reason,
        layers: { equals: layers },
        status: 'queued'
      },
      orderBy: { createdAt: 'asc' }
    });

    if (queued) {
      let widened = await tdb.rebuildRun.update({
        where: { oid: queued.oid },
        data: {
          rangeFrom: new Date(Math.min(queued.rangeFrom.getTime(), d.range.from.getTime())),
          rangeTo: new Date(Math.max(queued.rangeTo.getTime(), d.range.to.getTime())),
          filter: filterValue(mergeRebuildFilters(queued.filter, d.filter ?? null))
        },
        include: rebuildRunInclude
      });

      return { run: widened, created: false };
    }

    return { run: await createRebuildRun({ ...d, layers }), created: true };
  });

export let getRebuildRun = async (rebuildRunId: string) =>
  await db.rebuildRun.findUnique({ where: { id: rebuildRunId }, include: rebuildRunInclude });

// Both the scan (when it reaches the end) and every finished item call this after their own
// write, so whichever comes last sees the final counts.
export let completeRebuildRunIfFinished = async (oid: bigint) => {
  let run = await db.rebuildRun.findUnique({ where: { oid } });
  if (!run || run.status != 'running' || run.total === null) return;
  if (parseRebuildCursor(run.cursor).phase != 'done' || run.processed < run.total) return;

  await db.rebuildRun.updateMany({
    where: { oid, status: 'running' },
    data: { status: 'completed', completedAt: new Date() }
  });
};

export let finishRebuildItem = async (d: { oid: bigint; error?: string }) => {
  await db.rebuildRun.update({
    where: { oid: d.oid },
    data: { processed: { increment: 1 }, ...(d.error ? { error: d.error } : {}) }
  });

  await completeRebuildRunIfFinished(d.oid);
};

export let failRebuildRun = async (d: { oid: bigint; error: string }) => {
  await db.rebuildRun.updateMany({
    where: { oid: d.oid, status: { in: activeRebuildStatuses } },
    data: { status: 'failed', error: d.error, completedAt: new Date() }
  });
};
