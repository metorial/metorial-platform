import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export let MODERN_PROTOCOL_VERSION = '2026-07-28';
export let SUPPORTED_SESSIONLESS_VERSIONS = [MODERN_PROTOCOL_VERSION];

export let MODERN_META_PREFIX = 'io.modelcontextprotocol/';

export let MODERN_META_KEYS = {
  protocolVersion: 'io.modelcontextprotocol/protocolVersion',
  clientCapabilities: 'io.modelcontextprotocol/clientCapabilities',
  clientInfo: 'io.modelcontextprotocol/clientInfo',
  logLevel: 'io.modelcontextprotocol/logLevel',
  serverInfo: 'io.modelcontextprotocol/serverInfo'
} as const;

export let MODERN_ERROR_CODES = {
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  headerMismatch: -32020,
  missingRequiredClientCapability: -32021,
  unsupportedProtocolVersion: -32022
} as const;

export let MODERN_REMOVED_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'logging/setLevel',
  'resources/subscribe',
  'resources/unsubscribe',
  'subscriptions/listen'
]);

export let MODERN_NAMED_METHODS: Record<string, 'name' | 'uri'> = {
  'tools/call': 'name',
  'prompts/get': 'name',
  'resources/read': 'uri'
};

export type ModernClientInfo = {
  name?: string;
  version?: string;
  title?: string;
  description?: string;
  websiteUrl?: string;
};

export type ModernRequestContext = {
  protocolVersion: string;
  clientCapabilities: Record<string, any>;
  clientInfo?: ModernClientInfo;
  logLevel?: string;
};

export type ModernServerInfo = {
  name: string;
  title: string;
  version: string;
  description: string;
};

export type ModernErrorResponse = {
  status: number;
  body: JSONRPCMessage;
};
