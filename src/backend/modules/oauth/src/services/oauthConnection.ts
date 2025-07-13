import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  ProviderOAuthConnection,
  ProviderOAuthConnectionTemplate
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { generateCustomId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { OAuthUtils } from '../lib/oauthUtils';
import { OAuthConfiguration } from '../types';

let include = {
  template: true,
  instance: true
};

class OauthConnectionServiceImpl {
  async createConnection(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;

    input: {
      name: string;
      discoveryUrl?: string;
      config: OAuthConfiguration;

      clientId: string;
      clientSecret: string;
      scopes: string[];
    };
    template?: ProviderOAuthConnectionTemplate;
  }) {
    return await db.providerOAuthConnection.create({
      data: {
        id: await ID.generateId('oauthConnection'),
        metorialClientId: generateCustomId('metorial_oauthcon_', 35),

        name: d.input.name,
        providerName: OAuthUtils.getProviderName(d.input.config),
        providerUrl: OAuthUtils.getProviderUrl(d.input.config),
        discoveryUrl: d.input.discoveryUrl,

        config: d.input.config,
        configHash: await OAuthUtils.getConfigHash(d.input.config),

        scopes: d.input.scopes,

        clientId: d.input.clientId,
        clientSecret: d.input.clientSecret,

        instanceOid: d.instance.oid,
        templateOid: d.template?.oid
      },
      include
    });
  }

  async updateConnection(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;

    connection: ProviderOAuthConnection;
    input: {
      name?: string;
      config?: OAuthConfiguration;

      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    };
  }) {
    if (d.connection.status === 'archived') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an archived connection'
        })
      );
    }

    let updateData: Partial<ProviderOAuthConnection> = {};

    if (d.input.name) {
      updateData.name = d.input.name;
    }

    if (d.input.config) {
      updateData.config = d.input.config;
      updateData.configHash = await OAuthUtils.getConfigHash(d.input.config);
      updateData.providerName = OAuthUtils.getProviderName(d.input.config);
      updateData.providerUrl = OAuthUtils.getProviderUrl(d.input.config);
    }

    if (d.input.clientId) {
      updateData.clientId = d.input.clientId;
    }

    if (d.input.clientSecret) {
      updateData.clientSecret = d.input.clientSecret;
    }

    if (d.input.scopes) {
      updateData.scopes = d.input.scopes;
    }

    return await db.providerOAuthConnection.update({
      where: { oid: d.connection.oid },
      data: updateData,
      include
    });
  }

  async getConnectionById(d: { connectionId: string; instance: Instance }) {
    let connection = await db.providerOAuthConnection.findUnique({
      where: { id: d.connectionId, instanceOid: d.instance.oid },
      include
    });
    if (!connection) throw new ServiceError(notFoundError('connection', d.connectionId));

    return connection;
  }

  async getConnectionByClientId(d: { clientId: string }) {
    let connection = await db.providerOAuthConnection.findUnique({
      where: { metorialClientId: d.clientId },
      include
    });
    if (!connection) throw new ServiceError(notFoundError('connection'));

    return connection;
  }

  async listConnections(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthConnection.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async listConnectionEvents(d: { connection: ProviderOAuthConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthConnectionEvent.findMany({
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

  async getConnectionEventById(d: { connection: ProviderOAuthConnection; eventId: string }) {
    let event = await db.providerOAuthConnectionEvent.findUnique({
      where: { id: d.eventId, connectionOid: d.connection.oid },
      include: { connection: true }
    });
    if (!event) throw new ServiceError(notFoundError('connection_event', d.eventId));

    return event;
  }

  async listConnectionAuthentications(d: { connection: ProviderOAuthConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthConnectionAuthAttempt.findMany({
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
    connection: ProviderOAuthConnection;
    authenticationId: string;
  }) {
    let event = await db.providerOAuthConnectionAuthAttempt.findUnique({
      where: { id: d.authenticationId, connectionOid: d.connection.oid },
      include: { connection: true, profile: true }
    });
    if (!event)
      throw new ServiceError(notFoundError('connection_authentication', d.authenticationId));

    return event;
  }

  async listConnectionProfiles(d: { connection: ProviderOAuthConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthConnectionProfile.findMany({
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

  async getConnectionProfileById(d: {
    connection: ProviderOAuthConnection;
    profileId: string;
  }) {
    let event = await db.providerOAuthConnectionProfile.findUnique({
      where: { id: d.profileId, connectionOid: d.connection.oid },
      include: { connection: true }
    });
    if (!event) throw new ServiceError(notFoundError('connection_profile', d.profileId));

    return event;
  }

  async archiveConnection(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;

    connection: ProviderOAuthConnection;
  }) {
    if (d.connection.status === 'archived') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot archive an already archived connection'
        })
      );
    }

    return await db.providerOAuthConnection.update({
      where: { oid: d.connection.oid },
      data: { status: 'archived' },
      include
    });
  }
}

export let oauthConnectionService = Service.create(
  'oauthConnection',
  () => new OauthConnectionServiceImpl()
).build();
