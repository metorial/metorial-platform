import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

let MAX_CLIENT_CALL_ID_LENGTH = 256;
let UNSAFE_CHARACTER_PATTERN =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;

let CLAUDE_CODE_CALL_ID_KEY = 'claudecode/toolUseId';
let CODEX_CALL_ID_KEY = 'callId';
let CODEX_TURN_METADATA_KEY = 'x-codex-turn-metadata';
let CODEX_CLIENT_NAME = 'codex-mcp-client';

export let toolCallClientSources = ['claude-code', 'codex'] as const;

export type ToolCallClientSource = (typeof toolCallClientSources)[number];

export type ClientCall = { id: string; source: ToolCallClientSource };

let isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let getRequestMeta = (message: JSONRPCMessage) => {
  if (!('method' in message) || !isPlainObject(message.params)) return null;

  let meta = message.params._meta;
  return isPlainObject(meta) ? meta : null;
};

let toClientCallId = (value: unknown) =>
  typeof value === 'string' &&
  value.length >= 1 &&
  value.length <= MAX_CLIENT_CALL_ID_LENGTH &&
  !UNSAFE_CHARACTER_PATTERN.test(value)
    ? value
    : null;

export let readClientCall = (d: {
  message: JSONRPCMessage;
  clientName?: unknown;
}): ClientCall | null => {
  if (!('method' in d.message) || d.message.method !== 'tools/call') return null;

  let meta = getRequestMeta(d.message);
  if (!meta) return null;

  let claudeCodeId = toClientCallId(meta[CLAUDE_CODE_CALL_ID_KEY]);
  if (claudeCodeId) return { id: claudeCodeId, source: 'claude-code' };

  let isCodex =
    Object.hasOwn(meta, CODEX_TURN_METADATA_KEY) || d.clientName === CODEX_CLIENT_NAME;
  let codexId = isCodex ? toClientCallId(meta[CODEX_CALL_ID_KEY]) : null;
  if (codexId) return { id: codexId, source: 'codex' };

  return null;
};

export let stripCodexTurnMetadata = (message: JSONRPCMessage): JSONRPCMessage => {
  let field = 'method' in message ? 'params' : 'result' in message ? 'result' : null;
  if (!field) return message;

  let body = (message as Record<string, unknown>)[field];
  if (!isPlainObject(body) || !isPlainObject(body._meta)) return message;
  if (!Object.hasOwn(body._meta, CODEX_TURN_METADATA_KEY)) return message;

  let { [CODEX_TURN_METADATA_KEY]: _turnMetadata, ...meta } = body._meta;

  return { ...message, [field]: { ...body, _meta: meta } } as JSONRPCMessage;
};
