import type {
  Instance,
  Organization,
  Prisma,
  Project,
  RebuildRunStatus
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { parseRebuildCursor, type RebuildLayer } from './plan';

export let activeRebuildStatuses: RebuildRunStatus[] = ['queued', 'running'];

export let rebuildRunInclude = {
  organization: true,
  project: true,
  instance: { include: { project: true } }
} satisfies Prisma.RebuildRunInclude;

export type RebuildRunWithRelations = Prisma.RebuildRunGetPayload<{
  include: typeof rebuildRunInclude;
}>;

export let createRebuildRun = async (d: {
  organization: Organization;
  project?: Project | null;
  instance?: Instance | null;
  range: { from: Date; to: Date };
  layers: RebuildLayer[];
  reason: string;
}) =>
  await db.rebuildRun.create({
    data: {
      ...getId('rebuildRun'),
      layers: d.layers,
      reason: d.reason,
      rangeFrom: d.range.from,
      rangeTo: d.range.to,
      organizationOid: d.organization.oid,
      projectOid: d.project?.oid ?? null,
      instanceOid: d.instance?.oid ?? null
    },
    include: rebuildRunInclude
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
