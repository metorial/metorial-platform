import type { DimensionMaps, DimensionModel } from '@mtsrc/agent-tracking-module-knowledge';

export type DimensionContext = {
  maps: DimensionMaps;
  // Raw ids of the unresolved slices in range, needed to expand a `model.lab` filter by hint.
  unresolvedRaws: string[];
};

export type DimensionResolver = {
  base: string;
  groupsUnresolvedRaw?: boolean;
  map: (d: { value: string | null; raw: string | null; maps: DimensionMaps }) => string | null;
  match: (values: string[], context: DimensionContext) => Record<string, unknown>;
};

let escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Matches every raw `client.family` that `normalizeAgentKey` turns into `key`.
export let aliasKeyPattern = (key: string) =>
  new RegExp(
    `^\\s*(?:other:)?${key.split('-').map(escapeRegExp).join('(?:-|[\\s_.]+)')}\\s*$`,
    'i'
  );

let booleanValue = (value: boolean) => (value ? 'true' : 'false');

let modelIdsWhere = (maps: DimensionMaps, predicate: (modelId: string) => boolean) =>
  [...maps.models.keys()].filter(predicate);

let modelAttribute = (
  attribute: (model: DimensionModel, modelId: string, maps: DimensionMaps) => string | null
): DimensionResolver => ({
  base: 'modelId',
  map: ({ value, maps }) => {
    let model = value ? maps.models.get(value) : undefined;
    return model ? attribute(model, value!, maps) : null;
  },
  match: (values, { maps }) => {
    let wanted = new Set(values);

    return {
      modelId: {
        $in: modelIdsWhere(maps, modelId => {
          let mapped = attribute(maps.models.get(modelId)!, modelId, maps);
          return mapped !== null && wanted.has(mapped);
        })
      }
    };
  }
});

let agentAliasPatterns = (maps: DimensionMaps, agentIds: Iterable<string>) =>
  [...agentIds].flatMap(agentId =>
    (maps.agents.get(agentId)?.aliasKeys ?? []).map(aliasKeyPattern)
  );

let agentResolver = (
  attribute: (agentId: string, maps: DimensionMaps) => string | null
): DimensionResolver => ({
  base: 'client.family',
  map: ({ value, maps }) => {
    let agentId = value ? maps.agentOf(value) : null;
    return agentId ? attribute(agentId, maps) : null;
  },
  match: (values, { maps }) => {
    let wanted = new Set(values);
    let agentIds = [...maps.agents.keys()].filter(agentId => {
      let mapped = attribute(agentId, maps);
      return mapped !== null && wanted.has(mapped);
    });

    return { 'client.family': { $in: agentAliasPatterns(maps, agentIds) } };
  }
});

let labResolver: DimensionResolver = {
  base: 'modelId',
  groupsUnresolvedRaw: true,
  map: ({ value, raw, maps }) => {
    if (value) return maps.models.get(value)?.labId ?? null;
    return raw ? maps.labHintOf(raw) : null;
  },
  match: (values, { maps, unresolvedRaws }) => {
    let wanted = new Set(values);
    let modelIds = modelIdsWhere(maps, modelId => wanted.has(maps.models.get(modelId)!.labId));
    let hinted = unresolvedRaws.filter(raw => {
      let hint = maps.labHintOf(raw);
      return hint !== null && wanted.has(hint);
    });

    if (!hinted.length) return { modelId: { $in: modelIds } };

    return {
      $or: [{ modelId: { $in: modelIds } }, { modelId: null, modelRaw: { $in: hinted } }]
    };
  }
};

export let dimensionResolvers: Record<string, DimensionResolver> = {
  'model.family': modelAttribute(model => model.familyId),
  'model.lab': labResolver,
  'model.kind': modelAttribute(model => model.kind),
  'model.status': modelAttribute(model => model.status),
  'model.isLatest': modelAttribute((_, modelId, maps) =>
    booleanValue(maps.latestModelIds.has(modelId))
  ),
  'model.openWeights': modelAttribute(model => booleanValue(model.openWeights)),

  'vendor.kind': {
    base: 'vendorId',
    map: ({ value, maps }) => (value ? (maps.vendorKinds.get(value) ?? null) : null),
    match: (values, { maps }) => {
      let wanted = new Set(values);

      return {
        vendorId: {
          $in: [...maps.vendorKinds].filter(([, kind]) => wanted.has(kind)).map(([id]) => id)
        }
      };
    }
  },

  agent: agentResolver(agentId => agentId),
  'agent.maker': agentResolver((agentId, maps) => maps.agents.get(agentId)?.makerId ?? null)
};

export let dimensionResolverOf = (field: string) =>
  Object.hasOwn(dimensionResolvers, field) ? dimensionResolvers[field] : undefined;
