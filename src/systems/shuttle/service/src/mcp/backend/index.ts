import { badRequestError, ServiceError } from '@mtsrc/error';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ServerConnection } from '../../../prisma/generated/browser';
import { db } from '../../db';
import type { McpConnectionBackendAdapter } from '../connection/adapter';
import { FunctionConnection } from '../function/connection';
import { HolopodConnection } from '../holopod/connection';
import { SSERemoteConnection } from '../remote/sse';
import { StreamableHttpRemoteConnection } from '../remote/streamableHttp';

export class ConnectionBackend implements McpConnectionBackendAdapter {
  private constructor(
    readonly connection: ServerConnection,
    private readonly backend: McpConnectionBackendAdapter
  ) {}

  get logger() {
    return this.backend.logger;
  }
  get messenger() {
    return this.backend.messenger;
  }

  static async create(_connection: ServerConnection) {
    let fullConnection = await db.serverConnection.findFirstOrThrow({
      where: { oid: _connection.oid },
      include: {
        serverConfig: true,
        serverAuthConfig: true
      }
    });

    let instance = await db.serverConfig.findFirstOrThrow({
      where: { oid: fullConnection.serverConfigOid },
      include: { tenant: true }
    });
    let serverVersion = await db.serverVersion.findFirstOrThrow({
      where: { oid: fullConnection.serverVersionOid, serverOid: instance.serverOid },
      include: {
        server: true,
        repositoryVersion: {
          include: {
            repository: { include: { registry: true } }
          }
        }
      }
    });

    if (serverVersion.server.type == 'container') {
      if (!serverVersion.repositoryVersion) {
        throw new Error('Server version missing repository version');
      }

      let backend = new HolopodConnection(
        instance.tenant,
        fullConnection,
        instance,
        serverVersion.repositoryVersion
      );
      return new ConnectionBackend(fullConnection, backend);
    }

    if (serverVersion.server.type == 'remote') {
      if (serverVersion.remoteProtocol == 'sse') {
        return new ConnectionBackend(
          fullConnection,
          await SSERemoteConnection.create(instance.tenant, serverVersion, fullConnection)
        );
      }

      if (serverVersion.remoteProtocol == 'streamable_http') {
        return new ConnectionBackend(
          fullConnection,
          await StreamableHttpRemoteConnection.create(
            instance.tenant,
            serverVersion,
            fullConnection
          )
        );
      }

      throw new ServiceError(
        badRequestError({
          message: 'Unsupported remote protocol for connection'
        })
      );
    }

    if (serverVersion.server.type == 'function') {
      return new ConnectionBackend(
        fullConnection,
        await FunctionConnection.create(instance.tenant, serverVersion, fullConnection)
      );
    }

    throw new ServiceError(
      badRequestError({
        message: 'Unsupported server type for connection'
      })
    );
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    try {
      return await this.backend.sendMcpMessage(message);
    } catch (err) {
      console.error('Error sending MCP message:', err);

      this.logger.log('debug.error', `Failed to send MCP message: ${(err as Error).message}`);
      throw err;
    }
  }

  waitForInitialization() {
    return this.backend.waitForInitialization();
  }

  terminate() {
    return this.backend.terminate();
  }
}
