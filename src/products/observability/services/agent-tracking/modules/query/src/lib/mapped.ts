import type { DimensionMaps, DimensionModel } from '@mtsrc/agent-tracking-module-knowledge';
import type { FieldSource, MappedResolverName } from '../catalog';
import { escapeRegExp, or, type Predicate } from './predicate';

export type MappedContext = {
  maps: DimensionMaps;
  // Raw ids of unresolved documents in range, for expanding `model.lab` filters by hint.
  unresolvedRaws: string[];
  // Raw model names in range and their canonical model, for datasets that only store the raw name.
  rawModels?: Map<string, string | null>;
};

type MappedSource = Extract<FieldSource, { kind: 'mapped' }>;

export type Wanted = { has: (value: string) => boolean };

export let anyValue: Wanted = { has: () => true };

type MappedResolver = {
  map: (
    d: { value: string | null; raw: string | null },
    source: MappedSource,
    context: MappedContext
  ) => string | null;
  predicate: (
    wanted: Wanted,
    source: MappedSource & { array?: boolean },
    context: MappedContext
  ) => Predicate;
};

// Matches every raw `client.family` that `normalizeAgentKey` turns into `key`.
export let aliasKeyPattern = (key: string) =>
  `^\\s*(?:other:)?${key.split('-').map(escapeRegExp).join('(?:-|[\\s_.]+)')}\\s*$`;

let booleanValue = (value: boolean) => (value ? 'true' : 'false');

let modelIdOf = (
  value: string | null,
  source: { fromRaw?: boolean },
  context: MappedContext
) => {
  if (!value) return null;
  if (!source.fromRaw) return value;

  return context.rawModels?.get(value) ?? null;
};

let modelAttribute = (
  attribute: (model: DimensionModel, modelId: string, maps: DimensionMaps) => string | null,
  hint?: (raw: string, maps: DimensionMaps) => string | null
) => {
  let attributeOf = (modelId: string | null, maps: DimensionMaps) => {
    let model = modelId ? maps.models.get(modelId) : undefined;
    return model ? attribute(model, modelId!, maps) : null;
  };

  let resolver: MappedResolver = {
    map: ({ value, raw }, source, context) => {
      let modelId = modelIdOf(value, source, context);
      let mapped = attributeOf(modelId, context.maps);
      if (mapped !== null || !hint) return mapped;

      let rawValue = source.fromRaw ? value : raw;
      return !modelId && rawValue ? hint(rawValue, context.maps) : mapped;
    },
    predicate: (wanted, source, context) => {
      if (source.fromRaw) {
        let raws = [...(context.rawModels ?? new Map()).entries()]
          .filter(([raw, modelId]) => {
            let mapped = attributeOf(modelId, context.maps);
            if (mapped === null && !modelId && hint) mapped = hint(raw, context.maps);
            return mapped !== null && wanted.has(mapped);
          })
          .map(([raw]) => raw);

        return { t: 'cmp', path: source.base, op: 'in', value: raws, array: source.array };
      }

      let modelIds = [...context.maps.models.keys()].filter(modelId => {
        let mapped = attributeOf(modelId, context.maps);
        return mapped !== null && wanted.has(mapped);
      });
      let byId: Predicate = {
        t: 'cmp',
        path: source.base,
        op: 'in',
        value: modelIds,
        array: source.array
      };

      if (!hint || !source.raw) return byId;

      let hinted = context.unresolvedRaws.filter(raw => {
        let mapped = hint(raw, context.maps);
        return mapped !== null && wanted.has(mapped);
      });
      if (!hinted.length) return byId;

      return or([
        byId,
        {
          t: 'and',
          items: [
            { t: 'null', path: source.base },
            { t: 'cmp', path: source.raw, op: 'in', value: hinted }
          ]
        }
      ]);
    }
  };

  return resolver;
};

let agentPatterns = (maps: DimensionMaps, agentIds: Iterable<string>) =>
  [...agentIds].flatMap(agentId =>
    (maps.agents.get(agentId)?.aliasKeys ?? []).map(aliasKeyPattern)
  );

let agentResolver = (
  attribute: (agentId: string, maps: DimensionMaps) => string | null
): MappedResolver => ({
  map: ({ value }, _source, { maps }) => {
    let agentId = value ? maps.agentOf(value) : null;
    return agentId ? attribute(agentId, maps) : null;
  },
  predicate: (wanted, source, { maps }) => {
    let agentIds = [...maps.agents.keys()].filter(agentId => {
      let mapped = attribute(agentId, maps);
      return mapped !== null && wanted.has(mapped);
    });
    let patterns = agentPatterns(maps, agentIds);

    if (!patterns.length) return { t: 'const', value: false };

    return { t: 'regex', path: source.base, patterns, array: source.array };
  }
});

let resolvers: Record<MappedResolverName, () => MappedResolver> = {
  'model.family': () => modelAttribute(model => model.familyId),
  'model.lab': () =>
    modelAttribute(
      model => model.labId,
      (raw, maps) => maps.labHintOf(raw)
    ),
  'model.kind': () => modelAttribute(model => model.kind),
  'model.status': () => modelAttribute(model => model.status),
  'model.isLatest': () =>
    modelAttribute((_, modelId, maps) => booleanValue(maps.latestModelIds.has(modelId))),
  'model.openWeights': () => modelAttribute(model => booleanValue(model.openWeights)),
  'model.fromRaw': () => ({
    map: ({ value }, _source, context) =>
      value ? (context.rawModels?.get(value) ?? null) : null,
    predicate: (wanted, source, context) => ({
      t: 'cmp',
      path: source.base,
      op: 'in',
      value: [...(context.rawModels ?? new Map()).entries()]
        .filter(([, modelId]) => modelId && wanted.has(modelId))
        .map(([raw]) => raw)
    })
  }),
  'vendor.kind': () => ({
    map: ({ value }, _source, { maps }) =>
      value ? (maps.vendorKinds.get(value) ?? null) : null,
    predicate: (wanted, source, { maps }) => ({
      t: 'cmp',
      path: source.base,
      op: 'in',
      value: [...maps.vendorKinds].filter(([, kind]) => wanted.has(kind)).map(([id]) => id),
      array: source.array
    })
  }),
  agent: () => agentResolver(agentId => agentId),
  'agent.maker': () =>
    agentResolver((agentId, maps) => maps.agents.get(agentId)?.makerId ?? null)
};

let resolverCache = new Map<MappedResolverName, MappedResolver>();

let resolverOf = (name: MappedResolverName) => {
  let resolver = resolverCache.get(name);
  if (!resolver) {
    resolver = resolvers[name]();
    resolverCache.set(name, resolver);
  }

  return resolver;
};

export let mapValue = (
  source: MappedSource,
  d: { value: string | null; raw: string | null },
  context: MappedContext
) => resolverOf(source.resolver).map(d, source, context);

export let mappedPredicate = (
  source: MappedSource,
  wanted: string[] | Wanted,
  context: MappedContext,
  array?: boolean
) =>
  resolverOf(source.resolver).predicate(
    Array.isArray(wanted) ? new Set(wanted) : wanted,
    { ...source, array },
    context
  );

export let usesRawModels = (source: FieldSource) =>
  source.kind == 'mapped' && (source.fromRaw || source.resolver == 'model.fromRaw');

export let usesUnresolvedRaws = (source: FieldSource) =>
  source.kind == 'mapped' && source.resolver == 'model.lab' && !!source.raw;
