import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  Transport,
  TransportSendOptions
} from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  type MessageExtraInfo
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerConnection } from '../../../prisma/generated/client';
import { ConnectionBackend } from '../backend';
import type { McpConnectionBackendAdapter } from './adapter';

let isMcpTraceEnabled = process.env.MCP_TRACE === 'true';
let mcpTraceLog = (...args: unknown[]) => {
  if (!isMcpTraceEnabled) return;
  console.log(`[${new Date().toISOString()}] [mcp-trace][embedded]`, ...args);
};

class McpTransport implements Transport {
  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?:
    | (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void)
    | undefined;

  constructor(private readonly adapter: McpConnectionBackendAdapter) {}

  async start() {
    mcpTraceLog('transport:start');
    this.adapter.messenger.onMessage(async msg => {
      mcpTraceLog('transport:message', { type: msg.type });
      try {
        if (msg.type == 'mcp.message') {
          await this.onmessage?.(msg.data);
        } else if (msg.type == 'close') {
          mcpTraceLog('transport:onclose');
          await this.onclose?.();
        }
      } catch (error) {
        mcpTraceLog('transport:listener-failed', error);
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions) {
    mcpTraceLog('transport:send', {
      method: 'method' in message ? message.method : undefined,
      id: 'id' in message ? (message as any).id : undefined
    });
    await this.adapter.sendMcpMessage(message);
  }

  async close() {
    mcpTraceLog('transport:close');
    await this.adapter.terminate();
  }
}

export class EmbeddedConnectionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'EmbeddedConnectionError';
  }
}

export class EmbeddedConnection {
  private constructor(
    private readonly adapter: McpConnectionBackendAdapter,
    public readonly client: Client
  ) {}

  static async create(connection: ServerConnection) {
    return new Promise<EmbeddedConnection>(async (resolve, reject) => {
      mcpTraceLog('create:start', {
        connectionOid: (connection as any).oid ?? null
      });
      let backend = await ConnectionBackend.create(connection);

      let cleanup = backend.messenger.onMessage(msg => {
        if (msg.type == 'error') {
          mcpTraceLog('create:error-message', msg.data);
          reject(new EmbeddedConnectionError(msg.data.code, msg.data.message));
        }
      });

      await backend.waitForInitialization();
      mcpTraceLog('create:backend-initialized');

      let client = new Client(connection.client);
      await client.connect(new McpTransport(backend));
      mcpTraceLog('create:client-connected');

      resolve(new EmbeddedConnection(backend, client));
      cleanup();
    });
  }

  private withErrorHandling<A extends any[], T>(fn: (...args: A) => Promise<T>) {
    return (...args: A) =>
      new Promise<T>(async (resolve, reject) => {
        let cleanup = this.adapter.messenger.onMessage(msg => {
          if (msg.type == 'error') {
            mcpTraceLog('op:error-message', msg.data);
            reject(new EmbeddedConnectionError(msg.data.code, msg.data.message));
          }
        });

        try {
          mcpTraceLog('op:start');
          resolve(await fn(...args));
          mcpTraceLog('op:success');
        } catch (e) {
          mcpTraceLog('op:failure', e);
          reject(e);
        } finally {
          cleanup();
        }
      });
  }

  terminate() {
    return this.adapter.terminate();
  }

  get connection() {
    return this.adapter.connection;
  }

  get getServerCapabilities() {
    return this.client.getServerCapabilities.bind(this.client);
  }
  get getServerVersion() {
    return this.client.getServerVersion.bind(this.client);
  }
  get getInstructions() {
    return this.client.getInstructions.bind(this.client);
  }

  get callTool(): typeof this.client.callTool {
    return this.withErrorHandling(this.client.callTool.bind(this.client));
  }
  get getPrompt(): typeof this.client.getPrompt {
    return this.withErrorHandling(this.client.getPrompt.bind(this.client));
  }
  get listPrompts(): typeof this.client.listPrompts {
    return this.withErrorHandling(this.client.listPrompts.bind(this.client));
  }
  get listResourceTemplates(): typeof this.client.listResourceTemplates {
    return this.withErrorHandling(this.client.listResourceTemplates.bind(this.client));
  }
  get listResources(): typeof this.client.listResources {
    return this.withErrorHandling(this.client.listResources.bind(this.client));
  }
  get listTools(): typeof this.client.listTools {
    return this.withErrorHandling(this.client.listTools.bind(this.client));
  }
}
