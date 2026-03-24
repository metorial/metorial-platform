import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Server, Tenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { delegatedOAuthConnectionService } from './delegated';
import { remoteOAuthConnectionService } from './remote';

let include = {
  server: true,
  tenant: true,
  remoteConnection: {
    include: { config: true, registration: true }
  },
  delegatedConnection: {
    include: { config: true, functionServer: true }
  }
};

let createDefaultCredentialsLock = createLock({
  name: 'shut/oat-cred/def/lock',
  redisUrl: env.service.REDIS_URL
});

class serverOAuthCredentialsServiceImpl {
  async createServerOAuthCredentials(d: {
    tenant: Tenant;
    input: {
      server: Server;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    };
  }) {
    if (!d.input.server.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider has not been deployed yet'
        })
      );
    }

    if (d.input.server.type == 'remote' && d.input.server.remoteOauthConfigOid) {
      let config = await db.remoteOAuthConfig.findFirstOrThrow({
        where: { oid: d.input.server.remoteOauthConfigOid }
      });

      let connection = await remoteOAuthConnectionService.createConnection({
        tenant: d.tenant,
        input: {
          config,
          scopes: d.input.scopes,
          clientId: d.input.clientId,
          clientSecret: d.input.clientSecret
        }
      });

      if (!connection.serverOAuthCredentials) {
        throw new Error('OAuth connection did not create server OAuth credentials');
      }

      return await db.serverOAuthCredentials.findUniqueOrThrow({
        where: { oid: connection.serverOAuthCredentials.oid },
        include
      });
    }

    if (d.input.server.type == 'function' && d.input.server.delegatedOauthConfigOid) {
      if (!d.input.clientId || !d.input.clientSecret) {
        throw new ServiceError(
          badRequestError({
            message: 'Client ID and Client Secret are required for this provider'
          })
        );
      }

      let config = await db.delegatedOAuthConfig.findFirstOrThrow({
        where: { oid: d.input.server.delegatedOauthConfigOid }
      });

      let connection = await delegatedOAuthConnectionService.createConnection({
        tenant: d.tenant,
        input: {
          config,
          clientId: d.input.clientId,
          clientSecret: d.input.clientSecret
        }
      });

      if (!connection.serverOAuthCredentials) {
        throw new Error('OAuth connection did not create server OAuth credentials');
      }

      return await db.serverOAuthCredentials.findUniqueOrThrow({
        where: { oid: connection.serverOAuthCredentials.oid },
        include
      });
    }

    throw new ServiceError(
      badRequestError({
        message: 'Provider does not support OAuth'
      })
    );
  }

  async ensureDefaultServerOAuthCredentials(d: { tenant: Tenant; server: Server }) {
    if (!d.server.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider has not been deployed yet'
        })
      );
    }

    let exiting = await db.serverOAuthCredentials.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        serverOid: d.server.oid,
        isDefault: true
      },
      include
    });
    if (exiting) return exiting;

    return createDefaultCredentialsLock.usingLock(
      `${d.tenant.oid}-${d.server.oid}`,
      async () => {
        let exiting = await db.serverOAuthCredentials.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            serverOid: d.server.oid,
            isDefault: true
          },
          include
        });
        if (exiting) return exiting;

        let newCreds = await this.createServerOAuthCredentials({
          tenant: d.tenant,
          input: {
            server: d.server
          }
        });

        newCreds.isDefault = true;
        await db.serverOAuthCredentials.updateMany({
          where: { oid: newCreds.oid },
          data: { isDefault: true }
        });

        return newCreds;
      }
    );
  }

  async getServerOAuthCredentialsById(d: {
    tenant: Tenant;
    serverOAuthCredentialsId: string;
  }) {
    let serverOAuthCredentials = await db.serverOAuthCredentials.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.serverOAuthCredentialsId
      },
      include
    });
    if (!serverOAuthCredentials) throw new ServiceError(notFoundError('server_config'));
    return serverOAuthCredentials;
  }

  async listServerOAuthCredentials(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverOAuthCredentials.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid },
            include
          })
      )
    );
  }
}

export let serverOAuthCredentialsService = Service.create(
  'serverOAuthCredentialsService',
  () => new serverOAuthCredentialsServiceImpl()
).build();
