import { normalizeKey } from '@metorial/model-catalog/src/normalize/parseName';
import type {
  Catalog,
  LifecycleStatus,
  Name,
  NameTarget,
  Offering,
  Pointer,
  TargetPeriod
} from '@metorial/model-catalog/src/types';
import {
  pricePeriodAt,
  pricePeriodTimeline,
  type PricePeriod,
  type PricePeriodMatch
} from '../knowledge/periods';
import {
  catalogVendorDirectory,
  type AgentInfo,
  type VendorChoice,
  type VendorDirectory
} from './vendors';

let maxPointerDepth = 4;

let lifecycleRank: Record<string, number> = {
  active: 0,
  preview: 1,
  deprecated: 2,
  retired: 3
};

export type ModelRequest = {
  raw: string;
  provider?: string;
  family?: string;
  baseUrl?: string;
  subscription?: boolean;
};

// An offering with its price timeline. Removed offerings stay in the pool so their last price keeps
// applying (08 §6.1), but rank after live ones.
export type CatalogOffering = {
  offering: Offering;
  periods: PricePeriod[];
  removed?: boolean;
};

export type ModelMatch = {
  by: 'offering' | 'namespace' | 'raw' | 'key';
  nameIds: string[];
  pointerIds: string[];
};

export type ResolvedModel = {
  modelId?: string;
  releaseId?: string;
  match?: ModelMatch;
  agentId?: string;
  vendorId?: string;
  vendorSource?: VendorChoice['vendorSource'];
  offering?: Offering;
  period?: PricePeriod;
  priceAssumed?: boolean;
};

export type ModelInfo = {
  labId: string;
  familyId?: string;
  status: LifecycleStatus;
  isLatest: boolean;
};

export type ModelResolver = {
  resolveModel: (d: ModelRequest & { at: Date }) => ResolvedModel;
};

// `prepare` loads everything the given requests can resolve to, so the returned resolver answers
// synchronously. Requests that weren't prepared resolve to nothing.
export type CatalogIndex = {
  version: string;
  generatedAt: string;
  vendors: VendorDirectory;
  modelInfo: (modelId: string) => ModelInfo | undefined;
  prepare: (requests: ModelRequest[]) => Promise<ModelResolver>;
};

export type ResolutionSource = {
  namesByRaw: (raw: string) => Name[];
  namesByKey: (key: string) => Name[];
  pointer: (pointerId: string) => Pointer | undefined;
  labOf: (modelId: string) => string | undefined;
  offeringsByVendorModel: (vendorId: string, vendorModelId: string) => CatalogOffering[];
  offeringsByModel: (modelId: string) => CatalogOffering[];
  vendors: VendorDirectory;
};

type Timed = { target: NameTarget; history: TargetPeriod[] };

type PricedOffering = { entry: CatalogOffering; match: PricePeriodMatch };

type MatchedModel = {
  modelId: string;
  releaseId?: string;
  match: ModelMatch;
  exact: CatalogOffering[];
};

export let targetAt = (entry: Timed, at: Date): NameTarget => {
  let time = at.getTime();

  for (let period of entry.history) {
    let from = Date.parse(period.from);
    let to = period.to ? Date.parse(period.to) : Infinity;

    if (time >= from && time < to) return period.target;
  }

  let first = entry.history[0];
  if (first && time < Date.parse(first.from)) return first.target;

  return entry.target;
};

// The vendor named by the request itself (08 §9.3 steps 1 and 2).
export let requestVendor = (
  vendors: VendorDirectory,
  d: Pick<ModelRequest, 'provider' | 'baseUrl'>
): VendorChoice | undefined => {
  let reported = d.provider ? vendors.reportedVendor(d.provider) : undefined;
  if (reported) return { vendorId: reported, vendorSource: 'reported' };

  let endpoint = d.baseUrl ? vendors.endpointVendor(d.baseUrl) : undefined;
  if (endpoint) return { vendorId: endpoint, vendorSource: 'endpoint' };

  return undefined;
};

let agentVendorIds = (agent: AgentInfo, subscription: boolean | undefined) =>
  [...(subscription ? agent.subscriptionVendorIds : []), agent.defaultVendorId].filter(
    (vendorId): vendorId is string => !!vendorId
  );

// The vendor whose namespace and exact `vendor:model` offerings are tried first: the request's own
// vendor, otherwise the agent's.
export let vendorHint = (vendors: VendorDirectory, d: ModelRequest) => {
  let reported = requestVendor(vendors, d);
  if (reported) return reported.vendorId;

  let agent = d.family ? vendors.agent(d.family) : undefined;
  return agent ? agentVendorIds(agent, d.subscription)[0] : undefined;
};

