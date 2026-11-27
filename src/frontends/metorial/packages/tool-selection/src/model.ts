import {
  ALLOW_ALL_TYPES,
  compileToolRegex,
  FILTER_TYPES,
  getToolCategoryKeys,
  isToolScopedRuleType,
  unique
} from './shared';

export type ToolAccessGroup = 'read' | 'write' | 'destructive';

export type ToolKeysRule = { type: 'tool_keys'; keys: string[] };
export type ToolCategoriesRule = { type: 'tool_categories'; keys: string[] };

/**
 * Any rule the editor does not manage itself (`tool_regex`, `prompt_*`, `resource_*`, or
 * rule types added later). These are kept verbatim so editing a filter never drops them.
 */
export type PreservedToolFilterRule = { type: string } & Record<string, unknown>;

export type ToolFilterRule = ToolKeysRule | ToolCategoriesRule | PreservedToolFilterRule;

export type ToolSelectionMode = 'all' | 'select';

export type ToolSelection = {
  mode: ToolSelectionMode;
  /** Dynamic category selections; tools added to these categories later are included. */
  categoryKeys: string[];
  toolKeys: string[];
  preservedRules: PreservedToolFilterRule[];
};

export type ToolSelectionToolInput = {
  key?: string | null;
  name?: string | null;
  description?: string | null;
  tags?: {
    readOnly?: boolean | null;
    read_only?: boolean | null;
    destructive?: boolean | null;
  } | null;
  toolCategoryKeys?: string[] | null;
};

export type ToolCategoryDefinition = {
  key: string;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
};

export type IndexedTool = {
  key: string;
  name: string;
  description: string | null;
  accessGroup: ToolAccessGroup;
  categoryKeys: string[];
};

export type IndexedToolCategory = {
  key: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  toolKeys: string[];
  /** False when the category was inferred from tool membership without a definition. */
  isDefined: boolean;
};

export type ToolIndex = {
  tools: IndexedTool[];
  toolsByKey: Map<string, IndexedTool>;
  /** Categories that contain at least one tool, in declared order. */
  categories: IndexedToolCategory[];
  /** Every known category, including definitions without tools in this version. */
  categoriesByKey: Map<string, IndexedToolCategory>;
  uncategorizedToolKeys: string[];
  /** True when at least one tool belongs to a category. */
  hasCategories: boolean;
};

export type ToolSelectionOptions = {
  /**
   * Collapse back to `all` once every tool is selected, unless the provider defines a
   * category without tools in this version. Defaults to true.
   */
  collapseToAll?: boolean;
};

let isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let getToolKey = (tool: ToolSelectionToolInput) => tool.key || tool.name || '';

export let createToolSelection = (
  mode: ToolSelectionMode = 'all',
  preservedRules: PreservedToolFilterRule[] = []
): ToolSelection => ({
  mode,
  categoryKeys: [],
  toolKeys: [],
  preservedRules
});

export let getToolAccessGroup = (
  tool: Pick<ToolSelectionToolInput, 'tags'>
): ToolAccessGroup => {
  if (tool.tags?.destructive) return 'destructive';
  if (tool.tags?.readOnly || tool.tags?.read_only) return 'read';
  return 'write';
};

export let buildToolIndex = (
  tools: ToolSelectionToolInput[],
  categoryDefinitions?: ToolCategoryDefinition[] | null
): ToolIndex => {
  let indexedTools: IndexedTool[] = [];
  let toolsByKey = new Map<string, IndexedTool>();

  for (let tool of tools) {
    let key = getToolKey(tool);
    if (!key || toolsByKey.has(key)) continue;

    let indexed: IndexedTool = {
      key,
      name: tool.name || key,
      description: tool.description ?? null,
      accessGroup: getToolAccessGroup(tool),
      categoryKeys: getToolCategoryKeys(tool)
    };

    indexedTools.push(indexed);
    toolsByKey.set(key, indexed);
  }

  let categoriesByKey = new Map<string, IndexedToolCategory>();

  for (let definition of categoryDefinitions ?? []) {
    if (!definition?.key || categoriesByKey.has(definition.key)) continue;

    categoriesByKey.set(definition.key, {
      key: definition.key,
      name: definition.name || definition.key,
      description: definition.description ?? null,
      imageUrl: definition.imageUrl || null,
      toolKeys: [],
      isDefined: true
    });
  }

  for (let tool of indexedTools) {
    for (let categoryKey of tool.categoryKeys) {
      let category = categoriesByKey.get(categoryKey);

      if (!category) {
        // Fallback when definitions are unavailable: name the category after its key.
        category = {
          key: categoryKey,
          name: categoryKey,
          description: null,
          imageUrl: null,
          toolKeys: [],
          isDefined: false
        };
        categoriesByKey.set(categoryKey, category);
      }

      category.toolKeys.push(tool.key);
    }
  }

  return {
    tools: indexedTools,
    toolsByKey,
    categories: Array.from(categoriesByKey.values()).filter(
      category => category.toolKeys.length > 0
    ),
    categoriesByKey,
    uncategorizedToolKeys: indexedTools
      .filter(tool => tool.categoryKeys.length === 0)
      .map(tool => tool.key),
    hasCategories: indexedTools.some(tool => tool.categoryKeys.length > 0)
  };
};

