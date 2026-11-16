import type { Organization, Project } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { hasRebuildItems } from './pages';
import {
  bucketStart,
  mergeRebuildFilters,
  type RebuildFilter,
  type RebuildImpact,
  type RebuildLayer
} from '@mtsrc/agent-tracking-layers';

let dayMs = 24 * 60 * 60 * 1000;

// Summary and facts need raw records, so nothing before the longest record retention of the
// scope can be rebuilt.
export let recordRetentionStart = async (d: {
  organization: Organization;
  project?: Project | null;
  now: Date;
}) => {
  let instance = await db.instance.findFirst({
    where: {
      organizationOid: d.organization.oid,
      ...(d.project ? { projectOid: d.project.oid } : {})
    },
    orderBy: { recordRetentionDays: 'desc' },
    select: { recordRetentionDays: true }
  });
  if (!instance) return null;

  return new Date(d.now.getTime() - instance.recordRetentionDays * dayMs);
};

// Keeps the impacts that have data in the scope (each capped at retention) and joins them into
// one run: the union of their filters over the union of their ranges. Slices are found by the
// start of their bucket, so a range starts at the day bucket holding its first affected usage.
export let planImpactRun = async (d: {
  organization: Organization;
  project?: Project | null;
  impacts: RebuildImpact[];
  layers: RebuildLayer[];
  now: Date;
}) => {
  let retentionStart = await recordRetentionStart(d);
  if (!retentionStart) return null;

  let scope = {
    organizationId: d.organization.id,
    ...(d.project ? { projectId: d.project.id } : {})
  };
  let matched: { range: { from: Date; to: Date }; filter: RebuildFilter | null }[] = [];

  for (let impact of d.impacts) {
    let range = {
      from: bucketStart(
        new Date(Math.max(Date.parse(impact.from), retentionStart.getTime())),
        1440
      ),
      to: new Date(Math.min(impact.to ? Date.parse(impact.to) : Infinity, d.now.getTime()))
    };
    if (range.from >= range.to) continue;

    let found = await hasRebuildItems({
      scope,
      range,
      layers: d.layers,
      onlyBehind: false,
      filter: impact.filter
    });
    if (found) matched.push({ range, filter: impact.filter });
  }

  if (!matched.length) return null;

  return {
    range: {
      from: new Date(Math.min(...matched.map(item => item.range.from.getTime()))),
      to: new Date(Math.max(...matched.map(item => item.range.to.getTime())))
    },
    filter: matched
      .map(item => item.filter)
      .reduce((merged, next) => mergeRebuildFilters(merged, next))
  };
};