let isDefaultVariant = (offering: Offering) =>
  !offering.variant.serving &&
  !offering.variant.region &&
  !offering.variant.quantization &&
  !offering.variant.free;

let offeringRank = (entry: CatalogOffering, releaseId: string | undefined) => [
  entry.removed ? 1 : 0,
  releaseId && entry.offering.releaseId == releaseId ? 0 : 1,
  isDefaultVariant(entry.offering) ? 0 : 1,
  entry.offering.kind == 'model' ? 0 : 1,
  lifecycleRank[entry.offering.status] ?? 4
];

let compareRanks = (a: number[], b: number[]) => {
  for (let index = 0; index < a.length; index++) {
    let diff = a[index]! - b[index]!;
    if (diff) return diff;
  }

  return 0;
};

let bestBy = <T>(items: T[], entryOf: (item: T) => CatalogOffering, releaseId?: string) =>
  [...items].sort((a, b) => {
    let left = entryOf(a);
    let right = entryOf(b);

    return (
      compareRanks(offeringRank(left, releaseId), offeringRank(right, releaseId)) ||
      (left.offering.id < right.offering.id
        ? -1
        : left.offering.id > right.offering.id
          ? 1
          : 0)
    );
  })[0];

// Priced at `at` means a period with text rates applies then, which keeps an offering whose
// upstream pricing went `null` priced while its period stays open (08 §6.1).
export let priceAt = (entry: CatalogOffering, at: Date) => {
  let match = pricePeriodAt(entry.periods, at);
  return match?.period.pricing.text ? match : null;
};

let pricedAt = (entries: CatalogOffering[], at: Date) =>
  entries.flatMap(entry => {
    let match = priceAt(entry, at);
    return match ? [{ entry, match }] : [];
  });

let allTargets = (entry: Timed) => [
  entry.target,
  ...entry.history.map(period => period.target)
];

// Every model a set of names can resolve to at any time, following pointers through their whole
// history. Used to prefetch offerings before resolving.
export let reachableModels = (
  names: Iterable<Timed>,
  pointer: (pointerId: string) => Pointer | undefined
) => {
  let models = new Set<string>();
  let visited = new Set<string>();
  let pending = [...names].flatMap(allTargets).map(target => ({ target, depth: 0 }));

  // Breadth-first, so each pointer is visited at its shortest depth.
  for (let index = 0; index < pending.length; index++) {
    let { target, depth } = pending[index]!;

    if (target.kind == 'model' || target.kind == 'release') models.add(target.modelId);
    if (
      target.kind != 'pointer' ||
      depth >= maxPointerDepth ||
      visited.has(target.pointerId)
    ) {
      continue;
    }

    visited.add(target.pointerId);

    let found = pointer(target.pointerId);
    if (found) {
      pending.push(...allTargets(found).map(next => ({ target: next, depth: depth + 1 })));
    }
  }

  return models;
};