let toRule = (value: unknown): ToolFilterRule | null => {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  return value as ToolFilterRule;
};

let extractRules = (input: unknown): ToolFilterRule[] | null => {
  if (input === null || input === undefined) return null;

  if (Array.isArray(input)) {
    let rules: ToolFilterRule[] = [];

    for (let item of input) {
      if (isRecord(item) && typeof item.type === 'string' && ALLOW_ALL_TYPES.has(item.type)) {
        continue;
      }

      if (isRecord(item) && typeof item.type === 'string' && FILTER_TYPES.has(item.type)) {
        rules.push(...(extractRules(item) ?? []));
        continue;
      }

      let rule = toRule(item);
      if (rule) rules.push(rule);
    }

    return rules;
  }

  if (!isRecord(input)) return null;

  if (typeof input.type === 'string' && ALLOW_ALL_TYPES.has(input.type)) return null;

  if ((typeof input.type === 'string' && FILTER_TYPES.has(input.type)) || !input.type) {
    let filters = input.filters;
    if (filters === null || filters === undefined) return [];

    let list = Array.isArray(filters) ? filters : [filters];
    return list.map(toRule).filter((rule): rule is ToolFilterRule => !!rule);
  }

  let rule = toRule(input);
  return rule ? [rule] : null;
};

/**
 * Turns any stored tool filter shape into a `ToolSelection`:
 * `null`, `{type:'allow_all'}`, `{type:'filter', filters}`, a rule array, or a single rule.
 * An empty rule list means "all tools".
 */
export let hydrateToolSelection = (input: unknown): ToolSelection => {
  let rules = extractRules(input);
  if (!rules || rules.length === 0) return createToolSelection('all');

  let categoryKeys: string[] = [];
  let toolKeys: string[] = [];
  let preservedRules: PreservedToolFilterRule[] = [];
  let hasToolScopedRule = false;

  for (let rule of rules) {
    if (rule.type === 'tool_keys' && isStringArray(rule.keys)) {
      toolKeys.push(...rule.keys);
      hasToolScopedRule = true;
      continue;
    }

    if (rule.type === 'tool_categories' && isStringArray(rule.keys)) {
      categoryKeys.push(...rule.keys);
      hasToolScopedRule = true;
      continue;
    }

    if (isToolScopedRuleType(rule.type)) hasToolScopedRule = true;
    preservedRules.push(rule as PreservedToolFilterRule);
  }

  // A filter with only prompt/resource rules does not restrict tools.
  if (!hasToolScopedRule) return createToolSelection('all', preservedRules);

  return {
    mode: 'select',
    categoryKeys: unique(categoryKeys),
    toolKeys: unique(toolKeys),
    preservedRules
  };
};

/**
 * Serializes a selection into filter rules. Returns `null` when tools are unrestricted and
 * there are no other rules to keep.
 */
export let toToolFilterRules = (selection: ToolSelection): ToolFilterRule[] | null => {
  let nonToolRules = selection.preservedRules.filter(rule => !isToolScopedRuleType(rule.type));

  if (selection.mode === 'all') {
    return nonToolRules.length ? nonToolRules : null;
  }

  let hasToolScopedPreserved = selection.preservedRules.some(rule =>
    isToolScopedRuleType(rule.type)
  );
  let categoryKeys = unique(selection.categoryKeys);
  let toolKeys = unique(selection.toolKeys);
  let rules: ToolFilterRule[] = [];

  if (categoryKeys.length) {
    rules.push({ type: 'tool_categories', keys: categoryKeys });
  }

  // An empty rule list means "allow all", so an empty selection must still emit
  // `tool_keys: []` to deny every tool.
  if (toolKeys.length || (!categoryKeys.length && !hasToolScopedPreserved)) {
    rules.push({ type: 'tool_keys', keys: toolKeys });
  }

  rules.push(...selection.preservedRules);

  return rules;
};

