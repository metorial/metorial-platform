import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { getSentry } from '@lowerdeck/sentry';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ServerVersion, Tenant } from '../../../prisma/generated/browser';
import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection
} from '../../../prisma/generated/client';
import { safeParse } from '../../lib/safeParse';
import { safeFetch } from '../../lib/http/fetchSsrf';
import { fetchEventSource } from '../../lib/sse/fetch';
import type { McpConnectionBackendAdapter } from '../connection/adapter';
import { ConnectionManager } from '../utils/connection';
import { ConnectionLogger } from '../utils/logger';
import { ConnectionMessenger } from '../utils/messenger';
import { RemoteConnectionAuthManager } from './authManager';

const CLEANUP_TIMEOUT_MS = 30 * 1000;

let Sentry = getSentry();

export class SSERemoteConnection implements McpConnectionBackendAdapter {
  readonly #initPromise = new ProgrammablePromise<void>();
  readonly #authManager: RemoteConnectionAuthManager;

  readonly logger: ConnectionLogger;
  readonly messenger: ConnectionMessenger;
  readonly manager: ConnectionManager;

  readonly #abortController = new AbortController();

  #endpointUrl: string | null = null;

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
    if (!version.remoteUrl || version.remoteProtocol != 'sse') {
      throw new Error('Server version missing remote connection info');
    }

    this.logger = new ConnectionLogger(this.connection);
    this.messenger = new ConnectionMessenger();
    this.manager = new ConnectionManager(this.connection);

    this.#authManager = new RemoteConnectionAuthManager(this.logger, tenant, connection);

    this.init();
  }

  static async create(
    tenant: Tenant,
    version: ServerVersion,
    connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
    }
  ) {
    return new SSERemoteConnection(tenant, version, connection);
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    if (this.#exiting) {
      console.warn(
        'Attempted to send MCP message connection after container began exiting',
        message
      );
      return;
    }

    if (!this.#endpointUrl) {
      console.warn('Attempted to send MCP message before connection was initialized', message);
      Sentry.captureException(
        new Error('Attempted to send MCP message before connection was initialized'),
        { extra: { message } }
      );
      return;
    }

    await safeFetch(this.#endpointUrl, {
      method: 'POST',
      egressPolicy:
        this.connection.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null,
      headers: {
        ...(await this.getHeaders()),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
  }

  waitForInitialization() {
    return this.#initPromise.promise;
  }

  async terminate() {
    if (this.#exiting || this.#exited) return;
    this.#exiting = true;
    this.#exited = true;

    this.#abortController.abort();

    setTimeout(() => this.cleanup(), CLEANUP_TIMEOUT_MS);
  }

  private async getHeaders() {
    return await this.#authManager.getHeaders();
  }

  private async getQuery() {
    return await this.#authManager.getQuery();
  }

  private async init() {
    this.logger.log(
      'debug.info',
      `Starting SSE remote connection to ${this.version.remoteUrl}`
    );

    try {
      let url = new URL(this.version.remoteUrl!);

      let query = await this.getQuery();
      for (let key in query) {
        if (typeof query[key] === 'string') url.searchParams.set(key, query[key]);
      }

      await fetchEventSource(url.toString(), {
        method: 'GET',
        egressPolicy:
          this.connection.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null,
        headers: await this.getHeaders(),

        signal: this.#abortController.signal,

        onmessage: async event => {
          if (event.event == 'endpoint') {
            let normalizedUrl = new URL(event.data, url.origin);

            this.#endpointUrl = normalizedUrl.toString();
            this.#initPromise.resolve();

            this.logger.log('debug.info', `Received MCP endpoint url via SSE`);

            return;
          }

          let data = safeParse(event.data) as JSONRPCMessage | null;
          if (!data) return;

          await this.messenger.sendToListeners({ type: 'mcp.message', data });
        },

        onerror: async err => {
          console.error('SSE connection error:', err);

          await this.logger.log('debug.error', `SSE connection error: ${err?.message || err}`);
          await this.messenger.sendToListeners({
            type: 'error',
            data: {
              code: 'connection_error',
              message: err?.message ?? 'Unknown connection error'
            }
          });

          await this.terminate();
        },

        onclose: () => {
          this.messenger.sendToListeners({ type: 'close' });
        }
      });
    } catch (e) {
      this.logger.log('debug.error', `SSE connection error: ${(e as Error).message || e}`);
      this.messenger.sendToListeners({
        type: 'error',
        data: {
          code: 'connection_error',
          message: (e as Error).message || 'Unknown connection error'
        }
      });
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