// Mirrors `createNameLookup` from @metorial/model-catalog (exact namespaced id, then the raw string
// under any namespace, then the normalized key, as long as all matches agree), but evaluates every
// name and pointer at the request time instead of their current target. The vendor follows 08
// §9.3: reported, endpoint, exact offering, agent, then the lab's first-party vendor.
export let createResolver = (source: ResolutionSource): ModelResolver => {
  let agreed = (names: Name[], at: Date) => {
    let resolved = names.filter(name => name.target.kind != 'unresolved');
    if (!resolved.length) return null;

    let targets = resolved.map(name => targetAt(name, at));
    let distinct = new Set(targets.map(target => JSON.stringify(target)));
    if (distinct.size != 1) return null;

    return { target: targets[0]!, nameIds: resolved.map(name => name.id).sort() };
  };

  let lookupName = (raw: string, namespace: string | undefined, at: Date) => {
    let byRaw = source.namesByRaw(raw);

    if (namespace) {
      let exact = byRaw.find(name => name.namespace == namespace);

      if (exact) {
        let target = targetAt(exact, at);
        if (target.kind != 'unresolved') {
          return { by: 'namespace' as const, target, nameIds: [exact.id] };
        }
      }
    }

    let fromRaw = agreed(byRaw, at);
    if (fromRaw) return { by: 'raw' as const, ...fromRaw };

    let fromKey = agreed(source.namesByKey(normalizeKey(raw)), at);
    return fromKey ? { by: 'key' as const, ...fromKey } : null;
  };

  let resolveTarget = (target: NameTarget, at: Date) => {
    let current: NameTarget | null = target;
    let pointerIds: string[] = [];

    for (
      let depth = 0;
      current && current.kind == 'pointer' && depth < maxPointerDepth;
      depth++
    ) {
      pointerIds.push(current.pointerId);

      let pointer = source.pointer(current.pointerId);
      current = pointer ? targetAt(pointer, at) : null;
    }

    if (current?.kind == 'release') {
      return { modelId: current.modelId, releaseId: current.releaseId, pointerIds };
    }

    if (current?.kind == 'model') return { modelId: current.modelId, pointerIds };

    return null;
  };

  let matchModel = (
    d: ModelRequest & { at: Date },
    hint: string | undefined
  ): MatchedModel | null => {
    let exact = hint
      ? source
          .offeringsByVendorModel(hint, d.raw)
          .filter(entry => entry.offering.modelId && entry.offering.vendorId == hint)
      : [];

    let best =
      bestBy(pricedAt(exact, d.at), item => item.entry)?.entry ?? bestBy(exact, item => item);

    if (best?.offering.modelId) {
      return {
        modelId: best.offering.modelId,
        ...(best.offering.releaseId ? { releaseId: best.offering.releaseId } : {}),
        match: { by: 'offering', nameIds: [], pointerIds: [] },
        exact
      };
    }

    let named = lookupName(d.raw, hint ? `vendor:${hint}` : undefined, d.at);
    let resolved = named ? resolveTarget(named.target, d.at) : null;
    if (!named || !resolved) return null;

    return {
      modelId: resolved.modelId,
      ...(resolved.releaseId ? { releaseId: resolved.releaseId } : {}),
      match: { by: named.by, nameIds: named.nameIds, pointerIds: resolved.pointerIds },
      exact: []
    };
  };

  let chooseVendor = (d: {
    request: ModelRequest;
    reported: VendorChoice | undefined;
    agent: AgentInfo | undefined;
    modelId: string | undefined;
    pool: CatalogOffering[];
  }): VendorChoice | undefined => {
    if (d.reported) return d.reported;

    let exactVendors = new Set(
      d.pool
        .filter(entry => entry.offering.vendorModelId == d.request.raw)
        .map(entry => entry.offering.vendorId)
    );
    if (exactVendors.size == 1) {
      return { vendorId: [...exactVendors][0]!, vendorSource: 'offering' };
    }

    let offers = (vendorId: string) =>
      !d.modelId || d.pool.some(entry => entry.offering.vendorId == vendorId);
    let agentVendor = d.agent
      ? agentVendorIds(d.agent, d.request.subscription).find(offers)
      : undefined;
    if (agentVendor) return { vendorId: agentVendor, vendorSource: 'agent' };

    let labId = d.modelId ? source.labOf(d.modelId) : undefined;
    let firstParty = labId ? source.vendors.firstPartyVendor(labId) : undefined;
    if (firstParty) return { vendorId: firstParty, vendorSource: 'first-party' };

    return undefined;
  };

  // Another vendor's list price stands in when the chosen vendor has none, so the lab's first-party
  // offering is the last resort.
  let pickOffering = (d: {
    modelId: string;
    releaseId?: string;
    vendorId: string | undefined;
    exact: CatalogOffering[];
    pool: CatalogOffering[];
    at: Date;
  }): PricedOffering | undefined => {
    let labId = source.labOf(d.modelId);
    let firstParty = labId ? source.vendors.firstPartyVendor(labId) : undefined;

    let groups = [
      d.exact,
      ...[d.vendorId, firstParty].map(vendorId =>
        vendorId ? d.pool.filter(entry => entry.offering.vendorId == vendorId) : []
      )
    ];

    for (let group of groups) {
      let best = bestBy(pricedAt(group, d.at), item => item.entry, d.releaseId);
      if (best) return best;
    }

    return undefined;
  };

  return {
    resolveModel: d => {
      let reported = requestVendor(source.vendors, d);
      let agent = d.family ? source.vendors.agent(d.family) : undefined;
      let hint = vendorHint(source.vendors, d);

      let model = matchModel(d, hint);
      let pool = model
        ? [
            ...new Map(
              [...model.exact, ...source.offeringsByModel(model.modelId)].map(entry => [
                entry.offering.id,
                entry
              ])
            ).values()
          ]
        : [];
      let vendor = chooseVendor({
        request: d,
        reported,
        agent,
        modelId: model?.modelId,
        pool
      });

      let priced = model
        ? pickOffering({
            modelId: model.modelId,
            releaseId: model.releaseId,
            vendorId: vendor?.vendorId,
            exact: vendor?.vendorId == hint ? model.exact : [],
            pool,
            at: d.at
          })
        : undefined;

      return {
        ...(model
          ? {
              modelId: model.modelId,
              ...(model.releaseId ? { releaseId: model.releaseId } : {}),
              match: model.match
            }
          : {}),
        ...(agent ? { agentId: agent.id } : {}),
        ...(vendor ?? {}),
        ...(priced
          ? {
              offering: priced.entry.offering,
              period: priced.match.period,
              priceAssumed: priced.match.priceAssumed
            }
          : {})
      };
    }
  };
};

