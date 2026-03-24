import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
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
}

export let serverAuthConfigService = Service.create(
  'serverAuthConfigService',
  () => new serverAuthConfigServiceImpl()
).build();
