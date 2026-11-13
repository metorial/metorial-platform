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

let maxPointerDepth = 4;

let providerVendors: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google-ai-studio',
  vertex: 'google-vertex',
  bedrock: 'aws-bedrock',
  azure: 'azure',
  github: 'github-copilot'
};

let familyVendors: Record<string, string> = {
  'claude-code': 'anthropic',
  codex: 'openai',
  'gemini-cli': 'google-ai-studio'
};

let lifecycleRank: Record<string, number> = {
  active: 0,
  preview: 1,
  deprecated: 2,
  retired: 3
};

export type ModelRequest = { raw: string; provider?: string; family?: string };

export type ResolvedModel = { modelId?: string; offering?: Offering };

export type ModelInfo = { familyId?: string; status: LifecycleStatus; isLatest: boolean };

export type ModelResolver = {
  resolveModel: (d: ModelRequest & { at: Date }) => ResolvedModel;
};

// `prepare` loads everything the given requests can resolve to, so the returned resolver answers
// synchronously. Requests that weren't prepared resolve to nothing.
export type CatalogIndex = {
  version: string;
  generatedAt: string;
  modelInfo: (modelId: string) => ModelInfo | undefined;
  prepare: (requests: ModelRequest[]) => Promise<ModelResolver>;
};

export type ResolutionSource = {
  namesByRaw: (raw: string) => Name[];
  namesByKey: (key: string) => Name[];
  pointer: (pointerId: string) => Pointer | undefined;
  labOf: (modelId: string) => string | undefined;
  pricedOfferingsByVendorModel: (vendorId: string, vendorModelId: string) => Offering[];
  pricedOfferingsByModel: (modelId: string) => Offering[];
  firstPartyVendor: (labId: string) => string | undefined;
};

type Timed = { target: NameTarget; history: TargetPeriod[] };

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

export let vendorFor = (d: { provider?: string; family?: string }) => {
  if (d.provider) {
    let provider = d.provider.startsWith('other:') ? d.provider.slice(6) : d.provider;

    return providerVendors[provider] ?? provider;
  }

  return d.family ? familyVendors[d.family] : undefined;
};

export let isPriced = (offering: Offering) => !!offering.pricing?.text;

let isDefaultVariant = (offering: Offering) =>
  !offering.variant.serving &&
  !offering.variant.region &&
  !offering.variant.quantization &&
  !offering.variant.free;

let offeringRank = (offering: Offering, releaseId: string | undefined) => [
  releaseId && offering.releaseId == releaseId ? 0 : 1,
  isDefaultVariant(offering) ? 0 : 1,
  offering.kind == 'model' ? 0 : 1,
  lifecycleRank[offering.status] ?? 4
];

let compareRanks = (a: number[], b: number[]) => {
  for (let index = 0; index < a.length; index++) {
    let diff = a[index]! - b[index]!;
    if (diff) return diff;
  }

  return 0;
};

