import type mongoose from 'mongoose';
import type { Instance, Project, RebuildRun } from '@mtsrc/agent-tracking-db';
import {
  currentVersions,
  normalizeLayers,
  normalizeRebuildFilter,
  versionRebuildReason,
  type RebuildFilter,
  type RebuildLayer
} from '@mtsrc/agent-tracking-layers';
import type { SessionDocument, UsageSliceDocument } from '@mtsrc/agent-tracking-store';

let dayMs = 24 * 60 * 60 * 1000;

export type RebuildTarget = {
  scope: { organizationId: string; projectId?: string; instanceId?: string };
  range: { from: Date; to: Date };
  layers: RebuildLayer[];
  onlyBehind: boolean;
  filter: RebuildFilter | null;
};

// Unfiltered runs walk sessions, then sessionless slices. Filtered runs walk matching slices
// newest bucket first, with `before` as the exclusive upper bucket bound of the next page.
export type RebuildCursor = {
  phase: 'sessions' | 'sessionless' | 'slices' | 'done';
  enqueued: number;
  after?: { startedAt?: string; key: string };
  before?: string;
};

type SessionFilter = mongoose.mongo.Filter<SessionDocument>;

type SliceFilter = mongoose.mongo.Filter<UsageSliceDocument>;

export let isRecordRetentionExpired = (d: {
  at: Date;
  recordRetentionDays: number;
  now: Date;
}) => d.at.getTime() + d.recordRetentionDays * dayMs <= d.now.getTime();

// 07 §5.7: summary and facts need raw records, so frozen sessions only get attribution.
export let planLayers = (d: {
  requested: RebuildLayer[];
  frozen: boolean;
  behind?: RebuildLayer[];
}) =>
  d.requested.filter(
    layer => (!d.behind || d.behind.includes(layer)) && (!d.frozen || layer == 'attribution')
  );

export let rebuildTargetOf = (
  run: RebuildRun & {
    organization: { id: string };
    project: Project | null;
    instance: (Instance & { project: Project }) | null;
  }
): RebuildTarget => {
  let projectId = run.project?.id ?? run.instance?.project.id;

  return {
    scope: {
      organizationId: run.organization.id,
      ...(projectId ? { projectId } : {}),
      ...(run.instance ? { instanceId: run.instance.id } : {})
    },
    range: { from: run.rangeFrom, to: run.rangeTo },
    layers: normalizeLayers(run.layers),
    onlyBehind: run.reason == versionRebuildReason,
    filter: run.filter ? normalizeRebuildFilter(run.filter) : null
  };
};

export let parseRebuildCursor = (cursor: string | null): RebuildCursor =>
  cursor ? (JSON.parse(cursor) as RebuildCursor) : { phase: 'sessions', enqueued: 0 };

export let serializeRebuildCursor = (cursor: RebuildCursor) => JSON.stringify(cursor);

let scopeFilter = (target: RebuildTarget) => ({
  organizationId: target.scope.organizationId,
  ...(target.scope.projectId ? { projectId: target.scope.projectId } : {}),
  ...(target.scope.instanceId ? { instanceId: target.scope.instanceId } : {})
});

let sessionBehindClauses = (layers: RebuildLayer[]): SessionFilter[] =>
  layers.map(layer =>
    layer == 'attribution'
      ? { 'versions.attribution': { $lt: currentVersions.attribution } }
      : { [`versions.${layer}`]: { $lt: currentVersions[layer] }, frozen: { $ne: true } }
  );

// Newest first, so a version rebuild fixes current dashboards before old history.
export let sessionPageFilter = (
  target: RebuildTarget,
  after?: RebuildCursor['after']
): SessionFilter => {
  let and: SessionFilter[] = [];

  if (target.onlyBehind) and.push({ $or: sessionBehindClauses(target.layers) });

  if (after?.startedAt) {
    let startedAt = new Date(after.startedAt);

    and.push({
      $or: [{ startedAt: { $lt: startedAt } }, { startedAt, _id: { $gt: after.key } }]
    });
  }

  return {
    ...scopeFilter(target),
    startedAt: { $gte: target.range.from, $lt: target.range.to },
    ...(and.length ? { $and: and } : {})
  };
};

// Sessionless slices store no summary version, so a summary rebuild takes every bucket.
let sliceBehindClauses = (layers: RebuildLayer[]): SliceFilter[] | null => {
  if (layers.includes('summary')) return null;

  return layers.map(layer =>
    layer == 'attribution'
      ? { attributionVersion: { $lt: currentVersions.attribution } }
      : { factsVersion: { $lt: currentVersions.facts } }
  );
};

export let sessionlessPageFilter = (target: RebuildTarget, afterKey?: string): SliceFilter => {
  let behind = target.onlyBehind ? sliceBehindClauses(target.layers) : null;

  return {
    ...scopeFilter(target),
    sessionlessKey: afterKey ? { $exists: true, $gt: afterKey } : { $exists: true },
    bucket: { $gte: target.range.from, $lt: target.range.to },
    ...(behind ? { $or: behind } : {})
  };
};

// Each clause is served by its own `{organizationId, <field>, bucket}` index (08 §8). Filtered
// pages rely on a rebuilt session still matching, so no clause may depend on what a rebuild
// changes; the raw clause doesn't require the slice to be unresolved.
export let sliceFilterClauses = (filter: RebuildFilter): SliceFilter[] => {
  let clauses: SliceFilter[] = [];

  if (filter.modelIds?.length) clauses.push({ modelId: { $in: filter.modelIds } });
  if (filter.modelRaws?.length) clauses.push({ modelRaw: { $in: filter.modelRaws } });
  if (filter.vendorIds?.length) clauses.push({ vendorId: { $in: filter.vendorIds } });
  if (filter.clientFamilies?.length) {
    clauses.push({ 'client.family': { $in: filter.clientFamilies } });
  }

  return clauses;
};

let matchingSlices = (filter: RebuildFilter): SliceFilter => {
  let clauses = sliceFilterClauses(filter);
  if (!clauses.length) return { _id: { $in: [] } };

  return clauses.length == 1 ? clauses[0]! : { $or: clauses };
};

export let filteredSliceFilter = (
  target: RebuildTarget & { filter: RebuildFilter },
  bucket: { from?: Date; before?: Date } = {}
): SliceFilter => ({
  ...scopeFilter(target),
  bucket: { $gte: bucket.from ?? target.range.from, $lt: bucket.before ?? target.range.to },
  ...matchingSlices(target.filter)
});

// A filtered page takes a session at its newest matching slice, so a key that also matches in a
// newer bucket than the page covers was already taken by an earlier page.
export let takenKeysFilter = (
  target: RebuildTarget & { filter: RebuildFilter },
  d: { owner: 'sessionKey' | 'sessionlessKey'; keys: string[]; before: Date }
): SliceFilter => ({
  ...filteredSliceFilter(target, { from: d.before }),
  [d.owner]: { $in: d.keys }
});
