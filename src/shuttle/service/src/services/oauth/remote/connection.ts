import { delay } from '@lowerdeck/delay';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  RemoteOAuthConfig,
  RemoteOAuthConnection,
  Secret,
  Tenant
} from '../../../../prisma/generated/client';
import { db } from '../../../db';
import { getId } from '../../../id';
import { OAuthUtils } from '../../../lib/oauth/oauthUtils';
import { discoverRemoteOAuthConnectionQueue } from '../../../queues/discovery/remoteOAuthConnection';
import { withTransaction } from '../../../transaction';
import { secretService } from '../../secret';

let include = {
  serverOAuthCredentials: true
};

class remoteOAuthConnectionServiceImpl {
  async waitForConfig(d: { config: RemoteOAuthConfig }) {
    let config = d.config;
    let i = 0;
    while (
      config.discoverStatus != 'manual' &&
      config.discoverStatus != 'supports_auto_registration'
    ) {
      if (config.discoverStatus == 'failed') {
        throw new ServiceError(
          badRequestError({
            message: 'OAuth configuration discovery failed, cannot create connection',
            details: { code: config.errorCode, message: config.errorMessage }
          })
        );
      }

      if (i++ > 20) {
        throw new ServiceError(
          badRequestError({
            message: 'OAuth configuration is still being discovered, cannot create connection'
          })
        );
      }

      await delay(i < 5 ? 1000 : 5000);

      config = await db.remoteOAuthConfig.findUniqueOrThrow({
        where: { oid: config.oid }
      })!;
    }

    return config as Omit<RemoteOAuthConfig, 'discoverStatus'> & {
      discoverStatus: 'manual' | 'supports_auto_registration';
    };
  }

  async createConnection(d: {
    tenant: Tenant;

    input: {
      config: RemoteOAuthConfig;

      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    };
  }) {
    let config = await this.waitForConfig({ config: d.input.config });

    if (!d.input.clientId && !(await OAuthUtils.supportsAuthRegistration(config.config))) {
      throw new ServiceError(
        badRequestError({
          message: 'Client ID must be provided for this OAuth provider'
        })
      );
    }

    let secret: Secret | undefined = undefined;
    if (d.input.clientId) {
      secret = await secretService.createSecret({
        tenant: d.tenant,
        purpose: 'oauth_connection_credentials',
        secretData: {
          clientId: d.input.clientId,
          clientSecret: d.input.clientSecret
        }
      });
    }

    return await withTransaction(async db => {
      let con = await db.remoteOAuthConnection.create({
        data: {
          ...getId('remoteOAuthConnection'),

          discoveryStatus: secret ? 'succeeded' : 'discovering',
          status: 'active',

          providerName: config.providerName,
          providerUrl: config.providerUrl,
          discoveryUrl: config.discoveryUrl,

          clientId: d.input.clientId,
          scopes: d.input.scopes ?? config.scopes,

          configOid: config.oid,
          secretOid: secret?.oid,
          tenantOid: d.tenant.oid,
          serverOid: config.serverOid
        }
      });

      await db.serverOAuthCredentials.createMany({
        data: {
          ...getId('serverOAuthCredentials'),
          type: 'remote',
          remoteConnectionOid: con.oid,
          serverOid: config.serverOid,
          tenantOid: d.tenant.oid
        }
      });

      await discoverRemoteOAuthConnectionQueue.add({
        oauthConnectionId: con.id
      });

      return await db.remoteOAuthConnection.findUniqueOrThrow({
        where: { oid: con.oid },
        include
      });
    });
  }

  async listConnectionEvents(d: { connection: RemoteOAuthConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.remoteOAuthConnectionEvent.findMany({
            ...opts,
            where: {
              connectionOid: d.connection.oid
            },
            include: {
              connection: true
            }
          })
      )
    );
  }

  async getConnectionEventById(d: { connection: RemoteOAuthConnection; eventId: string }) {
    let event = await db.remoteOAuthConnectionEvent.findUnique({
      where: { id: d.eventId, connectionOid: d.connection.oid },
      include: { connection: true }
    });
    if (!event) throw new ServiceError(notFoundError('connection_event', d.eventId));

    return event;
  }

  async listConnectionAuthentications(d: { connection: RemoteOAuthConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.remoteOAuthConnectionSetup.findMany({
            ...opts,
            where: {
              connectionOid: d.connection.oid,
              status: { in: ['completed', 'failed'] }
            },
            include: {
              connection: true,
              profile: true
            }
          })
      )
    );
  }

  async getConnectionAuthenticationById(d: {
    connection: RemoteOAuthConnection;
    authenticationId: string;
  }) {
    let event = await db.remoteOAuthConnectionSetup.findUnique({
      where: { id: d.authenticationId, connectionOid: d.connection.oid },
      include: { connection: true, profile: true }
    });
    if (!event)
      throw new ServiceError(notFoundError('connection_authentication', d.authenticationId));

    return event;
  }

  async listConnectionProfiles(d: { connection: RemoteOAuthConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.remoteOAuthConnectionProfile.findMany({
            ...opts,
            where: {
              connectionOid: d.connection.oid
            },
            include: {
              connection: true
            }
          })
      )
    );
  }

  async getConnectionProfileById(d: { connection: RemoteOAuthConnection; profileId: string }) {
    let event = await db.remoteOAuthConnectionProfile.findUnique({
      where: { id: d.profileId, connectionOid: d.connection.oid },
      include: { connection: true }
    });
    if (!event) throw new ServiceError(notFoundError('connection_profile', d.profileId));

    return event;
  }

  async DANGEROUSLY_getCredentials(d: {
    tenant: Tenant;
    connection: RemoteOAuthConnection;
    omitSecret?: boolean;
  }) {
    if (d.connection.secretOid && !d.omitSecret) {
      let secret = await secretService.DANGEROUSLY_decryptSecret({
        secretOid: d.connection.secretOid,
        purpose: 'oauth_connection_credentials',
        tenant: d.tenant,
        note: `rocn.cred:${d.connection.id}`
      });

      return {
        clientId: secret.clientId,
        clientSecret: secret.clientSecret
      };
    }

    if (d.connection.registrationOid) {
      let registration = await db.remoteOAuthAutoRegistration.findUniqueOrThrow({
        where: { oid: d.connection.registrationOid }
      });

      if (
        registration.clientSecretExpiresAt &&
        registration.clientSecretExpiresAt < new Date()
      ) {
        let config = await db.remoteOAuthConfig.findUniqueOrThrow({
          where: { oid: d.connection.configOid }
        });

        let reg = await OAuthUtils.registerClient({
          tenant: d.tenant,
          config: config.config,
          owner: {
            config: config,
            connection: d.connection
          }
        });

        if (reg?.ok) {
          registration = reg.registration;
          await db.remoteOAuthConnection.update({
            where: { oid: d.connection.oid },
            data: {
              registrationOid: registration.oid,
              clientId: registration.clientId
            }
          });
        }
      }

      return {
        clientId: registration.clientId,
        clientSecret: registration.clientSecret || undefined
      };
    }

    if (d.connection.clientId) {
      return {
        clientId: d.connection.clientId,
        clientSecret: undefined
      };
    }

    throw new ServiceError(
      badRequestError({
        message: 'Connection is not properly configured for authentication'
      })
    );
  }
}

export let remoteOAuthConnectionService = Service.create(
  'remoteOAuthConnection',
  () => new remoteOAuthConnectionServiceImpl()
).build();
