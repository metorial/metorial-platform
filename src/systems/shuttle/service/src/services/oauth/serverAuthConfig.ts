import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Server, Tenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { secretService } from '../secret';

let include = {
  server: true,
  tenant: true,
  remoteOAuthConnectionAuthToken: {
    include: { connectionProfile: true }
  },
  delegatedOAuthConnectionAuthToken: true,
  credentials: {
    include: {
      remoteConnection: {
        include: { config: true, registration: true }
      },
      delegatedConnection: {
        include: { config: true, functionServer: true }
      }
    }
  }
};

class serverAuthConfigServiceImpl {
  async createServerAuthConfig(d: {
    tenant: Tenant;
    input: {
      config: {
        accessToken: string;
        expiresAt: Date | null | undefined;
      };
      server: Server;
    };
  }) {
    if (d.input.server.type == 'remote' && d.input.server.remoteOauthConfigOid) {
      let remoteConfig = await db.remoteOAuthConfig.findFirstOrThrow({
        where: { oid: d.input.server.remoteOauthConfigOid }
      });

      let secret = await secretService.createSecret({
        purpose: 'oauth_token',
        tenant: d.tenant,
        secretData: {
          accessToken: d.input.config.accessToken
        }
      });

      let token = await db.remoteOAuthConnectionAuthToken.create({
        data: {
          ...getId('remoteOAuthConnectionAuthToken'),
          source: 'import',
          secretOid: secret.oid,
          expiresAt: d.input.config.expiresAt,
          tenantOid: d.tenant.oid,
          serverOid: d.input.server.oid,
          configOid: remoteConfig.oid
        }
      });

      return await db.serverAuthConfig.create({
        data: {
          ...getId('serverAuthConfig'),
          type: 'remote',
          tenantOid: d.tenant.oid,
          serverOid: d.input.server.oid,
          remoteOAuthConnectionAuthTokenOid: token.oid
        },
        include
      });
    }

    if (d.input.server.type == 'function' && d.input.server.delegatedOauthConfigOid) {
      let delegatedConfig = await db.delegatedOAuthConfig.findFirstOrThrow({
        where: { oid: d.input.server.delegatedOauthConfigOid }
      });

      let secret = await secretService.createSecret({
        purpose: 'oauth_token',
        tenant: d.tenant,
        secretData: {
          accessToken: d.input.config.accessToken
        }
      });

      let token = await db.delegatedOAuthConnectionAuthToken.create({
        data: {
          ...getId('delegatedOAuthConnectionAuthToken'),
          authConfigValue: {},
          authStateValue: {},
          source: 'import',
          secretOid: secret.oid,
          expiresAt: d.input.config.expiresAt,
          tenantOid: d.tenant.oid,
          serverOid: d.input.server.oid,
          configOid: delegatedConfig.oid
        }
      });

      return await db.serverAuthConfig.create({
        data: {
          ...getId('serverAuthConfig'),
          type: 'delegated',
          tenantOid: d.tenant.oid,
          serverOid: d.input.server.oid,
          delegatedOAuthConnectionAuthTokenOid: token.oid
        },
        include
      });
    }

    throw new ServiceError(
      badRequestError({
        message: 'Provider does not support OAuth authentication'
      })
    );
  }

