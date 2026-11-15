import type { Catalog, NameTarget, Offering, TargetPeriod, TokenRates } from '../types';

export interface CatalogDiff {
  hasPrevious: boolean;
  newModels: string[];
  retiredModels: string[];
  newOfferings: string[];
  retiredOfferings: string[];
  newlyUnresolved: string[];
  priceChanges: { offeringId: string; before: TokenRates | null; after: TokenRates | null }[];
  retargetedNames: { nameId: string; from: NameTarget; to: NameTarget }[];
  retargetedPointers: { pointerId: string; from: NameTarget; to: NameTarget }[];
  liveOfferings: number;
  previousLiveOfferings: number;
  previousPricedOfferings: number;
  repricedOfferings: number;
}

let sameTarget = (a: NameTarget, b: NameTarget) => JSON.stringify(a) === JSON.stringify(b);

let byId = <T extends { id: string }>(items: T[]) =>
  new Map(items.map(item => [item.id, item]));

let advanceHistory = (
  history: TargetPeriod[],
  previousTarget: NameTarget | null,
  target: NameTarget,
  firstSeenAt: string,
  now: string,
  evidence: string
) => {
  let result = history.map(period => ({ ...period }));

  if (!result.length) {
    result.push({ target: previousTarget ?? target, from: firstSeenAt, to: null, evidence });
  }

  let open = result[result.length - 1]!;
  if (!sameTarget(open.target, target)) {
    open.to = now;
    result.push({ target, from: now, to: null, evidence });
  }

  return result;
};

let unresolved = (offering: Offering) => offering.resolution.method === 'unresolved';

let isLive = (offering: Offering) => offering.status !== 'retired';

let hasTextRates = (offering: Offering) =>
  (offering.pricing?.text?.input ?? null) !== null ||
  (offering.pricing?.text?.output ?? null) !== null;

let ratesChanged = (a: TokenRates | null | undefined, b: TokenRates | null | undefined) =>
  (a?.input ?? null) !== (b?.input ?? null) || (a?.output ?? null) !== (b?.output ?? null);

// Published IDs never disappear: anything the previous catalog had that this build lost is
// carried over as retired, and name/pointer targets keep a dated history across builds.
export let applyContinuity = (current: Catalog, previous: Catalog | null, now: string) => {
  let diff: CatalogDiff = {
    hasPrevious: !!previous,
    newModels: [],
    retiredModels: [],
    newOfferings: [],
    retiredOfferings: [],
    newlyUnresolved: [],
    priceChanges: [],
    retargetedNames: [],
    retargetedPointers: [],
    liveOfferings: current.offerings.filter(isLive).length,
    previousLiveOfferings: 0,
    previousPricedOfferings: 0,
    repricedOfferings: 0
  };

  if (!previous) {
    for (let name of current.names)
      name.history = [{ target: name.target, from: now, to: null, evidence: name.origin }];

    for (let pointer of current.pointers)
      pointer.history = [
        { target: pointer.target, from: now, to: null, evidence: pointer.evidence }
      ];

    return { catalog: current, diff };
  }

  let previousNames = byId(previous.names);
  for (let name of current.names) {
    let before = previousNames.get(name.id);
    if (before) {
      name.firstSeenAt = before.firstSeenAt;
      if (!sameTarget(before.target, name.target))
        diff.retargetedNames.push({ nameId: name.id, from: before.target, to: name.target });
    }

    name.history = advanceHistory(
      before?.history ?? [],
      before?.target ?? null,
      name.target,
      name.firstSeenAt,
      now,
      name.origin
    );
  }

  let previousPointers = byId(previous.pointers);
  for (let pointer of current.pointers) {
    let before = previousPointers.get(pointer.id);
    if (before && !sameTarget(before.target, pointer.target))
      diff.retargetedPointers.push({
        pointerId: pointer.id,
        from: before.target,
        to: pointer.target
      });

    pointer.history = advanceHistory(
      before?.history ?? [],
      before?.target ?? null,
      pointer.target,
      before?.history[0]?.from ?? now,
      now,
      pointer.evidence
    );
  }

  let previousLive = previous.offerings.filter(isLive);
  diff.previousLiveOfferings = previousLive.length;
  diff.previousPricedOfferings = previousLive.filter(hasTextRates).length;

  let previousOfferings = byId(previous.offerings);
  for (let offering of current.offerings) {
    let before = previousOfferings.get(offering.id);

    if (!before) diff.newOfferings.push(offering.id);
    else {
      offering.firstSeenAt = before.firstSeenAt;
      if (ratesChanged(before.pricing?.text, offering.pricing?.text)) {
        diff.priceChanges.push({
          offeringId: offering.id,
          before: before.pricing?.text ?? null,
          after: offering.pricing?.text ?? null
        });
        if (isLive(before) && hasTextRates(before)) diff.repricedOfferings++;
      }
    }

    if (unresolved(offering) && (!before || !unresolved(before)))
      diff.newlyUnresolved.push(offering.id);
  }

  let previousModels = byId(previous.models);
  diff.newModels = current.models
    .filter(model => !previousModels.has(model.id))
    .map(model => model.id);

  let carry = <T extends { id: string }>(
    items: T[],
    previousItems: T[],
    retire: (item: T) => T
  ) => {
    let ids = new Set(items.map(item => item.id));
    let carried = previousItems.filter(item => !ids.has(item.id)).map(retire);
    return { items: [...items, ...carried], carried };
  };

  let models = carry(current.models, previous.models, model => ({
    ...model,
    status: 'retired' as const,
    offeringCount: 0
  }));
  diff.retiredModels = models.carried
    .filter(model => previousModels.get(model.id)?.status !== 'retired')
    .map(model => model.id);

  let offerings = carry(current.offerings, previous.offerings, offering => ({
    ...offering,
    status: 'retired' as const
  }));
  diff.retiredOfferings = offerings.carried
    .filter(offering => previousOfferings.get(offering.id)?.status !== 'retired')
    .map(offering => offering.id);

  let names = carry(current.names, previous.names, name => ({
    ...name,
    status: 'gone' as const
  }));

  let catalog: Catalog = {
    ...current,
    organizations: carry(current.organizations, previous.organizations, org => ({
      ...org,
      status: 'retired' as const
    })).items,
    families: carry(current.families, previous.families, family => ({
      ...family,
      status: 'retired' as const
    })).items,
    models: models.items,
    releases: carry(current.releases, previous.releases, release => ({
      ...release,
      status: 'retired' as const
    })).items,
    pointers: carry(current.pointers, previous.pointers, pointer => pointer).items,
    vendors: carry(current.vendors, previous.vendors, vendor => ({
      ...vendor,
      status: 'retired' as const
    })).items,
    endpoints: carry(current.endpoints, previous.endpoints, endpoint => ({
      ...endpoint,
      status: 'retired' as const
    })).items,
    offerings: offerings.items,
    names: names.items
  };

  return { catalog, diff };
};
