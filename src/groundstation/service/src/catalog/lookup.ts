import { normalizeKey } from '@metorial/model-catalog/src/normalize/parseName';
import type {
  Catalog,
  LifecycleStatus,
  Name,
  NameTarget,
  Offering,
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

export type ResolvedModel = { modelId?: string; offering?: Offering };

export type ModelInfo = { familyId?: string; status: LifecycleStatus; isLatest: boolean };

export type CatalogIndex = {
  generatedAt: string;
  resolveModel: (d: {
    raw: string;
    provider?: string;
    family?: string;
    at: Date;
  }) => ResolvedModel;
  modelInfo: (modelId: string) => ModelInfo | undefined;
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

let push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  let list = map.get(key);

  if (list) list.push(value);
  else map.set(key, [value]);
};

export let vendorFor = (d: { provider?: string; family?: string }) => {
  if (d.provider) {
    let provider = d.provider.startsWith('other:') ? d.provider.slice(6) : d.provider;

    return providerVendors[provider] ?? provider;
  }

  return d.family ? familyVendors[d.family] : undefined;
};

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

// Mirrors `createNameLookup` from @metorial/model-catalog (exact namespaced id, then the raw string
// under any namespace, then the normalized key, as long as all matches agree), but evaluates every
// name and pointer at the request time instead of their current target.
export let createCatalogIndex = (catalog: Catalog): CatalogIndex => {
  let namesById = new Map(catalog.names.map(name => [name.id, name]));
  let namesByRaw = new Map<string, Name[]>();
  let namesByKey = new Map<string, Name[]>();

  for (let name of catalog.names) {
    if (name.target.kind == 'unresolved') continue;

    push(namesByRaw, name.raw, name);
    push(namesByKey, name.key, name);
  }

  let pointers = new Map(catalog.pointers.map(pointer => [pointer.id, pointer]));
  let models = new Map(catalog.models.map(model => [model.id, model]));
  let families = new Map((catalog.families ?? []).map(family => [family.id, family]));

  let offeringsByVendorModel = new Map<string, Offering>();
  let offeringsByModel = new Map<string, Offering[]>();

  for (let offering of catalog.offerings) {
    if (!offering.pricing?.text) continue;

    offeringsByVendorModel.set(`${offering.vendorId}:${offering.vendorModelId}`, offering);
    if (offering.modelId) push(offeringsByModel, offering.modelId, offering);
  }

  let firstPartyVendors = new Map<string, string>();

  for (let vendor of catalog.vendors) {
    if (vendor.kind == 'first-party' && !firstPartyVendors.has(vendor.organizationId)) {
      firstPartyVendors.set(vendor.organizationId, vendor.id);
    }
  }

  let agreed = (names: Name[] | undefined, at: Date): NameTarget | null => {
    if (!names?.length) return null;

    let targets = names.map(name => targetAt(name, at));
    let distinct = new Set(targets.map(target => JSON.stringify(target)));

    return distinct.size == 1 ? targets[0]! : null;
  };

  let lookupName = (raw: string, namespace: string | undefined, at: Date) => {
    if (namespace) {
      let exact = namesById.get(`${namespace}:${raw}`);

      if (exact) {
        let target = targetAt(exact, at);
        if (target.kind != 'unresolved') return target;
      }
    }

    return agreed(namesByRaw.get(raw), at) ?? agreed(namesByKey.get(normalizeKey(raw)), at);
  };

  let resolveTarget = (target: NameTarget | null, at: Date) => {
    let current = target;

    for (
      let depth = 0;
      current && current.kind == 'pointer' && depth < maxPointerDepth;
      depth++
    ) {
      let pointer = pointers.get(current.pointerId);
      current = pointer ? targetAt(pointer, at) : null;
    }

    if (current?.kind == 'release') {
      return { modelId: current.modelId, releaseId: current.releaseId };
    }

    if (current?.kind == 'model') return { modelId: current.modelId };

    return null;
  };

  let pickOffering = (d: { modelId: string; releaseId?: string; vendorId?: string }) => {
    let pool = offeringsByModel.get(d.modelId) ?? [];
    let labId = models.get(d.modelId)?.labId;
    let firstParty = labId ? firstPartyVendors.get(labId) : undefined;

    for (let vendorId of [d.vendorId, firstParty]) {
      if (!vendorId) continue;

      let candidates = pool.filter(offering => offering.vendorId == vendorId);
      if (!candidates.length) continue;

      return candidates.sort((a, b) =>
        compareRanks(offeringRank(a, d.releaseId), offeringRank(b, d.releaseId))
      )[0];
    }

    return undefined;
  };

  return {
    generatedAt: catalog.generatedAt,

    modelInfo: modelId => {
      let model = models.get(modelId);
      if (!model) return undefined;

      let family = model.familyId ? families.get(model.familyId) : undefined;

      return {
        ...(model.familyId ? { familyId: model.familyId } : {}),
        status: model.status,
        isLatest: family?.latestModelId == modelId
      };
    },

    resolveModel: d => {
      let vendorId = vendorFor(d);

      let exact = vendorId ? offeringsByVendorModel.get(`${vendorId}:${d.raw}`) : undefined;
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