let push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  let list = map.get(key);

  if (list) list.push(value);
  else map.set(key, [value]);
};

export let modelInfoFrom = (d: {
  model: { labId: string; familyId: string | null; status: LifecycleStatus } | undefined;
  latestModelId: (familyId: string) => string | null | undefined;
  modelId: string;
}): ModelInfo | undefined => {
  if (!d.model) return undefined;

  return {
    labId: d.model.labId,
    ...(d.model.familyId ? { familyId: d.model.familyId } : {}),
    status: d.model.status,
    isLatest: !!d.model.familyId && d.latestModelId(d.model.familyId) == d.modelId
  };
};

let parseTime = (value: string | undefined) => {
  let time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : time;
};

// Without recorded history every priced offering gets one open period from its first sighting,
// confirmed at the catalog's `generatedAt`, the same as a first ingest.
let syntheticPeriods = (offering: Offering, generatedAt: Date): PricePeriod[] => {
  if (!offering.pricing) return [];

  let firstSeen = parseTime((offering as { firstSeenAt?: string }).firstSeenAt);

  return [
    {
      id: `catalog:${offering.id}`,
      pricing: offering.pricing,
      origin: 'bootstrap',
      closeReason: null,
      validFrom: new Date(firstSeen === null ? 0 : Math.min(firstSeen, generatedAt.getTime())),
      validTo: null,
      confirmedAt: generatedAt
    }
  ];
};

export let createCatalogIndex = (
  catalog: Catalog,
  options: { periods?: Record<string, PricePeriod[]> } = {}
): CatalogIndex & ModelResolver => {
  let namesByRaw = new Map<string, Name[]>();
  let namesByKey = new Map<string, Name[]>();

  for (let name of catalog.names) {
    push(namesByRaw, name.raw, name);
    push(namesByKey, name.key, name);
  }

  let pointers = new Map(catalog.pointers.map(pointer => [pointer.id, pointer]));
  let models = new Map(catalog.models.map(model => [model.id, model]));
  let families = new Map((catalog.families ?? []).map(family => [family.id, family]));
  let vendors = catalogVendorDirectory(catalog);
  let generatedAt = new Date(catalog.generatedAt);

  let offeringsByVendorModel = new Map<string, CatalogOffering[]>();
  let offeringsByModel = new Map<string, CatalogOffering[]>();

  for (let offering of catalog.offerings) {
    let entry: CatalogOffering = {
      offering,
      periods: pricePeriodTimeline(
        options.periods?.[offering.id] ?? syntheticPeriods(offering, generatedAt)
      )
    };

    push(offeringsByVendorModel, `${offering.vendorId}\0${offering.vendorModelId}`, entry);
    if (offering.modelId) push(offeringsByModel, offering.modelId, entry);
  }

  let resolver = createResolver({
    namesByRaw: raw => namesByRaw.get(raw) ?? [],
    namesByKey: key => namesByKey.get(key) ?? [],
    pointer: pointerId => pointers.get(pointerId),
    labOf: modelId => models.get(modelId)?.labId,
    offeringsByVendorModel: (vendorId, vendorModelId) =>
      offeringsByVendorModel.get(`${vendorId}\0${vendorModelId}`) ?? [],
    offeringsByModel: modelId => offeringsByModel.get(modelId) ?? [],
    vendors
  });

  return {
    version: catalog.generatedAt,
    generatedAt: catalog.generatedAt,
    vendors,
    modelInfo: modelId =>
      modelInfoFrom({
        model: models.get(modelId),
        latestModelId: familyId => families.get(familyId)?.latestModelId,
        modelId
      }),
    prepare: async () => resolver,
    resolveModel: resolver.resolveModel
  };
};
