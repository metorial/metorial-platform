import { badRequestError, ServiceError } from '@mtsrc/error';
import { ProgrammablePromise } from '@mtsrc/programmable-promise';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import PQueue from 'p-queue';
import type { ServerVersion, Tenant } from '../../../prisma/generated/browser';
import type {
  FunctionServer,
  ServerAuthConfig,
  ServerConfig,
  ServerConnection
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { snowflake } from '../../id';
import { callFunction, getFunctionCallLogs } from '../../lib/function/call';
import { secretService } from '../../services';
import type { McpConnectionBackendAdapter } from '../connection/adapter';
import { ConnectionManager } from '../utils/connection';
import { ConnectionLogger } from '../utils/logger';
import { ConnectionMessenger } from '../utils/messenger';
import { FunctionConnectionAuthManager } from './authManager';

const CLEANUP_TIMEOUT_MS = 30 * 1000;

export class FunctionConnection implements McpConnectionBackendAdapter {
  readonly #initPromise = new ProgrammablePromise<void>();
  readonly #authManager: FunctionConnectionAuthManager;
  readonly #processingQueue = new PQueue({ concurrency: 1 });

  readonly logger: ConnectionLogger;
  readonly messenger: ConnectionMessenger;
  readonly manager: ConnectionManager;

  readonly #abortController = new AbortController();

  #exited = false;
  #exiting = false;

  constructor(
    readonly tenant: Tenant,
    readonly version: ServerVersion,
    readonly connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
    },
    private readonly functionServer: FunctionServer,
    private readonly DECRYPTED_config_value: Record<string, unknown>
  ) {
    if (!version.functionServerOid) {
      throw new Error('Server version is missing function server OID');
    }

    this.logger = new ConnectionLogger(this.connection);
    this.messenger = new ConnectionMessenger();
    this.manager = new ConnectionManager(this.connection);

    this.#authManager = new FunctionConnectionAuthManager(this.logger, tenant, connection);

    setTimeout(() => this.#initPromise.resolve(), 5);
  }

  static async create(
    tenant: Tenant,
    version: ServerVersion,
    connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
    }
  ) {
    if (!version.functionServerOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Server version cannot be connected to'
        })
      );
    }

    let functionServer = await db.functionServer.findFirstOrThrow({
      where: { oid: version.functionServerOid }
    });

    let { transformed: config } = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: connection.serverConfig.secretOid,
      purpose: 'server_config_value',
      tenant
    });

    return new FunctionConnection(tenant, version, connection, functionServer, config);
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    if (this.#exiting) {
      console.warn(
        'Attempted to send MCP message connection after container began exiting',
        message
      );
      return;
    }

    let method = 'method' in message ? message.method : null;
    if (method?.startsWith('notifications/')) return;

    if ('method' in message && message.method == 'initialize') {
      let id = 'id' in message ? message.id : null;
      let params: any = 'params' in message && message.params ? message.params : null;

      await this.messenger.sendToListeners({
        type: 'mcp.message',
        data: {
          jsonrpc: '2.0' as const,
          id: id!,
          result: {
            protocolVersion: params?.protocolVersion ?? '2025-11-25',
            capabilities: this.functionServer.info.capabilities ?? {},
            serverInfo: this.functionServer.info.info ?? {},
            instructions: this.functionServer.info.instructions || undefined
          }
        }
      });

      return;
    }

    return await this.#processingQueue.add(async () => {
      let token = await this.#authManager.getToken();

      let res = await callFunction(this.functionServer, client =>
        client.handleMcpMessages({
          client: {
            client: this.connection.client,
            capabilities: this.connection.capabilities
          },
          config: this.DECRYPTED_config_value,
          authConfig: token ?? undefined,
          message: [message]
        })
      );

      (async () => {
        if (res.functionCallId) {
          await db.functionServerInvocation.create({
            data: {
              oid: snowflake.nextId(),
              isError: res.status == 'error',
              functionBayInvocationId: res.functionCallId,
              connectionOid: this.connection.oid,
              functionServerOid: this.functionServer.oid,
              tenantOid: this.tenant.oid
            }
          });

          let logs = await getFunctionCallLogs({
            server: this.functionServer,
            functionCallId: res.functionCallId
          });

          for (let logEntry of logs) {
            this.logger.log('stdout', logEntry.message, logEntry.timestamp);
          }
        }
      })().catch(() => {});

      if (res.status == 'error') {
        this.logger.log(
          'debug.error',
          `MCP message handling failed: ${res.error.code} - ${res.error.message}`
        );
        return;
      }

      for (let msg of res.result.messages) {
        await this.messenger.sendToListeners({
          type: 'mcp.message',
          data: msg
        });
      }
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

  private async cleanup() {
    try {
      this.#abortController.abort();
    } catch {}

    await this.manager.close();
    await this.messenger.cleanup();
    await this.logger.flush();
  }
}