export let isToolSelectionEmpty = (selection: ToolSelection) =>
  selection.mode === 'select' &&
  selection.categoryKeys.length === 0 &&
  selection.toolKeys.length === 0 &&
  !selection.preservedRules.some(rule => isToolScopedRuleType(rule.type));

/**
 * Request payload for a selection: `null` while tools are unrestricted, and a lone rule is
 * sent as a single object to keep the original payload shape. `emptySelection` decides what
 * a selection without any tools sends (`null` or `[]`).
 */
export let toToolFilterPayload = (
  selection: ToolSelection,
  opts: { emptySelection: 'all' | 'none' }
): ToolFilterRule | ToolFilterRule[] | null => {
  if (isToolSelectionEmpty(selection)) return opts.emptySelection === 'none' ? [] : null;

  let rules = toToolFilterRules(selection);
  if (!rules) return null;

  return rules.length === 1 ? rules[0] : rules;
};

let getCustomToolRegexes = (selection: ToolSelection) =>
  selection.preservedRules.flatMap(rule => {
    if (rule.type !== 'tool_regex' || typeof rule.pattern !== 'string') return [];

    let regex = compileToolRegex(rule.pattern);
    return regex ? [regex] : [];
  });

export let getSelectedToolKeySet = (selection: ToolSelection, index: ToolIndex) => {
  if (selection.mode === 'all') return new Set(index.tools.map(tool => tool.key));

  let toolKeys = new Set(selection.toolKeys);
  let categoryKeys = new Set(selection.categoryKeys);
  let regexes = getCustomToolRegexes(selection);
  let selected = new Set<string>();

  for (let tool of index.tools) {
    if (
      toolKeys.has(tool.key) ||
      tool.categoryKeys.some(key => categoryKeys.has(key)) ||
      regexes.some(regex => regex.test(tool.key))
    ) {
      selected.add(tool.key);
    }
  }

  return selected;
};

/** Tools selected only through a preserved custom rule; unchecking them has no effect. */
export let getCustomRuleToolKeySet = (selection: ToolSelection, index: ToolIndex) => {
  if (selection.mode === 'all') return new Set<string>();

  let regexes = getCustomToolRegexes(selection);
  if (!regexes.length) return new Set<string>();

  let toolKeys = new Set(selection.toolKeys);
  let categoryKeys = new Set(selection.categoryKeys);

  return new Set(
    index.tools
      .filter(
        tool =>
          !toolKeys.has(tool.key) &&
          !tool.categoryKeys.some(key => categoryKeys.has(key)) &&
          regexes.some(regex => regex.test(tool.key))
      )
      .map(tool => tool.key)
  );
};

export let isCategoryDynamicallySelected = (selection: ToolSelection, categoryKey: string) =>
  selection.mode === 'all' || selection.categoryKeys.includes(categoryKey);

export type ToolSectionMode = 'allow' | 'reject' | 'mixed';

export let getSectionMode = (
  toolKeys: string[],
  selectedToolKeys: Set<string>
): ToolSectionMode => {
  if (toolKeys.length === 0) return 'reject';

  let selectedCount = toolKeys.filter(key => selectedToolKeys.has(key)).length;
  if (selectedCount === 0) return 'reject';
  if (selectedCount === toolKeys.length) return 'allow';
  return 'mixed';
};

/** Selected categories and tools that do not exist in the indexed provider version. */
export let getMissingSelections = (selection: ToolSelection, index: ToolIndex) => {
  if (selection.mode === 'all' || index.tools.length === 0) {
    return { categoryKeys: [] as string[], toolKeys: [] as string[] };
  }

  return {
    categoryKeys: selection.categoryKeys.filter(
      key => !index.categoriesByKey.get(key)?.toolKeys.length
    ),
    toolKeys: selection.toolKeys.filter(key => !index.toolsByKey.has(key))
  };
};

let toAllSelection = (selection: ToolSelection): ToolSelection =>
  createToolSelection(
    'all',
    selection.preservedRules.filter(rule => !isToolScopedRuleType(rule.type))
  );

let getCategoryCoveredToolKeys = (index: ToolIndex, categoryKeys: string[]) => {
  let covered = new Set<string>();

  for (let key of categoryKeys) {
    for (let toolKey of index.categoriesByKey.get(key)?.toolKeys ?? []) covered.add(toolKey);
  }

  return covered;
};

// "All tools" also allows tools added later. A defined category without tools in this
// version can only gain tools later, so selecting every current tool must not grant those.
let canCollapseToAll = (index: ToolIndex) =>
  index.tools.length > 0 &&
  !Array.from(index.categoriesByKey.values()).some(category => category.toolKeys.length === 0);

