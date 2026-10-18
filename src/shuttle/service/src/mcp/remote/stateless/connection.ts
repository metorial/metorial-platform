import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ServerVersion, Tenant } from '../../../../prisma/generated/browser';
import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  ServerInstanceConfiguration
} from '../../../../prisma/generated/client';
import type { McpConnectionBackendAdapter } from '../../connection/adapter';
import { ConnectionManager } from '../../utils/connection';
import { ConnectionLogger } from '../../utils/logger';
import { ConnectionMessenger } from '../../utils/messenger';
import { RemoteConnectionAuthManager } from '../authManager';
import { StatelessMcpBridge } from './bridge';

let CLEANUP_TIMEOUT_MS = 30 * 1000;

export class StatelessRemoteConnection implements McpConnectionBackendAdapter {
  readonly #authManager: RemoteConnectionAuthManager;
  readonly #bridge: StatelessMcpBridge;

  readonly logger: ConnectionLogger;
  readonly messenger: ConnectionMessenger;
  readonly manager: ConnectionManager;

  #exited = false;

  constructor(
    readonly tenant: Tenant,
    readonly version: ServerVersion,
    readonly connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
      serverInstanceConfiguration: ServerInstanceConfiguration | null;
    }
  ) {
    if (!version.remoteUrl || version.remoteProtocol != 'stateless') {
      throw new Error('Server version missing remote connection info');
    }

    this.logger = new ConnectionLogger(this.connection, tenant);
    this.messenger = new ConnectionMessenger();
    this.manager = new ConnectionManager(this.connection);

    this.#authManager = new RemoteConnectionAuthManager(this.logger, tenant, connection);

    this.#bridge = new StatelessMcpBridge({
      url: version.remoteUrl,
      egressPolicy: connection.serverInstanceConfiguration
        ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null,
      getHeaders: () => this.#authManager.getHeaders(),
      emit: message => this.messenger.sendToListeners(message),
      log: (type, message) => this.logger.log(type, message)
    });
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
    return new StatelessRemoteConnection(tenant, version, connection);
  }

  sendMcpMessage(message: JSONRPCMessage) {
    return this.#bridge.handle(message);
  }

  async waitForInitialization() {}

  async terminate() {
    if (this.#exited) return;
    this.#exited = true;

    this.#bridge.close();

    setTimeout(() => this.cleanup(), CLEANUP_TIMEOUT_MS);
  }

  private async cleanup() {
    await this.manager.close();
    await this.messenger.cleanup();
    await this.logger.flush();
  }
}
