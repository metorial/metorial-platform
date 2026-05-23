import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { createLock } from '@mtsrc/lock';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Server, Tenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { secretService } from '../secret';
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

  async deleteServerOAuthCredentials(d: {
    tenant: Tenant;
    serverOAuthCredentials: {
      oid: bigint;
      remoteConnectionOid: bigint | null;
      delegatedConnectionOid: bigint | null;
    };
  }) {
    let remoteConnection = d.serverOAuthCredentials.remoteConnectionOid
      ? await db.remoteOAuthConnection.findUnique({
          where: {
            oid: d.serverOAuthCredentials.remoteConnectionOid
          },
          select: {
            oid: true,
            secretOid: true
          }
        })
      : null;

    let delegatedConnection = d.serverOAuthCredentials.delegatedConnectionOid
      ? await db.delegatedOAuthConnection.findUnique({
          where: {
            oid: d.serverOAuthCredentials.delegatedConnectionOid
          },
          select: {
            oid: true,
            secretOid: true
          }
        })
      : null;

    let remoteTokens = remoteConnection
      ? await db.remoteOAuthConnectionAuthToken.findMany({
          where: {
            connectionOid: remoteConnection.oid
          },
          select: {
            oid: true,
            secretOid: true
          }
        })
      : [];

    let delegatedTokens = delegatedConnection
      ? await db.delegatedOAuthConnectionAuthToken.findMany({
          where: {
            connectionOid: delegatedConnection.oid
          },
          select: {
            oid: true,
            secretOid: true
          }
        })
      : [];

    return await db.$transaction(async db => {
      await db.serverOAuthSetup.deleteMany({
        where: {
          credentialsOid: d.serverOAuthCredentials.oid
        }
      });

      await db.serverAuthConfig.updateMany({
        where: {
          credentialsOid: d.serverOAuthCredentials.oid
        },
        data: {
          credentialsOid: null
        }
      });

      if (remoteConnection) {
        for (let secretOid of [
          ...remoteTokens.map(token => token.secretOid),
          ...(remoteConnection.secretOid ? [remoteConnection.secretOid] : [])
        ]) {
          await secretService.DANGEROUSLY_deleteSecret({
            secretOid,
            tenant: d.tenant,
            db
          });
        }

        await db.remoteOAuthConnectionAuthToken.deleteMany({
          where: {
            oid: { in: remoteTokens.map(token => token.oid) }
          }
        });

        await db.remoteOAuthConnectionSetup.deleteMany({
          where: {
            connectionOid: remoteConnection.oid
          }
        });

        await db.remoteOAuthConnectionProfile.deleteMany({
          where: {
            connectionOid: remoteConnection.oid
          }
        });

        await db.remoteOAuthConnection.delete({
          where: {
            oid: remoteConnection.oid
          }
        });
      }

      if (delegatedConnection) {
        for (let secretOid of [
          ...delegatedTokens.map(token => token.secretOid),
          ...(delegatedConnection.secretOid ? [delegatedConnection.secretOid] : [])
        ]) {
          await secretService.DANGEROUSLY_deleteSecret({
            secretOid,
            tenant: d.tenant,
            db
          });
        }

        await db.delegatedOAuthConnectionAuthToken.deleteMany({
          where: {
            oid: { in: delegatedTokens.map(token => token.oid) }
          }
        });

        await db.delegatedOAuthConnectionSetup.deleteMany({
          where: {
            connectionOid: delegatedConnection.oid
          }
        });

        await db.delegatedOAuthConnection.delete({
          where: {
            oid: delegatedConnection.oid
          }
        });
      }

      await db.serverOAuthCredentials.delete({
        where: {
          oid: d.serverOAuthCredentials.oid
        }
      });
    });
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
