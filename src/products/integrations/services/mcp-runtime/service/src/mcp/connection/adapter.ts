import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ServerConnection } from '../../../prisma/generated/client';
import type { ConnectionLogger } from '../utils/logger';
import type { ConnectionMessage, ConnectionMessenger } from '../utils/messenger';

export interface McpConnectionBackendAdapter {
  sendMcpMessage(message: JSONRPCMessage): Promise<void>;
  waitForInitialization(): Promise<void>;
  terminate(): Promise<void>;

  readonly logger: ConnectionLogger;
  readonly messenger: ConnectionMessenger;
  readonly connection: ServerConnection;
}

export interface McpConnectionAdapter {
  sendMcpMessage(message: JSONRPCMessage): Promise<void>;
  waitForInitialization(): Promise<void>;
  terminate(): Promise<void>;
  onMessage(listener: (msg: ConnectionMessage) => unknown): () => void;
  sendMcpMessageAndWait(message: JSONRPCMessage): Promise<JSONRPCMessage | null>;

  readonly connection: ServerConnection;
}
