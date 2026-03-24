import type { ProviderDeployment, ProviderTool, SessionProvider } from '@metorial-subspace/db';
import safeRegex from 'safe-regex2';

type ToolFilter = PrismaJson.ToolFilter;
type ToolFilterRule = Extract<ToolFilter, { type: 'v1.filter' }>['filters'][number];
type ToolFilterCarrier = SessionProvider | ProviderDeployment;
type ToolFilterEnvelopeInput = {
  ignoreParentFilters?: boolean;
  filters?: ToolFilterRule | ToolFilterRule[] | null;
};

let allowAllFilter = (): ToolFilter => ({ type: 'v1.allow_all' });

let validateAndUseRegex = (pattern: string, flags?: string) => {
  if (!safeRegex(pattern)) {
    throw new Error('Potentially unsafe regex pattern detected');
  }
  return new RegExp(pattern, flags);
};

export let normalizeToolFilters = (
  input:
    | ToolFilter
    | ToolFilterRule
    | ToolFilterRule[]
    | ToolFilterEnvelopeInput
    | null
    | undefined
): ToolFilter => {
  if (!input) return allowAllFilter();

  if (
    typeof input === 'object' &&
    'type' in input &&
    (input.type === 'v1.allow_all' || input.type === 'v1.filter')
  ) {
    if (input.type === 'v1.allow_all') {
      return {
        type: 'v1.allow_all',
        ignoreParentFilters: input.ignoreParentFilters
      };
    }

    return {
      type: 'v1.filter',
      ignoreParentFilters: input.ignoreParentFilters,
      filters: input.filters
    };
  }

  let filters = typeof input === 'object' && 'filters' in input ? input.filters : input;

  let filterArray: ToolFilterRule[] = !filters
    ? []
    : (Array.isArray(filters) ? filters : [filters]).filter(
        (filter): filter is ToolFilterRule =>
          !!filter && typeof filter === 'object' && 'type' in filter
      );

  if (!filterArray.length) {
    return {
      type: 'v1.allow_all',
      ignoreParentFilters:
        typeof input === 'object' && 'ignoreParentFilters' in input
          ? input.ignoreParentFilters
          : undefined
    };
  }

  return {
    type: 'v1.filter',
    ignoreParentFilters:
      typeof input === 'object' && 'ignoreParentFilters' in input
        ? input.ignoreParentFilters
        : undefined,
    filters: filterArray
  };
};

export let resolveToolFilterChain = (d: {
  providerDeploymentToolFilter?: ToolFilter | null;
  sessionProviderToolFilter?: ToolFilter | null;
}) => {
  let providerDeploymentToolFilter = normalizeToolFilters(d.providerDeploymentToolFilter);
  let sessionProviderToolFilter = normalizeToolFilters(d.sessionProviderToolFilter);

  if (sessionProviderToolFilter.ignoreParentFilters) {
    return [sessionProviderToolFilter];
  }

  return [providerDeploymentToolFilter, sessionProviderToolFilter];
};

export let resolveSessionProviderToolFilterChain = (
  provider: ToolFilterCarrier & {
    deployment?: ToolFilterCarrier | null;
  }
) =>
  resolveToolFilterChain({
    providerDeploymentToolFilter: provider.deployment?.toolFilter,
    sessionProviderToolFilter: provider.toolFilter
  });

let matchesToolRule = (tool: ProviderTool, filter: ToolFilterRule) => {
  let mcpToolName: string | null = null;
  if (tool.value.mcpToolType.type === 'mcp.tool') mcpToolName = tool.value.mcpToolType.key;
  if (tool.value.mcpToolType.type === 'mcp.prompt') mcpToolName = tool.value.mcpToolType.key;

  switch (filter.type) {
    case 'tool_keys':
      return (
        filter.keys.includes(tool.key) ||
        filter.keys.includes(tool.id) ||
        (mcpToolName ? filter.keys.includes(mcpToolName) : false)
      );

    case 'tool_regex': {
      let regex = validateAndUseRegex(filter.pattern, 'i');
      return regex.test(tool.key) || regex.test(tool.id);
    }

    case 'prompt_keys':
      return !!mcpToolName && filter.keys.includes(mcpToolName);

    case 'prompt_regex':
      return !!mcpToolName && validateAndUseRegex(filter.pattern, 'i').test(mcpToolName);

    case 'resource_regex':
      return (
        tool.value.mcpToolType.type === 'mcp.resource_template' &&
        validateAndUseRegex(filter.pattern, 'i').test(tool.value.mcpToolType.uriTemplate)
      );

    case 'resource_uris':
      return false;
  }
};

let getRelevantToolRules = (tool: ProviderTool, filter: ToolFilter) => {
  if (filter.type !== 'v1.filter') return [];

  let mcpType = tool.value.mcpToolType.type;

  return filter.filters.filter(rule => {
    if (mcpType === 'mcp.resources_list' || mcpType === 'mcp.resources_read') {
      return false;
    }

    if (rule.type === 'tool_keys' || rule.type === 'tool_regex') {
      return mcpType === 'tool.callable' || mcpType === 'mcp.tool';
    }

    if (rule.type === 'prompt_keys' || rule.type === 'prompt_regex') {
      return mcpType === 'mcp.prompt';
    }

    if (rule.type === 'resource_regex') {
      return mcpType === 'mcp.resource_template';
    }

    return false;
  });
};

export let checkToolAccess = (
  tool: ProviderTool,
  filters: ToolFilter[] | (ToolFilterCarrier & { deployment?: ToolFilterCarrier | null }),
  _operation: 'list' | 'call'
) => {
  if (
    tool.value.mcpToolType.type === 'mcp.logging_setLevel' ||
    tool.value.mcpToolType.type === 'mcp.completion_complete'
  ) {
    return { allowed: false };
  }

  let filterChain = Array.isArray(filters)
    ? filters.map(normalizeToolFilters)
    : resolveSessionProviderToolFilterChain(filters);

  for (let filter of filterChain) {
    if (filter.type === 'v1.allow_all') continue;

    let relevantRules = getRelevantToolRules(tool, filter);
    if (!relevantRules.length) continue;
    if (!relevantRules.some(rule => matchesToolRule(tool, rule))) {
      return { allowed: false };
    }
  }

  return { allowed: true };
};

export let checkResourceAccessManager = (
  filters: ToolFilter[] | (ToolFilterCarrier & { deployment?: ToolFilterCarrier | null })
) => {
  let regexCache = new Map<string, RegExp>();
  let filterChain = Array.isArray(filters)
    ? filters.map(normalizeToolFilters)
    : resolveSessionProviderToolFilterChain(filters);

  return (resourceUri: string) => {
    for (let filter of filterChain) {
      if (filter.type === 'v1.allow_all') continue;

      let resourceRules = filter.filters.filter(
        rule => rule.type === 'resource_regex' || rule.type === 'resource_uris'
      );
      if (!resourceRules.length) continue;

      let allowed = resourceRules.some(rule => {
        if (rule.type === 'resource_uris') return rule.uris.includes(resourceUri);

        let regex = regexCache.get(rule.pattern);
        if (!regex) {
          regex = validateAndUseRegex(rule.pattern, 'i');
          regexCache.set(rule.pattern, regex);
        }

        return regex.test(resourceUri);
      });

      if (!allowed) return { allowed: false };
    }

    return { allowed: true };
  };
};
