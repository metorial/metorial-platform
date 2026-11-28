// Without tool details (OTEL_LOG_TOOL_DETAILS) Claude Code sends these in place of custom skill,
// MCP server and MCP tool names.
export let claudeCodePlaceholderNames = {
  skills: ['custom_skill', 'custom', 'third-party'],
  mcpServers: ['custom'],
  mcpTools: ['mcp_tool', 'mcp_other']
} as const;

export let claudeCodeMainQuerySources = ['repl_main_thread', 'sdk', 'main'] as const;

export let claudeCodeBuiltInAgentTypes = ['general-purpose', 'Explore'] as const;

let claudeCodeAgentQueryPattern = /^agent[:.](builtin[:.])?/;

let placeholderMcpTools: readonly string[] = claudeCodePlaceholderNames.mcpTools;

let placeholderMcpServers: readonly string[] = claudeCodePlaceholderNames.mcpServers;

export let redactedMcpTool = claudeCodePlaceholderNames.mcpTools[0];

export let isMcpToolPlaceholder = (value: unknown) =>
  typeof value == 'string' && placeholderMcpTools.includes(value);

export let isMcpServerPlaceholder = (value: unknown) =>
  typeof value == 'string' && placeholderMcpServers.includes(value);

export let isClaudeCodeMainQuerySource = (value: string) =>
  (claudeCodeMainQuerySources as readonly string[]).includes(value) ||
  value.startsWith('repl_main_thread:');

export let claudeCodeAgentQuery = (querySource: string) => {
  let match = claudeCodeAgentQueryPattern.exec(querySource);

  return match
    ? { builtIn: match[1] !== undefined, type: querySource.slice(match[0].length) }
    : null;
};

export let isClaudeCodeBuiltInAgent = (d: {
  isBuiltIn?: unknown;
  querySource?: unknown;
  agentType?: unknown;
}) =>
  d.isBuiltIn === true ||
  d.isBuiltIn == 'true' ||
  (typeof d.querySource == 'string' && !!claudeCodeAgentQuery(d.querySource)?.builtIn) ||
  (typeof d.agentType == 'string' &&
    (claudeCodeBuiltInAgentTypes as readonly string[]).includes(d.agentType));
