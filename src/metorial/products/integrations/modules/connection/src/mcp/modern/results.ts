import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import {
  MODERN_ERROR_CODES,
  MODERN_META_KEYS,
  type ModernErrorResponse,
  type ModernServerInfo
} from './types';

let LIST_RESULT_TTL_MS = 60_000;

let CACHEABLE_RESULT_TTL_MS: Record<string, number> = {
  'tools/list': LIST_RESULT_TTL_MS,
  'prompts/list': LIST_RESULT_TTL_MS,
  'resources/list': LIST_RESULT_TTL_MS,
  'resources/templates/list': LIST_RESULT_TTL_MS,
  'resources/read': 0,
  'server/discover': 0
};

let HTTP_STATUS_BY_ERROR_CODE: Record<number, number> = {
  [MODERN_ERROR_CODES.invalidRequest]: 400,
  [MODERN_ERROR_CODES.methodNotFound]: 404,
  [MODERN_ERROR_CODES.headerMismatch]: 400,
  [MODERN_ERROR_CODES.missingRequiredClientCapability]: 400,
  [MODERN_ERROR_CODES.unsupportedProtocolVersion]: 400
};

type JsonRpcId = string | number | null;

export let modernError = (d: {
  id: JsonRpcId | undefined;
  code: number;
  message: string;
  data?: unknown;
  status?: number;
}): ModernErrorResponse => ({
  status: d.status ?? HTTP_STATUS_BY_ERROR_CODE[d.code] ?? 400,
  body: {
    jsonrpc: '2.0',
    id: d.id ?? null,
    error: {
      code: d.code,
      message: d.message,
      ...(d.data === undefined ? {} : { data: d.data })
    }
  } as JSONRPCMessage
});

export let modernMethodNotFound = (id: JsonRpcId) =>
  modernError({
    id,
    code: MODERN_ERROR_CODES.methodNotFound,
    message: 'Method not found'
  }).body;

export let getModernHttpStatus = (message: JSONRPCMessage | null | undefined) => {
  if (!message || !('error' in message) || !message.error) return 200;
  return HTTP_STATUS_BY_ERROR_CODE[message.error.code] ?? 200;
};

export let decorateModernResponse = (d: {
  method: string | undefined;
  message: JSONRPCMessage;
  serverInfo: ModernServerInfo;
}): JSONRPCMessage => {
  if (!('result' in d.message) || !d.message.result) return d.message;

  let result = d.message.result as Record<string, any>;
  let ttlMs = d.method ? CACHEABLE_RESULT_TTL_MS[d.method] : undefined;

  return {
    ...d.message,
    result: {
      ...result,
      resultType: result.resultType ?? 'complete',
      ...(ttlMs === undefined
        ? {}
        : {
            ttlMs: result.ttlMs ?? ttlMs,
            cacheScope: result.cacheScope ?? 'private'
          }),
      _meta: {
        ...result._meta,
        [MODERN_META_KEYS.serverInfo]: d.serverInfo
      }
    }
  } as JSONRPCMessage;
};
