import type { DashboardInstanceSessionsMessagesGetOutput } from '@metorial/dashboard-sdk';
import type { AggregatedMessages } from '../session/hooks/useAggregatedMessages';
import type { MessagePayload, TransportMeta } from './types';

export let shorten = (id: string | number, length = 15) => {
  let s = String(id);
  if (s.length <= length) return s;
  return `${s.substring(0, length)}...`;
};

export let explorerCapabilityMethods = new Set([
  'initialize',
  'notifications/initialized',
  'prompts/list',
  'resources/list',
  'resources/templates/list',
  'tools/list'
]);

export let isPresentJsonValue = (value: any) => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

export let asRecord = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
};

export let formatRawJson = (value: unknown) =>
  JSON.stringify(value, null, 2) ?? String(value);

export let getMethodParams = (payload: Record<string, any> | null | undefined) =>
  asRecord(payload?.params);

export let getMethodResult = (payload: Record<string, any> | null | undefined) =>
  asRecord(payload?.result);

export let getDefaultSection = (
  payload: Record<string, any> | null | undefined,
  fallbackLabel: string
): { label: string; value: any } | null => {
  if (!payload) return null;

  if ('params' in payload && isPresentJsonValue(payload.params)) {
    return { label: 'Parameters', value: payload.params };
  }

  if ('result' in payload && isPresentJsonValue(payload.result)) {
    return { label: 'Result', value: payload.result };
  }

  let { id, jsonrpc, method, params, result, ...rest } = payload;

  if (isPresentJsonValue(rest)) {
    return { label: fallbackLabel, value: rest };
  }

  return null;
};

export let getMessagePayload = (
  message: DashboardInstanceSessionsMessagesGetOutput
): MessagePayload => (message.input ?? message.output ?? {}) as MessagePayload;

export let getMessageTransportMeta = (
  message: DashboardInstanceSessionsMessagesGetOutput
): TransportMeta => (message.transport?.mcp ?? null) as TransportMeta;

export let getDisplayName = (
  value: Record<string, any> | null | undefined,
  fallback: string,
  opts?: { preferName?: boolean }
) => {
  if (!value) return fallback;

  if (opts?.preferName) {
    return String(value.name ?? value.title ?? fallback);
  }

  return String(value.title ?? value.name ?? fallback);
};

export let flattenCapabilityDetails = (value: unknown, prefix = ''): string[] => {
  if (value == null || value === false) return [];
  if (value === true) return prefix ? [prefix] : [];

  if (Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  let record = asRecord(value);
  if (!record) return prefix ? [prefix] : [];

  let entries = Object.entries(record);
  if (entries.length === 0) return [];

  return entries.flatMap(([key, next]) =>
    flattenCapabilityDetails(next, prefix ? `${prefix}.${key}` : key)
  );
};

export let describeCapability = (value: unknown) => {
  let details = flattenCapabilityDetails(value);
  if (details.length === 0) return null;
  if (details.length <= 3) return details.join(', ');
  return `${details.slice(0, 3).join(', ')} +${details.length - 3} more`;
};

export let pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export let getSchemaPropertyCount = (schema: unknown) => {
  let properties = asRecord(asRecord(schema)?.properties);
  return properties ? Object.keys(properties).length : 0;
};

export let getSchemaRequiredCount = (schema: unknown) => {
  let required = asRecord(schema)?.required;
  return Array.isArray(required) ? required.length : 0;
};

export let getMessageMethod = (
  message: DashboardInstanceSessionsMessagesGetOutput,
  aggregatedMessages?: Map<string, AggregatedMessages>
) => {
  let transportMcp = message.transport?.mcp;
  let payload = getMessagePayload(message);
  let messageKey = String(payload.id ?? transportMcp?.id ?? message.id);
  let agg = aggregatedMessages?.get(messageKey);

  return (
    agg?.method ??
    (typeof message.input?.method === 'string'
      ? message.input.method
      : typeof payload.method === 'string'
        ? payload.method
        : undefined)
  );
};

export let isExplorerCapabilityMethod = (method?: string | null) =>
  !!method && explorerCapabilityMethods.has(method);

export let shouldRenderStandaloneMessage = (
  message: DashboardInstanceSessionsMessagesGetOutput,
  aggregatedMessages: Map<string, AggregatedMessages>
) => {
  let transportMcp = message.transport?.mcp;
  if (!transportMcp) return false;

  let payload = getMessagePayload(message);
  let messageKey = String(payload.id ?? transportMcp.id);
  let agg = aggregatedMessages.get(messageKey);

  return !(
    agg?.request &&
    agg?.response &&
    agg.response.id === message.id &&
    agg.request.id !== message.id
  );
};

let mimeTypeLanguageMap: Record<string, string> = {
  'application/json': 'json',
  'application/xml': 'xml',
  'application/yaml': 'yaml',
  'application/x-yaml': 'yaml',
  'application/javascript': 'javascript',
  'application/x-javascript': 'javascript',
  'application/typescript': 'typescript',
  'application/x-sh': 'bash',
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/html': 'html',
  'text/css': 'css',
  'text/xml': 'xml',
  'text/yaml': 'yaml',
  'text/x-yaml': 'yaml',
  'text/javascript': 'javascript',
  'text/typescript': 'typescript',
  'text/x-typescript': 'typescript',
  'text/x-python': 'python',
  'text/x-rust': 'rust',
  'text/x-go': 'go',
  'text/x-java': 'java',
  'text/x-c': 'c',
  'text/x-c++': 'cpp',
  'text/x-csharp': 'csharp',
  'text/x-ruby': 'ruby',
  'text/x-php': 'php',
  'text/x-swift': 'swift',
  'text/x-kotlin': 'kotlin',
  'text/x-scala': 'scala',
  'text/x-shellscript': 'bash',
  'text/x-sh': 'bash',
  'text/x-sql': 'sql',
  'text/csv': 'text',
  'text/tab-separated-values': 'text'
};

let uriExtensionLanguageMap: Record<string, string> = {
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  md: 'markdown',
  markdown: 'markdown',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  toml: 'toml',
  ini: 'ini',
  txt: 'text'
};

export let detectLanguage = (mimeType?: string | null, uri?: string | null) => {
  if (mimeType) {
    let normalized = mimeType.split(';')[0].trim().toLowerCase();
    if (mimeTypeLanguageMap[normalized]) return mimeTypeLanguageMap[normalized];
    if (normalized.startsWith('text/')) return 'text';
    if (normalized.endsWith('+json')) return 'json';
    if (normalized.endsWith('+xml')) return 'xml';
    if (normalized.endsWith('+yaml')) return 'yaml';
  }

  if (uri) {
    let withoutQuery = uri.split(/[?#]/)[0];
    let lastSegment = withoutQuery.split('/').pop() ?? '';
    let ext = lastSegment.includes('.')
      ? lastSegment.split('.').pop()?.toLowerCase()
      : undefined;
    if (ext && uriExtensionLanguageMap[ext]) return uriExtensionLanguageMap[ext];
  }

  return 'text';
};

export let isImageMime = (mimeType?: string | null) =>
  !!mimeType && mimeType.toLowerCase().startsWith('image/');

export let isAudioMime = (mimeType?: string | null) =>
  !!mimeType && mimeType.toLowerCase().startsWith('audio/');
