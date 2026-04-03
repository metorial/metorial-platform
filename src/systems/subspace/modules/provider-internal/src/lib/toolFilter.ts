import type { ProviderTool } from '@metorial-subspace/db';
import safeRegex from 'safe-regex2';

type ToolFilter = PrismaJson.ToolFilter;
type ToolFilterRule = Extract<ToolFilter, { type: 'v1.filter' }>['filters'][number];
type ToolFilterCarrier = {
  toolFilter?: ToolFilter | null;
  deployment?: {
    toolFilter?: ToolFilter | null;
  } | null;
  config?: {
    toolFilter?: ToolFilter | null;
  } | null;
  authConfig?: {
    toolFilter?: ToolFilter | null;
  } | null;
};
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

let getToolMatchKeys = (tool: ProviderTool) => {
  let matchKeys = [tool.key, tool.id, tool.callableId];

  if ('key' in tool.value && typeof tool.value.key === 'string') {
    matchKeys.push(tool.value.key);
  }

  return Array.from(new Set(matchKeys.filter((key): key is string => !!key)));
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
  providerConfigToolFilter?: ToolFilter | null;
  providerAuthConfigToolFilter?: ToolFilter | null;
  providerDeploymentToolFilter?: ToolFilter | null;
  sessionProviderToolFilter?: ToolFilter | null;
}) => {
  let providerConfigToolFilter = normalizeToolFilters(d.providerConfigToolFilter);
  let providerAuthConfigToolFilter = normalizeToolFilters(d.providerAuthConfigToolFilter);
  let providerDeploymentToolFilter = normalizeToolFilters(d.providerDeploymentToolFilter);
  let sessionProviderToolFilter = normalizeToolFilters(d.sessionProviderToolFilter);

  if (sessionProviderToolFilter.ignoreParentFilters) {
    return [sessionProviderToolFilter];
  }

  if (providerDeploymentToolFilter.ignoreParentFilters) {
    return [providerDeploymentToolFilter, sessionProviderToolFilter];
  }

  if (providerAuthConfigToolFilter.ignoreParentFilters) {
    return [
      providerAuthConfigToolFilter,
      providerDeploymentToolFilter,
      sessionProviderToolFilter
    ];
  }

  if (providerConfigToolFilter.ignoreParentFilters) {
    return [
      providerConfigToolFilter,
      providerAuthConfigToolFilter,
      providerDeploymentToolFilter,
      sessionProviderToolFilter
    ];
  }

  return [
    providerConfigToolFilter,
    providerAuthConfigToolFilter,
    providerDeploymentToolFilter,
    sessionProviderToolFilter
  ];
};

export let resolveSessionProviderToolFilterChain = (provider: ToolFilterCarrier) =>
  resolveToolFilterChain({
    providerConfigToolFilter: provider.config?.toolFilter,
    providerAuthConfigToolFilter: provider.authConfig?.toolFilter,
    providerDeploymentToolFilter: provider.deployment?.toolFilter,
    sessionProviderToolFilter: provider.toolFilter
  });

let matchesToolRule = (tool: ProviderTool, filter: ToolFilterRule) => {
  let mcpToolName: string | null = null;
  if (tool.value.mcpToolType.type === 'mcp.tool') mcpToolName = tool.value.mcpToolType.key;
  if (tool.value.mcpToolType.type === 'mcp.prompt') mcpToolName = tool.value.mcpToolType.key;
  let toolMatchKeys = getToolMatchKeys(tool);

  switch (filter.type) {
    case 'tool_keys':
      return (
        toolMatchKeys.some(key => filter.keys.includes(key)) ||
        (mcpToolName ? filter.keys.includes(mcpToolName) : false)
      );

    case 'tool_regex': {
      let regex = validateAndUseRegex(filter.pattern, 'i');
      return (
        toolMatchKeys.some(key => regex.test(key)) ||
        (mcpToolName ? regex.test(mcpToolName) : false)
      );
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
  filters: ToolFilter[] | ToolFilterCarrier,
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

export let checkResourceAccessManager = (filters: ToolFilter[] | ToolFilterCarrier) => {
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
