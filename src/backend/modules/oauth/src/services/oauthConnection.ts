import { db, ID, Instance, OAuthConnection, OAuthConnectionTemplate } from '@metorial/db';
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
    input: {
      name: string;
      discoveryUrl?: string;
      config: OAuthConfiguration;

      clientId: string;
      clientSecret: string;
      scopes: string[];
    };
    instance: Instance;
    template?: OAuthConnectionTemplate;
  }) {
    return await db.oAuthConnection.create({
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
    connection: OAuthConnection;
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

    let updateData: Partial<OAuthConnection> = {};

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

    return await db.oAuthConnection.update({
      where: { oid: d.connection.oid },
      data: updateData,
      include
    });
  }

  async getConnectionById(d: { connectionId: string; instance: Instance }) {
    let connection = await db.oAuthConnection.findUnique({
      where: { id: d.connectionId, instanceOid: d.instance.oid },
      include
    });
    if (!connection) throw new ServiceError(notFoundError('connection', d.connectionId));

    return connection;
  }

  async listTemplates(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.oAuthConnection.findMany({
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

  async archiveConnection(d: { connection: OAuthConnection }) {
    if (d.connection.status === 'archived') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot archive an already archived connection'
        })
      );
    }

    return await db.oAuthConnection.update({
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