let bestOffering = (offerings: Offering[], releaseId?: string) =>
  [...offerings].sort(
    (a, b) =>
      compareRanks(offeringRank(a, releaseId), offeringRank(b, releaseId)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )[0];

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
// name and pointer at the request time instead of their current target.
export let createResolver = (source: ResolutionSource): ModelResolver => {
  let agreed = (names: Name[], at: Date): NameTarget | null => {
    let resolved = names.filter(name => name.target.kind != 'unresolved');
    if (!resolved.length) return null;

    let targets = resolved.map(name => targetAt(name, at));
    let distinct = new Set(targets.map(target => JSON.stringify(target)));

    return distinct.size == 1 ? targets[0]! : null;
  };

  let lookupName = (raw: string, namespace: string | undefined, at: Date) => {
    let byRaw = source.namesByRaw(raw);

    if (namespace) {
      let exact = byRaw.find(name => name.namespace == namespace);

      if (exact) {
        let target = targetAt(exact, at);
        if (target.kind != 'unresolved') return target;
      }
    }

    return agreed(byRaw, at) ?? agreed(source.namesByKey(normalizeKey(raw)), at);
  };

  let resolveTarget = (target: NameTarget | null, at: Date) => {
    let current = target;

    for (
      let depth = 0;
      current && current.kind == 'pointer' && depth < maxPointerDepth;
      depth++
    ) {
      let pointer = source.pointer(current.pointerId);
      current = pointer ? targetAt(pointer, at) : null;
    }

    if (current?.kind == 'release') {
      return { modelId: current.modelId, releaseId: current.releaseId };
    }

    if (current?.kind == 'model') return { modelId: current.modelId };

    return null;
  };

  let pickOffering = (d: { modelId: string; releaseId?: string; vendorId?: string }) => {
    let pool = source.pricedOfferingsByModel(d.modelId);
    let labId = source.labOf(d.modelId);
    let firstParty = labId ? source.firstPartyVendor(labId) : undefined;

    for (let vendorId of [d.vendorId, firstParty]) {
      if (!vendorId) continue;

      let candidates = pool.filter(offering => offering.vendorId == vendorId);
      if (candidates.length) return bestOffering(candidates, d.releaseId);
    }

    return undefined;
  };

  return {
    resolveModel: d => {
      let vendorId = vendorFor(d);

      let exact = vendorId
        ? bestOffering(
            source.pricedOfferingsByVendorModel(vendorId, d.raw).filter(item => item.modelId)
          )
        : undefined;
      if (exact?.modelId) return { modelId: exact.modelId, offering: exact };

      let resolved = resolveTarget(
        lookupName(d.raw, vendorId ? `vendor:${vendorId}` : undefined, d.at),
        d.at
      );
      if (!resolved) return {};

      return {
        modelId: resolved.modelId,
        offering: pickOffering({ ...resolved, vendorId })
      };
    }
  };
};

let push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  let list = map.get(key);

  if (list) list.push(value);
  else map.set(key, [value]);
};

export let firstPartyVendors = (
  vendors: { id: string; organizationId: string; kind: string }[]
) => {
  let result = new Map<string, string>();

  for (let vendor of [...vendors].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (vendor.kind == 'first-party' && !result.has(vendor.organizationId)) {
      result.set(vendor.organizationId, vendor.id);
    }
  }

  return result;
};

export let modelInfoFrom = (d: {
  model: { familyId: string | null; status: LifecycleStatus } | undefined;
  latestModelId: (familyId: string) => string | null | undefined;
  modelId: string;
}): ModelInfo | undefined => {
  if (!d.model) return undefined;

  return {
    ...(d.model.familyId ? { familyId: d.model.familyId } : {}),
    status: d.model.status,
    isLatest: !!d.model.familyId && d.latestModelId(d.model.familyId) == d.modelId
  };
};

export let createCatalogIndex = (catalog: Catalog): CatalogIndex & ModelResolver => {
  let namesByRaw = new Map<string, Name[]>();
  let namesByKey = new Map<string, Name[]>();

  for (let name of catalog.names) {
    push(namesByRaw, name.raw, name);
    push(namesByKey, name.key, name);
  }

  let pointers = new Map(catalog.pointers.map(pointer => [pointer.id, pointer]));
  let models = new Map(catalog.models.map(model => [model.id, model]));
  let families = new Map((catalog.families ?? []).map(family => [family.id, family]));
  let firstParty = firstPartyVendors(catalog.vendors);

  let offeringsByVendorModel = new Map<string, Offering[]>();
  let offeringsByModel = new Map<string, Offering[]>();

  for (let offering of catalog.offerings) {
    if (!isPriced(offering)) continue;

    push(offeringsByVendorModel, `${offering.vendorId}\0${offering.vendorModelId}`, offering);
    if (offering.modelId) push(offeringsByModel, offering.modelId, offering);
  }

  let resolver = createResolver({
    namesByRaw: raw => namesByRaw.get(raw) ?? [],
    namesByKey: key => namesByKey.get(key) ?? [],
    pointer: pointerId => pointers.get(pointerId),
    labOf: modelId => models.get(modelId)?.labId,
    pricedOfferingsByVendorModel: (vendorId, vendorModelId) =>
      offeringsByVendorModel.get(`${vendorId}\0${vendorModelId}`) ?? [],
    pricedOfferingsByModel: modelId => offeringsByModel.get(modelId) ?? [],
    firstPartyVendor: labId => firstParty.get(labId)
  });

  return {
    version: catalog.generatedAt,
    generatedAt: catalog.generatedAt,
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
