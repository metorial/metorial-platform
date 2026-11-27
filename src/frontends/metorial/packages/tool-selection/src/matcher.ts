import {
  ALLOW_ALL_TYPES,
  compileToolRegex,
  FILTER_TYPES,
  getToolCategoryKeys,
  isToolScopedRuleType
} from './shared';

export type MatchableTool = {
  id?: string | null;
  key?: string | null;
  callableId?: string | null;
  name?: string | null;
  toolCategoryKeys?: string[] | null;
};

export type MatchableToolFilterRule = {
  type?: string;
  keys?: string[] | null;
  pattern?: string | null;
};

export type MatchableToolFilter = {
  type?: string;
  filters?: MatchableToolFilterRule[] | MatchableToolFilterRule | null;
};

let getToolMatchKeys = (tool: MatchableTool) =>
  Array.from(
    new Set(
      [tool.key, tool.id, tool.callableId, tool.name].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
    )
  );

let isLayer = (value: MatchableToolFilter | MatchableToolFilterRule) =>
  'filters' in value ||
  (!!value.type && (FILTER_TYPES.has(value.type) || ALLOW_ALL_TYPES.has(value.type)));

let getLayerRules = (layer: MatchableToolFilter) => {
  if (!layer.filters) return [];
  return Array.isArray(layer.filters) ? layer.filters : [layer.filters];
};

/** Bare rules (not wrapped in a filter layer) are OR'd together as one layer. */
let toLayers = (
  filters: (MatchableToolFilter | MatchableToolFilterRule | null | undefined)[]
): MatchableToolFilter[] => {
  let layers: MatchableToolFilter[] = [];
  let bareRules: MatchableToolFilterRule[] = [];

  for (let item of filters) {
    if (!item) continue;
    if (isLayer(item)) layers.push(item as MatchableToolFilter);
    else bareRules.push(item as MatchableToolFilterRule);
  }

  if (bareRules.length) layers.push({ type: 'filter', filters: bareRules });
  return layers;
};

let matchesRule = (
  rule: MatchableToolFilterRule,
  matchKeys: string[],
  categoryKeys: string[]
) => {
  let ruleKeys = Array.isArray(rule.keys) ? rule.keys : [];

  if (rule.type === 'tool_keys') {
    return matchKeys.some(key => ruleKeys.includes(key));
  }

  if (rule.type === 'tool_categories') {
    return categoryKeys.some(key => ruleKeys.includes(key));
  }

  let regex = rule.pattern ? compileToolRegex(rule.pattern) : null;
  return !!regex && matchKeys.some(key => regex.test(key));
};

/**
 * Mirrors the platform's tool access check for display purposes: rules inside one filter are
 * OR'd, filter layers are AND'd, and layers without tool rules do not restrict tools.
 */
export let isToolAllowedByFilters = (
  tool: MatchableTool,
  filters:
    | (MatchableToolFilter | MatchableToolFilterRule)[]
    | MatchableToolFilter
    | MatchableToolFilterRule
    | null
    | undefined
) => {
  if (!filters) return true;

  let layers = toLayers(Array.isArray(filters) ? filters : [filters]);
  let matchKeys = getToolMatchKeys(tool);
  let categoryKeys = getToolCategoryKeys(tool);

  for (let layer of layers) {
    if (layer.type && ALLOW_ALL_TYPES.has(layer.type)) continue;

    let toolRules = getLayerRules(layer).filter(
      rule => !!rule?.type && isToolScopedRuleType(rule.type)
    );
    if (toolRules.length === 0) continue;

    if (!toolRules.some(rule => matchesRule(rule, matchKeys, categoryKeys))) return false;
  }

  return true;
};
