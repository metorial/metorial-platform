import type {
  Name,
  NameTarget,
  Offering,
  Pointer,
  TargetPeriod
} from '@metorial/model-catalog/src/types';
import { targetAt } from '@mtsrc/agent-tracking-model-resolver';
import { db } from '@mtsrc/agent-tracking-db';
import type { PriceOverrideImpactScope } from './impact';
import { canonicalJson } from './rows';
import {
  isEmptyRebuildFilter,
  mergeRebuildFilters,
  normalizeRebuildFilter,
  type RebuildFilter,
  type RebuildImpact
} from '@mtsrc/agent-tracking-layers';

export let systemicImpactThreshold = 2000;
export let systemicRebuildDays = 7;

let changePageSize = 1000;
let dayMs = 24 * 60 * 60 * 1000;

export type KnowledgeTrigger = {
  kind: 'offering' | 'name' | 'pointer';
  filter: RebuildFilter;
  from: Date;
};

export type OpenedPricePeriod = {
  modelId: string | null;
  vendorModelId: string;
  validFrom: Date;
  firstSeenAt: Date | null;
  hadEarlierPeriod: boolean;
};

export type OverrideImpactScope = {
  filter: RebuildFilter | null;
  validFrom: Date;
  validTo: Date | null;
};

type Timed = { target: NameTarget; history: TargetPeriod[] };

let resolves = (target: NameTarget) =>
  target.kind == 'model' || target.kind == 'release' || target.kind == 'pointer';

let breakpoints = (entries: Timed[]) =>
  [
    ...new Set(
      entries.flatMap(entry =>
        entry.history.flatMap(period => [period.from, period.to].filter(value => !!value))
      )
    )
  ]
    .map(value => Date.parse(value!))
    .filter(time => !Number.isNaN(time))
    .sort((a, b) => a - b);

// The resolver uses the first period's target before it starts, so a timeline is constant before
// its first breakpoint and between any two; probing just before the first one and at each covers
// every distinct target.
let probes = (entries: Timed[]) => {
  let points = breakpoints(entries);
  return points.length ? [points[0]! - 1, ...points] : [0];
};

export let firstDivergence = (before: Timed | null, after: Timed): number | null => {
  if (!before) return -Infinity;

  let times = probes([before, after]);

  for (let [index, time] of times.entries()) {
    let at = new Date(time);
    if (canonicalJson(targetAt(before, at)) != canonicalJson(targetAt(after, at))) {
      return index == 0 ? -Infinity : time;
    }
  }

  return null;
};

let targetsFrom = (entry: Timed, time: number) =>
  probes([entry])
    .map((probe, index, all) => {
      let next = all[index + 1] ?? Infinity;
      return next > time ? targetAt(entry, new Date(Math.max(probe, time))) : null;
    })
    .filter((target): target is NameTarget => !!target);

let fromTime = (time: number) => new Date(Math.max(time, 0));

// 08 §8: a name that newly resolves, or is retargeted in the past, rebuilds the slices with its
// raw from where the timelines differ. Removals and changes to "unresolved" keep what sessions
// already resolved, like a `null` price.
export let nameTrigger = (d: {
  before: Name | null;
  after: Name | null;
  now: Date;
}): KnowledgeTrigger | null => {
  if (!d.after) return null;

  let divergence = firstDivergence(d.before, d.after);
  if (divergence === null || divergence >= d.now.getTime()) return null;
  if (!targetsFrom(d.after, divergence).some(resolves)) return null;

  return { kind: 'name', filter: { modelRaws: [d.after.raw] }, from: fromTime(divergence) };
};

let modelOf = (target: NameTarget) =>
  target.kind == 'model' || target.kind == 'release' ? target.modelId : null;

// Sessions that resolved through a pointer carry the model it pointed at, so a pointer retarget
// rebuilds the slices of its old and new models from the point the timelines differ.
export let pointerTrigger = (d: {
  before: Pointer | null;
  after: Pointer | null;
  now: Date;
}): KnowledgeTrigger | null => {
  if (!d.before || !d.after) return null;

  let divergence = firstDivergence(d.before, d.after);
  if (divergence === null || divergence >= d.now.getTime()) return null;

  let modelIds = [
    ...targetsFrom(d.before, divergence),
    ...targetsFrom(d.after, divergence)
  ].flatMap(target => modelOf(target) ?? []);
  if (!modelIds.length) return null;

  return { kind: 'pointer', filter: { modelIds }, from: fromTime(divergence) };
};

