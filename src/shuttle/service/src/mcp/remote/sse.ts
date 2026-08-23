import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { getSentry } from '@lowerdeck/sentry';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ServerVersion, Tenant } from '../../../prisma/generated/browser';
import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  ServerInstanceConfiguration
} from '../../../prisma/generated/client';
import { safeFetch } from '../../lib/http/fetchSsrf';
import { safeParse } from '../../lib/safeParse';
import { fetchEventSource } from '../../lib/sse/fetch';
import type { McpConnectionBackendAdapter } from '../connection/adapter';
import { ConnectionManager } from '../utils/connection';
import {
  HttpResponseError,
  toConnectionError,
  type ConnectionErrorPayload
} from '../utils/connectionError';
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
      serverInstanceConfiguration: ServerInstanceConfiguration | null;
    }
  ) {
    if (!version.remoteUrl || version.remoteProtocol != 'sse') {
      throw new Error('Server version missing remote connection info');
    }

    this.logger = new ConnectionLogger(this.connection);
    this.messenger = new ConnectionMessenger();
    this.manager = new ConnectionManager(this.connection);

    this.#authManager = new RemoteConnectionAuthManager(this.logger, tenant, connection);

    // Initialization failures are reported through the messenger; waiters observe
    // them via waitForInitialization().
    this.#initPromise.promise.catch(() => {});
    this.init();
  }

  static async create(
    tenant: Tenant,
    version: ServerVersion,
    connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
      serverInstanceConfiguration: ServerInstanceConfiguration | null;
    }
  ) {
    return new SSERemoteConnection(tenant, version, connection);
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    if (this.#exiting) {
      await this.#emitError({
        code: 'connection_closed',
        message: 'The connection to the MCP server is shutting down'
      });
      return;
    }

    if (!this.#endpointUrl) {
      Sentry.captureException(
        new Error('Attempted to send MCP message before connection was initialized'),
        { extra: { messageId: 'id' in message ? message.id : undefined } }
      );
      await this.#emitError({
        code: 'initialize_failed',
        message: 'The MCP server did not provide an endpoint to send messages to'
      });
      return;
    }

    let response = await safeFetch(this.#endpointUrl, {
      method: 'POST',
      egressPolicy: this.connection.serverInstanceConfiguration
        ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null,
      headers: {
        ...(await this.getHeaders()),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (response.status >= 400) {
      let body = await response.text().catch(() => '');
      throw new HttpResponseError(response.status, response.statusText, body.slice(0, 1000));
    }
  }

  async #emitError(error: ConnectionErrorPayload) {
    await this.logger.log('debug.error', `SSE connection error: ${error.message}`);
    await this.messenger.sendToListeners({ type: 'error', data: error });
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
        egressPolicy: this.connection.serverInstanceConfiguration
          ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null,
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
          this.#initPromise.reject(err);
          await this.#emitError(toConnectionError(err));
          await this.terminate();
        },

        onclose: () => {
          this.#initPromise.reject(
            new Error('SSE stream closed before an endpoint was received')
          );
          this.messenger.sendToListeners({ type: 'close' });
        }
      });
    } catch (e) {
      this.#initPromise.reject(e);
      await this.#emitError(toConnectionError(e));
      await this.terminate();
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
