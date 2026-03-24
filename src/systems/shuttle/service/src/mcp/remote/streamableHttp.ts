import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ServerVersion, Tenant } from '../../../prisma/generated/browser';
import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection
} from '../../../prisma/generated/client';
import { safeParse } from '../../lib/safeParse';
import { fetchEventSource } from '../../lib/sse/fetch';
import type { McpConnectionBackendAdapter } from '../connection/adapter';
import { ConnectionManager } from '../utils/connection';
import { ConnectionLogger } from '../utils/logger';
import { ConnectionMessenger } from '../utils/messenger';
import { RemoteConnectionAuthManager } from './authManager';

const CLEANUP_TIMEOUT_MS = 30 * 1000;

export class StreamableHttpRemoteConnection implements McpConnectionBackendAdapter {
  readonly #authManager: RemoteConnectionAuthManager;

  readonly logger: ConnectionLogger;
  readonly messenger: ConnectionMessenger;
  readonly manager: ConnectionManager;

  readonly #abortController = new AbortController();

  #sessionId: string | null = null;

  #exited = false;
  #exiting = false;

  constructor(
    readonly tenant: Tenant,
    readonly version: ServerVersion,
    readonly connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
    }
  ) {
    if (!version.remoteUrl || version.remoteProtocol != 'streamable_http') {
      throw new Error('Server version missing remote connection info');
    }

    this.logger = new ConnectionLogger(this.connection);
    this.messenger = new ConnectionMessenger();
    this.manager = new ConnectionManager(this.connection);

    this.#authManager = new RemoteConnectionAuthManager(this.logger, tenant, connection);
  }

  static async create(
    tenant: Tenant,
    version: ServerVersion,
    connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
    }
  ) {
    return new StreamableHttpRemoteConnection(tenant, version, connection);
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    if (this.#exiting) {
      console.warn(
        'Attempted to send MCP message connection after container began exiting',
        message
      );
      return;
    }

    try {
      await fetchEventSource(this.version.remoteUrl!, {
        method: 'POST',
        headers: {
          ...(await this.getHeaders()),
          'Content-Type': 'application/json'
        },
        signal: this.#abortController.signal,
        handleNonStreamResponses: true,

        body: JSON.stringify(message),

        onopen: async response => {
          let sessionId = response.headers.get('Mcp-Session-Id');
          if (sessionId && !this.#sessionId) {
            await this.logger.log(
              'debug.error',
              `Received MCP session ID via streamable HTTP`
            );

            this.#sessionId = sessionId;
            this.init();
          }
        },

        onmessage: async event => {
          let data = safeParse(event.data) as JSONRPCMessage | null;
          if (!data) return;
          await this.messenger.sendToListeners({ type: 'mcp.message', data });
        },

        onerror: async err => {
          await this.messenger.sendToListeners({
            type: 'error',
            data: {
              code: 'connection_error',
              message: err?.message ?? 'Unknown connection error'
            }
          });
        }
      });
    } catch (e) {
      this.messenger.sendToListeners({
        type: 'error',
        data: {
          code: 'connection_error',
          message: (e as Error).message || 'Unknown connection error'
        }
      });
    }
  }

  async waitForInitialization() {}

  async terminate() {
    if (this.#exiting || this.#exited) return;
    this.#exiting = true;
    this.#exited = true;

    this.#abortController.abort();

    setTimeout(() => this.cleanup(), CLEANUP_TIMEOUT_MS);
  }

  private async getHeaders() {
    return {
      Accept: 'application/json, text/event-stream',
      ...(this.#sessionId ? { 'Mcp-Session-Id': this.#sessionId } : {}),
      ...(await this.#authManager.getHeaders())
    };
  }

  private async init() {
    try {
      this.logger.log(
        'debug.error',
        `Establishing notification connection via streamable HTTP`
      );

      await fetchEventSource(this.version.remoteUrl!, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: this.#abortController.signal,

        onmessage: async event => {
          let data = safeParse(event.data) as JSONRPCMessage | null;
          if (!data) return;
          await this.messenger.sendToListeners({ type: 'mcp.message', data });
        }
      });
    } catch (e) {
      this.logger.log(
        'debug.error',
        `streamable HTTP connection error: ${(e as Error).message || e}`
      );
    }
  }

  private async cleanup() {
    try {
      this.#abortController.abort();
    } catch {}

    await this.manager.close();
    await this.messenger.cleanup();
    await this.logger.flush();
  }
}