// 08 §8: a price change reprices from the new period; a newly priced offering prices from its
// `firstSeenAt`, and its vendor model id can now resolve unresolved slices exactly.
export let priceTrigger = (period: OpenedPricePeriod): KnowledgeTrigger | null => {
  if (!period.modelId) return null;

  if (period.hadEarlierPeriod) {
    return {
      kind: 'offering',
      filter: { modelIds: [period.modelId] },
      from: period.validFrom
    };
  }

  let from =
    period.firstSeenAt && period.firstSeenAt < period.validFrom
      ? period.firstSeenAt
      : period.validFrom;

  return {
    kind: 'offering',
    filter: { modelIds: [period.modelId], modelRaws: [period.vendorModelId] },
    from
  };
};

// A relinked offering (08 §4.1) moves its price from one model to another back to its
// `firstSeenAt`.
export let offeringLinkTrigger = (d: {
  before: Offering | null;
  after: Offering | null;
}): KnowledgeTrigger | null => {
  if (!d.before || !d.after || d.before.modelId == d.after.modelId) return null;
  if (!d.before.pricing && !d.after.pricing) return null;

  let modelIds = [d.before.modelId, d.after.modelId].filter((id): id is string => !!id);
  let firstSeen = Date.parse(d.after.firstSeenAt);

  return {
    kind: 'offering',
    filter: {
      modelIds,
      ...(d.after.modelId ? { modelRaws: [d.after.vendorModelId] } : {})
    },
    from: fromTime(Number.isNaN(firstSeen) ? -Infinity : firstSeen)
  };
};

export let systemicImpact = (now: Date): RebuildImpact => ({
  filter: null,
  from: new Date(now.getTime() - systemicRebuildDays * dayMs).toISOString(),
  to: null
});

let isSystemic = (triggers: KnowledgeTrigger[]) => {
  let count = (kind: KnowledgeTrigger['kind']) =>
    triggers.filter(trigger => trigger.kind == kind).length;
  let models = new Set(triggers.flatMap(trigger => trigger.filter.modelIds ?? []));

  return (
    count('offering') > systemicImpactThreshold ||
    count('name') + count('pointer') > systemicImpactThreshold ||
    models.size > systemicImpactThreshold
  );
};

// Triggers starting at the same time share one impact. A diff touching more than the threshold
// is systemic (08 §8): one newest-first rebuild of the last days, older data waits for a manual
// run.
export let impactsFromTriggers = (d: {
  triggers: KnowledgeTrigger[];
  now: Date;
}): RebuildImpact[] => {
  let triggers = d.triggers.filter(
    trigger => trigger.from < d.now && !isEmptyRebuildFilter(trigger.filter)
  );
  if (!triggers.length) return [];
  if (isSystemic(triggers)) return [systemicImpact(d.now)];

  let byFrom = new Map<number, RebuildFilter>();

  for (let trigger of triggers) {
    let time = trigger.from.getTime();
    let existing = byFrom.get(time);
    byFrom.set(
      time,
      existing ? mergeRebuildFilters(existing, trigger.filter)! : trigger.filter
    );
  }

  return [...byFrom.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, filter]) => ({
      filter: normalizeRebuildFilter(filter),
      from: new Date(time).toISOString(),
      to: null
    }));
};

// An override change rebuilds what either version of it matched, over the union of both
// validities. `null` validTo runs up to now.
export let overrideImpact = (scopes: OverrideImpactScope[]): RebuildImpact | null => {
  if (!scopes.length) return null;

  let filter = scopes
    .map(scope => scope.filter)
    .reduce((merged, next) => mergeRebuildFilters(merged, next));
  if (filter && isEmptyRebuildFilter(filter)) return null;

  let from = Math.min(...scopes.map(scope => scope.validFrom.getTime()));
  let open = scopes.some(scope => !scope.validTo);
  let to = open ? null : Math.max(...scopes.map(scope => scope.validTo!.getTime()));

  return {
    filter,
    from: new Date(from).toISOString(),
    to: to === null ? null : new Date(to).toISOString()
  };
};

let loadOpenedPeriods = async (snapshotOid: bigint) =>
  (
    await db.$queryRawUnsafe<
      {
        modelId: string | null;
        vendorModelId: string;
        validFrom: Date;
        firstSeenAt: string | null;
        hadEarlierPeriod: boolean;
      }[]
    >(
      `SELECT p."modelId", o."vendorModelId", p."validFrom", o.data->>'firstSeenAt' AS "firstSeenAt",
         EXISTS (
           SELECT 1 FROM "KnowledgePricePeriod" e
           WHERE e."offeringOid" = p."offeringOid" AND e.oid <> p.oid AND e."validFrom" <= p."validFrom"
         ) AS "hadEarlierPeriod"
       FROM "KnowledgePricePeriod" p
       JOIN "KnowledgeOffering" o ON o.oid = p."offeringOid"
       WHERE p."openedBySnapshotOid" = $1`,
      snapshotOid
    )
  ).map(row => {
    let firstSeen = row.firstSeenAt ? Date.parse(row.firstSeenAt) : NaN;

    return {
      ...row,
      firstSeenAt: Number.isNaN(firstSeen) ? null : new Date(firstSeen)
    };
  });

