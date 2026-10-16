export let ALLOW_ALL_TYPES = new Set(['allow_all', 'v1.allow_all']);
export let FILTER_TYPES = new Set(['filter', 'v1.filter']);

let TOOL_SCOPED_RULE_TYPES = new Set(['tool_keys', 'tool_categories', 'tool_regex']);

export let isToolScopedRuleType = (type: string) => TOOL_SCOPED_RULE_TYPES.has(type);

export let unique = (values: string[]) => Array.from(new Set(values));

export let getToolCategoryKeys = (tool: { toolCategoryKeys?: string[] | null }) =>
  unique(tool.toolCategoryKeys ?? []);

/** Tool regex rules match case-insensitively; an invalid pattern matches nothing. */
export let compileToolRegex = (pattern: string) => {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
};
