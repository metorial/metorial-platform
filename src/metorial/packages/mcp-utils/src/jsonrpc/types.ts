export {
  InitializeRequestSchema,
  InitializeResultSchema,
  JSONRPCMessageSchema,
  type InitializedNotification,
  type InitializeRequest,
  type InitializeResult,
  type JSONRPCError,
  type JSONRPCMessage,
  type JSONRPCNotification,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type Prompt,
  type Resource,
  type ResourceTemplate,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';

import { InitializeRequest, InitializeResult } from '@modelcontextprotocol/sdk/types.js';

export type McpClient = InitializeRequest['params'];
export type McpServer = InitializeResult;
