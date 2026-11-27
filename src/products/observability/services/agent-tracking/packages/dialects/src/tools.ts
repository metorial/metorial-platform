import {
  isMcpServerPlaceholder,
  isMcpToolPlaceholder,
  redactedMcpTool
} from '@mtsrc/agent-tracking-spec';
import { isFieldSource } from './fields';

export type ToolKind =
  'builtin' | 'mcp' | 'extension' | 'shell' | 'agent' | 'skill' | 'unknown';

export type ToolClass =
  | 'shell'
  | 'file_read'
  | 'file_write'
  | 'file_edit'
  | 'search'
  | 'web'
  | 'mcp'
  | 'agent'
  | 'other';

export type ToolRef = {
  name: string;
  kind: ToolKind;
  class: ToolClass;
  mcp?: { server: string; tool: string };
};

export type McpToolSignals = {
  name?: unknown;
  server?: unknown;
  namespace?: unknown;
  source?: unknown;
};

export type ToolHints = Omit<McpToolSignals, 'name'> & { mcpTool?: string; client?: string };

let maxToolNameLength = 128;
let mcpPrefix = 'mcp__';

export { redactedMcpTool };

export let redactedMcpNamespace = 'mcp';

let classByName: Record<string, ToolClass> = {
  bash: 'shell',
  shell: 'shell',
  powershell: 'shell',
  run_shell_command: 'shell',
  shell_command: 'shell',
  exec: 'shell',
  exec_command: 'shell',
  local_shell: 'shell',
  unified_exec: 'shell',
  'container.exec': 'shell',
  killshell: 'shell',
  bashoutput: 'shell',

  read: 'file_read',
  read_file: 'file_read',
  read_many_files: 'file_read',
  view: 'file_read',
  view_image: 'file_read',
  notebookread: 'file_read',

  write: 'file_write',
  write_file: 'file_write',
  create_file: 'file_write',

  edit: 'file_edit',
  multiedit: 'file_edit',
  notebookedit: 'file_edit',
  replace: 'file_edit',
  apply_patch: 'file_edit',
  str_replace_editor: 'file_edit',
  str_replace_based_edit_tool: 'file_edit',

  grep: 'search',
  glob: 'search',
  find: 'search',
  ls: 'search',
  list_dir: 'search',
  list_directory: 'search',
  search_file_content: 'search',
  codebase_search: 'search',
  toolsearch: 'search',
  tool_search: 'search',

  webfetch: 'web',
  web_fetch: 'web',
  websearch: 'web',
  web_search: 'web',
  google_web_search: 'web',

  agent: 'agent',
  task: 'agent',
  spawn_agent: 'agent',
  subagent: 'agent'
};

let classOf = (name: string): ToolClass | undefined => {
  let key = name.toLowerCase();

  return Object.hasOwn(classByName, key) ? classByName[key] : undefined;
};

let cleanName = (name: string) => {
  let cleaned = name.replace(/[\u0000-\u001f\u007f]/g, '').trim();

  return cleaned.length > maxToolNameLength ? cleaned.slice(0, maxToolNameLength) : cleaned;
};

export let parseMcpToolName = (name: string): { server: string; tool: string } | null => {
  if (!name.startsWith(mcpPrefix)) return null;

  let rest = name.slice(5);
  let separator = rest.indexOf('__');
  if (separator <= 0 || separator + 2 >= rest.length) return null;

  return { server: rest.slice(0, separator), tool: rest.slice(separator + 2) };
};

export let isMcpToolName = (value: unknown) =>
  typeof value == 'string' && value.includes('__');

export let hasMcpServer = (value: unknown) =>
  typeof value == 'string'
    ? value.length > 0
    : isFieldSource(value) && Object.keys(value).length > 0;

export let isMcpTool = (d: McpToolSignals) =>
  isMcpToolName(d.name) ||
  isMcpToolPlaceholder(d.name) ||
  hasMcpServer(d.server) ||
  d.source == redactedMcpNamespace ||
  d.namespace == redactedMcpNamespace ||
  isMcpToolName(d.namespace);

let splitMcpToolName = (name: string) => {
  if (name.startsWith(mcpPrefix)) return null;

  let separator = name.indexOf('__');
  if (separator <= 0 || separator + 2 >= name.length) return null;

  return { server: name.slice(0, separator), tool: name.slice(separator + 2) };
};

let serverNameOf = (value: unknown, client: string | undefined) =>
  typeof value == 'string' &&
  value.length > 0 &&
  !(client == 'claude-code' && isMcpServerPlaceholder(value))
    ? value
    : undefined;

export let classifyTool = (rawName: string, hints: ToolHints = {}): ToolRef => {
  let name = cleanName(rawName) || 'unknown';

  let server = serverNameOf(hints.server, hints.client);
  let parsed = server
    ? { server, tool: hints.mcpTool ?? name }
    : (parseMcpToolName(name) ?? splitMcpToolName(name));
  let reported = isMcpTool({
    server: hints.server,
    namespace: hints.namespace,
    source: hints.source
  });

  if (parsed || reported || isMcpToolPlaceholder(name) || name.startsWith(mcpPrefix)) {
    return {
      name,
      kind: 'mcp',
      class: 'mcp',
      ...(parsed
        ? { mcp: { server: cleanName(parsed.server), tool: cleanName(parsed.tool) } }
        : {})
    };
  }

  let toolClass = classOf(name);

  if (!toolClass) return { name, kind: 'unknown', class: 'other' };

  if (toolClass == 'shell') return { name, kind: 'shell', class: 'shell' };
  if (toolClass == 'agent') return { name, kind: 'agent', class: 'agent' };

  return { name, kind: 'builtin', class: toolClass };
};

export let isShellTool = (name: string | undefined) =>
  name !== undefined && classOf(name) == 'shell';