let normalizeToolSelection = (
  selection: ToolSelection,
  index: ToolIndex,
  opts: ToolSelectionOptions = {}
): ToolSelection => {
  if (selection.mode === 'all') return toAllSelection(selection);

  let categoryKeys = unique(selection.categoryKeys);
  let covered = getCategoryCoveredToolKeys(index, categoryKeys);
  let next: ToolSelection = {
    mode: 'select',
    categoryKeys,
    // Explicit keys covered by a dynamic category are redundant.
    toolKeys: unique(selection.toolKeys).filter(key => !covered.has(key)),
    preservedRules: selection.preservedRules
  };

  if ((opts.collapseToAll ?? true) && canCollapseToAll(index)) {
    let selected = getSelectedToolKeySet(next, index);
    if (index.tools.every(tool => selected.has(tool.key))) return toAllSelection(next);
  }

  return next;
};

/**
 * Leaves `all` mode by selecting everything except `removedKeys`. Untouched categories stay
 * dynamic; the rest becomes explicit tool keys.
 */
let expandAllSelection = (
  selection: ToolSelection,
  index: ToolIndex,
  removedKeys: Set<string>
): ToolSelection => ({
  mode: 'select',
  categoryKeys: index.categories
    .filter(category => !category.toolKeys.some(key => removedKeys.has(key)))
    .map(category => category.key),
  toolKeys: index.tools.filter(tool => !removedKeys.has(tool.key)).map(tool => tool.key),
  preservedRules: selection.preservedRules.filter(rule => !isToolScopedRuleType(rule.type))
});

let removeTools = (
  selection: ToolSelection,
  index: ToolIndex,
  removedKeys: Set<string>
): ToolSelection => {
  if (selection.mode === 'all') return expandAllSelection(selection, index, removedKeys);

  let categoryKeys: string[] = [];
  let toolKeys = [...selection.toolKeys];

  for (let categoryKey of selection.categoryKeys) {
    let category = index.categoriesByKey.get(categoryKey);

    if (category && category.toolKeys.some(key => removedKeys.has(key))) {
      // There is no exclude rule, so a dynamic category that loses one tool degrades into
      // its remaining tools as explicit keys.
      toolKeys.push(...category.toolKeys);
      continue;
    }

    categoryKeys.push(categoryKey);
  }

  return {
    mode: 'select',
    categoryKeys,
    toolKeys: toolKeys.filter(key => !removedKeys.has(key)),
    preservedRules: selection.preservedRules
  };
};

export let checkTools = (
  selection: ToolSelection,
  index: ToolIndex,
  toolKeys: string[],
  opts?: ToolSelectionOptions
): ToolSelection => {
  if (selection.mode === 'all' || toolKeys.length === 0) return selection;

  return normalizeToolSelection(
    { ...selection, toolKeys: [...selection.toolKeys, ...toolKeys] },
    index,
    opts
  );
};

export let uncheckTools = (
  selection: ToolSelection,
  index: ToolIndex,
  toolKeys: string[],
  opts?: ToolSelectionOptions
): ToolSelection => {
  if (toolKeys.length === 0) return selection;

  return normalizeToolSelection(removeTools(selection, index, new Set(toolKeys)), index, opts);
};

export let setToolsChecked = (
  selection: ToolSelection,
  index: ToolIndex,
  toolKeys: string[],
  checked: boolean,
  opts?: ToolSelectionOptions
) =>
  checked
    ? checkTools(selection, index, toolKeys, opts)
    : uncheckTools(selection, index, toolKeys, opts);

export let allowCategory = (
  selection: ToolSelection,
  index: ToolIndex,
  categoryKey: string,
  opts?: ToolSelectionOptions
): ToolSelection => {
  if (selection.mode === 'all') return selection;

  return normalizeToolSelection(
    { ...selection, categoryKeys: [...selection.categoryKeys, categoryKey] },
    index,
    opts
  );
};

export let rejectCategory = (
  selection: ToolSelection,
  index: ToolIndex,
  categoryKey: string,
  opts?: ToolSelectionOptions
) =>
  uncheckTools(selection, index, index.categoriesByKey.get(categoryKey)?.toolKeys ?? [], opts);

export let setToolSelectionMode = (
  selection: ToolSelection,
  mode: ToolSelectionMode
): ToolSelection => {
  if (mode === selection.mode) return selection;
  if (mode === 'all') return toAllSelection(selection);
  return createToolSelection('select', selection.preservedRules);
};
