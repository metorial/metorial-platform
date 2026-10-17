import { v } from '@lowerdeck/validation';
import type { JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { decodeMcpHeaderValue, type HeaderReader, validateModernHeaders } from './headers';
import { modernError } from './results';
import {
  MODERN_ERROR_CODES,
  MODERN_META_KEYS,
  MODERN_META_PREFIX,
  MODERN_PROTOCOL_VERSION,
  type ModernErrorResponse,
  type ModernRequestContext,
  SUPPORTED_SESSIONLESS_VERSIONS
} from './types';

let DATED_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let modernMetaValidator = v.object({
  protocolVersion: v.string(),
  clientCapabilities: v.record(v.any()),
  clientInfo: v.optional(
    v.object({
      name: v.optional(v.string()),
      version: v.optional(v.string()),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      websiteUrl: v.optional(v.string())
    })
  ),
  logLevel: v.optional(v.string())
});

export type ParsedModernMcpRequest =
  | {
      type: 'request';
      id: string | number;
      method: string;
      message: JSONRPCRequest;
      context: ModernRequestContext;
    }
  | { type: 'notification' }
  | { type: 'error'; error: ModernErrorResponse };

let isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let isModernVersion = (version: string | undefined) =>
  !!version && DATED_VERSION_PATTERN.test(version) && version >= MODERN_PROTOCOL_VERSION;

export let isModernMcpRequest = (d: { body: unknown; getHeader: HeaderReader }) => {
  if (isPlainObject(d.body) && d.body.method === 'initialize') return false;

  let headerVersion = decodeMcpHeaderValue(d.getHeader('mcp-protocol-version'));
  if (isModernVersion(headerVersion)) return true;

  if (!isPlainObject(d.body)) return false;

  return d.body.params?._meta?.[MODERN_META_KEYS.protocolVersion] !== undefined;
};

let stripModernMeta = (params: Record<string, any> | undefined) => {
  if (!isPlainObject(params) || !isPlainObject(params._meta)) return params;

  let meta = Object.fromEntries(
    Object.entries(params._meta).filter(([key]) => !key.startsWith(MODERN_META_PREFIX))
  );

  let { _meta, ...rest } = params;
  return Object.keys(meta).length ? { ...rest, _meta: meta } : rest;
};

export let parseModernMcpRequest = (d: {
  body: unknown;
  getHeader: HeaderReader;
}): ParsedModernMcpRequest => {
  if (!isPlainObject(d.body)) {
    return {
      type: 'error',
      error: modernError({
        id: null,
        code: MODERN_ERROR_CODES.invalidRequest,
        message: 'Request body must be a single JSON-RPC request'
      })
    };
  }

  let body = d.body;
  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return {
      type: 'error',
      error: modernError({
        id: body.id ?? null,
        code: MODERN_ERROR_CODES.invalidRequest,
        message: 'Invalid JSON-RPC request'
      })
    };
  }

  if (body.id === undefined || body.id === null) return { type: 'notification' };

  let id = body.id as string | number;
  let method = body.method;
  let rawMeta = isPlainObject(body.params?._meta) ? body.params._meta : {};

  let meta = modernMetaValidator.validate({
    protocolVersion: rawMeta[MODERN_META_KEYS.protocolVersion],
    clientCapabilities: rawMeta[MODERN_META_KEYS.clientCapabilities],
    clientInfo: rawMeta[MODERN_META_KEYS.clientInfo],
    logLevel: rawMeta[MODERN_META_KEYS.logLevel]
  });
  if (!meta.success) {
    return {
      type: 'error',
      error: modernError({
        id,
        code: MODERN_ERROR_CODES.invalidParams,
        message: 'Missing or invalid required request metadata',
        data: { errors: meta.errors },
        status: 400
      })
    };
  }

  let context: ModernRequestContext = meta.value;
  if (!SUPPORTED_SESSIONLESS_VERSIONS.includes(context.protocolVersion)) {
    return {
      type: 'error',
      error: modernError({
        id,
        code: MODERN_ERROR_CODES.unsupportedProtocolVersion,
        message: 'Unsupported protocol version',
        data: { supported: SUPPORTED_SESSIONLESS_VERSIONS, requested: context.protocolVersion }
      })
    };
  }

  let headerError = validateModernHeaders({
    getHeader: d.getHeader,
    id,
    method,
    params: body.params,
    protocolVersion: context.protocolVersion
  });
  if (headerError) return { type: 'error', error: headerError };

  let params = stripModernMeta(body.params);
  let message = {
    jsonrpc: '2.0',
    id,
    method,
    ...(params === undefined ? {} : { params })
  } as JSONRPCRequest;

  return { type: 'request', id, method, message, context };
};
