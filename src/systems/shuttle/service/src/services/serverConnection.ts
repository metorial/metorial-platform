import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { InitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type {
  Server,
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  ServerVersion,
  Tenant
} from '../../prisma/generated/client';
import { db, outputTypeMapper } from '../db';
import { getId, snowflake } from '../id';
import { offload } from '../lib/offload';
import { connectionLogsBucketRecord } from '../storage';

let include = {
  serverConfig: true,
  serverAuthConfig: true,
  serverVersion: true
};

class serverConnectionServiceImpl {
  async resolveServerConnectionParams(d: {
    tenant: Tenant;
    input: {
      serverConfig: ServerConfig;
      serverAuthConfig?: ServerAuthConfig;
      serverVersion: ServerVersion & { server: Server };
    };
  }) {
    if (
      (d.input.serverVersion.server.remoteOauthConfigOid && !d.input.serverAuthConfig) ||
      (d.input.serverVersion.server.delegatedOauthConfigOid && !d.input.serverAuthConfig)
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider requires OAuth authentication'
        })
      );
    }

    if (
      d.input.serverConfig.serverOid !== d.input.serverVersion.server.oid ||
      (d.input.serverAuthConfig &&
        d.input.serverAuthConfig.serverOid !== d.input.serverConfig.serverOid)
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Mismatched server configuration'
        })
      );
    }

    return {
      serverConfig: d.input.serverConfig,
      serverAuthConfig: d.input.serverAuthConfig,
      serverVersion: d.input.serverVersion,

      params: {
        serverConfigOid: d.input.serverConfig.oid,
        serverVersionOid: d.input.serverVersion.oid,
        serverAuthConfigOid: d.input.serverAuthConfig?.oid
      }
    };
  }

  async createServerConnection(d: {
    tenant: Tenant;
    input: {
      serverConfig: ServerConfig;
      serverAuthConfig?: ServerAuthConfig;
      serverVersion: ServerVersion & { server: Server };

      client: InitializeRequest['params']['clientInfo'];
      capabilities: InitializeRequest['params']['capabilities'];

      networkRulesetIds: string[];
    };
  }) {
    let paramRes = await this.resolveServerConnectionParams(d);

    let networkRulesets = await db.networkingRuleset.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.input.networkRulesetIds }
      }
    });

    return await db.serverConnection.create({
      data: {
        ...getId('serverConnection'),
        ...paramRes.params,

        status: 'new',

        client: d.input.client,
        capabilities: d.input.capabilities,

        tenantOid: d.tenant.oid,
        logBucketOid: connectionLogsBucketRecord.oid,

        networkingRules: {
          create: networkRulesets.map(nr => ({
            oid: snowflake.nextId(),
            networkingRulesetOid: nr.oid
          }))
        },

        isLogsInStorage: false
      },
      include
    });
  }

  async getServerConnectionById(d: { tenant: Tenant; serverConnectionId: string }) {
    let serverConnection = await db.serverConnection.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.serverConnectionId
      },
      include
    });
    if (!serverConnection) throw new ServiceError(notFoundError('server_connection'));
    return serverConnection;
  }

  async listServerConnections(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverConnection.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid },
            include
          })
      )
    );
  }

  async getLogs(d: { serverConnection: ServerConnection }) {
    if (d.serverConnection.isLogsInStorage) {
      let offloaded = await offload.getOffloadedConnectionLogs(d.serverConnection);
      if (!offloaded) return [];

      return offloaded.logs.flatMap(([tsRaw, outputTypeRaw, lines]) => {
        let ts = new Date(tsRaw);
        let outputType = outputTypeMapper.get(outputTypeRaw);

        return lines.map(line => ({
          timestamp: ts,
          outputType: outputType!,
          message: line
        }));
      });
    }
  }
}

export let serverConnectionService = Service.create(
  'serverConnectionService',
  () => new serverConnectionServiceImpl()
).build();