  async getServerAuthConfigById(d: { tenant: Tenant; serverAuthConfigId: string }) {
    let serverAuthConfig = await db.serverAuthConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.serverAuthConfigId
      },
      include
    });
    if (!serverAuthConfig) throw new ServiceError(notFoundError('server.auth_config'));
    return serverAuthConfig;
  }

  async DANGEROUSLY_getServerAuthConfigById(d: { serverAuthConfigId: string }) {
    let serverAuthConfig = await db.serverAuthConfig.findFirst({
      where: {
        id: d.serverAuthConfigId
      },
      include
    });
    if (!serverAuthConfig) throw new ServiceError(notFoundError('server.auth_config'));
    return serverAuthConfig;
  }

  async deleteServerAuthConfig(d: {
    tenant: Tenant;
    serverAuthConfig: {
      oid: bigint;
      remoteOAuthConnectionAuthTokenOid: bigint | null;
      delegatedOAuthConnectionAuthTokenOid: bigint | null;
    };
  }) {
    let remoteToken = d.serverAuthConfig.remoteOAuthConnectionAuthTokenOid
      ? await db.remoteOAuthConnectionAuthToken.findUnique({
          where: {
            oid: d.serverAuthConfig.remoteOAuthConnectionAuthTokenOid
          },
          select: {
            oid: true,
            secretOid: true
          }
        })
      : null;

    let delegatedToken = d.serverAuthConfig.delegatedOAuthConnectionAuthTokenOid
      ? await db.delegatedOAuthConnectionAuthToken.findUnique({
          where: {
            oid: d.serverAuthConfig.delegatedOAuthConnectionAuthTokenOid
          },
          select: {
            oid: true,
            secretOid: true
          }
        })
      : null;

    let connections = await db.serverConnection.findMany({
      where: {
        serverAuthConfigOid: d.serverAuthConfig.oid
      },
      select: { oid: true }
    });
    let connectionOids = connections.map(connection => connection.oid);

    return await db.$transaction(async db => {
      await db.serverAuthConfigExport.deleteMany({
        where: {
          serverAuthConfigOid: d.serverAuthConfig.oid
        }
      });

      await db.serverOAuthSetup.deleteMany({
        where: {
          authConfigOid: d.serverAuthConfig.oid
        }
      });

      await db.serverDiscovery.deleteMany({
        where: {
          serverAuthConfigOid: d.serverAuthConfig.oid
        }
      });

      if (connectionOids.length) {
        await db.serverDiscovery.deleteMany({
          where: {
            connectionOid: { in: connectionOids }
          }
        });

        await db.serverConnectionNetworkRule.deleteMany({
          where: {
            serverConnectionOid: { in: connectionOids }
          }
        });

        await db.serverConnectionLogsTemp.deleteMany({
          where: {
            serverConnectionOid: { in: connectionOids }
          }
        });

        await db.functionServerInvocation.updateMany({
          where: {
            connectionOid: { in: connectionOids }
          },
          data: {
            connectionOid: null
          }
        });

        await db.serverConnection.deleteMany({
          where: {
            oid: { in: connectionOids }
          }
        });
      }

      if (remoteToken) {
        await secretService.DANGEROUSLY_deleteSecret({
          secretOid: remoteToken.secretOid,
          tenant: d.tenant,
          db
        });

        await db.remoteOAuthConnectionAuthToken.delete({
          where: {
            oid: remoteToken.oid
          }
        });
      }

      if (delegatedToken) {
        await secretService.DANGEROUSLY_deleteSecret({
          secretOid: delegatedToken.secretOid,
          tenant: d.tenant,
          db
        });

        await db.delegatedOAuthConnectionAuthToken.delete({
          where: {
            oid: delegatedToken.oid
          }
        });
      }

      await db.serverAuthConfig.delete({
        where: {
          oid: d.serverAuthConfig.oid
        }
      });
    });
  }

  async listServerAuthConfigs(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverAuthConfig.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid },
            include
          })
      )
    );
  }

  async listServerAuthConfigsGlobal(d: {
    serverAuthConfigIds?: string[];
    serverIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverAuthConfig.findMany({
            ...opts,
            where: {
              id: d.serverAuthConfigIds ? { in: d.serverAuthConfigIds } : undefined,
              server: d.serverIds ? { id: { in: d.serverIds } } : undefined
            },
            include
          })
      )
    );
  }
}

export let serverAuthConfigService = Service.create(
  'serverAuthConfigService',
  () => new serverAuthConfigServiceImpl()
).build();
