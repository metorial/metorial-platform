// Without tool details (OTEL_LOG_TOOL_DETAILS) Claude Code sends these in place of custom skill,
// MCP server and MCP tool names. Records stored before the dialect recognized them keep them.
export let claudeCodePlaceholderNames = {
  skills: ['custom_skill', 'custom', 'third-party'],
  mcpServers: ['custom'],
  mcpTools: ['mcp_tool', 'mcp_other']
} as const;

export let claudeCodeMainQuerySources = ['repl_main_thread', 'sdk', 'main'] as const;

// Records stored before the dialect knew these main-thread query sources carry them as the name
// of a subagent.
export let isClaudeCodeMainQuerySource = (value: string) =>
  (claudeCodeMainQuerySources as readonly string[]).includes(value) ||
  value.startsWith('repl_main_thread:');
