import { generatePlainId } from '@lowerdeck/id';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import {
  InitializeResultSchema,
  type InitializeRequestParams,
  type JSONRPCMessage
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerConnection } from '../../../prisma/generated/client';
import { ConnectionBackend } from '../backend';
import type { ConnectionMessage } from '../utils/messenger';
import type { McpConnectionAdapter, McpConnectionBackendAdapter } from './adapter';

let isMcpTraceEnabled = process.env.MCP_TRACE === 'true';
let mcpTraceLog = (...args: unknown[]) => {
  if (!isMcpTraceEnabled) return;
  console.log(`[${new Date().toISOString()}] [mcp-trace][client]`, ...args);
};

export class ClientConnection implements McpConnectionAdapter {
  #listenerReady = false;
  readonly #initPromise = new ProgrammablePromise<void>();

  private constructor(private readonly adapter: McpConnectionBackendAdapter) {
    mcpTraceLog('ctor', {
      connectionOid: (this.adapter.connection as any).oid ?? null
    });
    this.init();
  }

  static async create(connection: ServerConnection) {
    return new ClientConnection(await ConnectionBackend.create(connection));
  }

  get connection() {
    return this.adapter.connection;
  }

  onMessage(listener: (msg: ConnectionMessage) => unknown) {
    return this.adapter.messenger.onMessage(m => {
      mcpTraceLog('onMessage', {
        type: m.type,
        listenerReady: this.#listenerReady
      });
      if (m.type == 'mcp.message' && !this.#listenerReady) return;
      return listener(m);
    });
  }

  waitForInitialization() {
    return this.#initPromise.promise;
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    mcpTraceLog('send:await-init', {
      id: 'id' in message ? (message as any).id : undefined,
      method: 'method' in message ? message.method : undefined
    });
    await this.#initPromise.promise;
    return this.adapter.sendMcpMessage(message);
  }

  async sendMcpMessageAndWait(message: JSONRPCMessage) {
    await this.#initPromise.promise;
    return this.sendMcpMessageAndWaitWithoutInit(message);
  }

  async terminate() {
    return this.adapter.terminate();
  }

  private async init() {
    try {
      mcpTraceLog('init:start');
      await this.adapter.waitForInitialization();
      mcpTraceLog('init:backend-ready');

      // Can't use sendMcpMessageAndWait here because init isn't finished yet
      let initResponseRaw = await this.sendMcpMessageAndWaitWithoutInit({
        jsonrpc: '2.0' as const,
        method: 'initialize',
        id: generatePlainId(10),
        params: {
          protocolVersion: '2025-06-18',
          capabilities: this.connection.capabilities,
          clientInfo: this.connection.client
        } satisfies InitializeRequestParams
      });
      let initResponse = InitializeResultSchema.safeParse((initResponseRaw as any).result);
      if (!initResponse.success) {
        mcpTraceLog('init:parse-failed', initResponse.error);
        this.adapter.logger.log(
          'debug.error',
          `Failed to parse initialize response: ${JSON.stringify(initResponse.error)}`
        );
        this.#initPromise.reject(
          new Error(`Failed to parse initialize response: ${JSON.stringify(initResponse.error)}`)
        );
        return;
      }

      this.#listenerReady = true;
      mcpTraceLog('init:listener-ready');

      await this.adapter.messenger.sendToListeners({
        type: 'initialized',
        data: initResponse.data
      });

      await this.adapter.sendMcpMessage({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });

      mcpTraceLog('init:complete');
      this.#initPromise.resolve();
    } catch (error) {
      mcpTraceLog('init:failed', error);
      this.#initPromise.reject(error);
    }
  }

  private async sendMcpMessageAndWaitWithoutInit(message: JSONRPCMessage) {
    if (!('id' in message)) return null;

    return new Promise<JSONRPCMessage>(async (resolve, reject) => {
      mcpTraceLog('wait-response:start', {
        id: (message as any).id,
        method: (message as any).method
      });
      let to = setTimeout(() => {
        mcpTraceLog('wait-response:timeout', { id: (message as any).id });
        reject(new Error('Timeout waiting for MCP response'));
        off();
      }, 30000);

      let off = this.adapter.messenger.onMessage(msg => {
        if (msg.type === 'error') {
          mcpTraceLog('wait-response:backend-error', {
            id: (message as any).id,
            code: msg.data.code
          });
          clearTimeout(to);
          off();
          reject(new Error(`Connection error (${msg.data.code}): ${msg.data.message}`));
          return;
        }
        if (msg.type === 'close') {
          mcpTraceLog('wait-response:connection-closed', { id: (message as any).id });
          clearTimeout(to);
          off();
          reject(new Error('Connection closed while waiting for MCP response'));
          return;
        }
        if (msg.type !== 'mcp.message') return;

        if ((msg.data as any).id === message.id) {
          mcpTraceLog('wait-response:matched', { id: (message as any).id });
          clearTimeout(to);
          off();
          resolve(msg.data);
        }
      });

      await this.adapter.sendMcpMessage(message);
      mcpTraceLog('wait-response:sent', { id: (message as any).id });
    });
  }
}