// Price changes come from the periods a snapshot opened, not from here. Family, lab, vendor
// kind and agent maker moves need no rebuild: usage queries map them at query time.
export let changeTrigger = (
  change: { entity: string; before: unknown; after: unknown },
  now: Date
): KnowledgeTrigger | null => {
  if (change.entity == 'name') {
    return nameTrigger({
      before: (change.before ?? null) as Name | null,
      after: (change.after ?? null) as Name | null,
      now
    });
  }

  if (change.entity == 'pointer') {
    return pointerTrigger({
      before: (change.before ?? null) as Pointer | null,
      after: (change.after ?? null) as Pointer | null,
      now
    });
  }

  if (change.entity == 'offering') {
    return offeringLinkTrigger({
      before: (change.before ?? null) as Offering | null,
      after: (change.after ?? null) as Offering | null
    });
  }

  return null;
};

// The first ingest has no change log and everything in it is new, so it is always systemic.
export let loadSnapshotImpacts = async (d: { snapshotId: string; now: Date }) => {
  let snapshot = await db.knowledgeSnapshot.findUnique({ where: { id: d.snapshotId } });
  if (!snapshot || snapshot.status == 'rejected') return [];

  let bootstrap = await db.knowledgePricePeriod.findFirst({
    where: { openedBySnapshotOid: snapshot.oid, origin: 'bootstrap' },
    select: { oid: true }
  });
  if (bootstrap) return [systemicImpact(d.now)];

  let triggers = (await loadOpenedPeriods(snapshot.oid)).flatMap(
    period => priceTrigger(period) ?? []
  );
  let cursor: bigint | undefined;

  for (;;) {
    let changes = await db.knowledgeChange.findMany({
      where: {
        snapshotOid: snapshot.oid,
        entity: { in: ['offering', 'name', 'pointer'] },
        ...(cursor ? { oid: { gt: cursor } } : {})
      },
      orderBy: { oid: 'asc' },
      take: changePageSize,
      select: { oid: true, entity: true, before: true, after: true }
    });

    for (let change of changes) {
      let trigger = changeTrigger(change, d.now);
      if (trigger) triggers.push(trigger);
    }

    if (changes.length < changePageSize) break;
    cursor = changes[changes.length - 1]!.oid;
  }

  return impactsFromTriggers({ triggers, now: d.now });
};

let modelIdsWhere = async (where: { familyId: string } | { labId: string }) =>
  (await db.knowledgeModel.findMany({ where, select: { id: true } })).map(model => model.id);

// Slices matching what an override can price (08 §7). Filters are unions, so an offering or a
// vendor condition widens to its model; `null` (target `all`) matches every slice.
export let loadOverrideFilter = async (
  scope: Pick<PriceOverrideImpactScope, 'target' | 'targetId' | 'vendorId'>
): Promise<RebuildFilter | null> => {
  if (scope.target == 'all') return scope.vendorId ? { vendorIds: [scope.vendorId] } : null;
  if (!scope.targetId) return {};

  if (scope.target == 'model') return { modelIds: [scope.targetId] };
  if (scope.target == 'vendor') return { vendorIds: [scope.targetId] };
  if (scope.target == 'family')
    return { modelIds: await modelIdsWhere({ familyId: scope.targetId }) };
  if (scope.target == 'lab')
    return { modelIds: await modelIdsWhere({ labId: scope.targetId }) };

  if (scope.target == 'offering') {
    let offering = await db.knowledgeOffering.findUnique({
      where: { id: scope.targetId },
      select: { modelId: true }
    });

    return offering?.modelId ? { modelIds: [offering.modelId] } : {};
  }

  let agent = await db.knowledgeAgent.findUnique({
    where: { id: scope.targetId },
    select: { id: true, aliasKeys: true, data: true }
  });
  if (!agent) return {};

  return { clientFamilies: [agent.id, ...agent.aliasKeys, ...(agent.data.aliases ?? [])] };
};

export let loadCorrectionImpacts = async (d: {
  offeringId: string;
  from: Date;
  to: Date | null;
}): Promise<RebuildImpact[]> => {
  let offering = await db.knowledgeOffering.findUnique({
    where: { id: d.offeringId },
    select: { modelId: true }
  });
  if (!offering?.modelId) return [];

  return [
    {
      filter: { modelIds: [offering.modelId] },
      from: d.from.toISOString(),
      to: d.to?.toISOString() ?? null
    }
  ];
};
