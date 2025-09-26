import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionTemplate,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Fabric } from '@metorial/fabric';
import { generateCustomId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { OAuthUtils } from '../lib/oauthUtils';
import { asyncAutoDiscoveryQueue } from '../queue/asyncAutoDiscovery';
import { OAuthConfiguration } from '../types';
import { providerOauthConfigService } from './oauthConfig';
import { providerOauthDiscoveryService } from './oauthDiscovery';

let include = {
  template: true,
  instance: true,
  config: true
};

class OauthConnectionServiceImpl {
  async createConnection(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context?: Context;

    input: {
      name?: string;
      description?: string;

      discoveryUrl?: string;

      setup:
        | {
            mode: 'manual';
            clientId: string;
            clientSecret: string;
            config: OAuthConfiguration;
            scopes: string[];
          }
        | {
            mode: 'existing_auto_registration';
            autoRegistrationId: string;
            config: OAuthConfiguration;
            scopes: string[];
          }
        | {
            mode: 'async_auto_registration';
            oauthConfigId: string;
          };

      metadata?: Record<string, any>;
    };

    template?: ProviderOAuthConnectionTemplate;
  }) {
    await Fabric.fire('provider_oauth.connection.created:before', {
      organization: d.organization,
      instance: d.instance,
      performedBy: d.performedBy,
      context: d.context
    });

    let clientId: string | undefined = undefined;
    let clientSecret: string | undefined = undefined;
    let registrationOid: bigint | null = null;

    let config: ProviderOAuthConfig;

    let asyncAutoDiscovery = false;

    if (d.input.setup.mode === 'manual') {
      clientId = d.input.setup.clientId;
      clientSecret = d.input.setup.clientSecret;

      config = await providerOauthConfigService.createConfig({
        instance: d.instance,
        config: d.input.setup.config,
        scopes: d.input.setup.scopes
      });
    } else if (d.input.setup.mode === 'existing_auto_registration') {
      let autoReg = await db.providerOAuthAutoRegistration.findUnique({
        where: { id: d.input.setup.autoRegistrationId }
      });
      if (!autoReg) {
        throw new ServiceError(
          notFoundError('oauth_auto_registration', d.input.setup.autoRegistrationId)
        );
      }

      clientId = autoReg.clientId;
      clientSecret = autoReg.clientSecret ?? undefined;
      registrationOid = autoReg.oid;

      config = await providerOauthConfigService.createConfig({
        instance: d.instance,
        config: d.input.setup.config,
        scopes: d.input.setup.scopes
      });
    } else if (d.input.setup.mode === 'async_auto_registration') {
      config = await db.providerOAuthConfig.findUniqueOrThrow({
        where: { id: d.input.setup.oauthConfigId, instanceOid: d.instance.oid }
      });

      if (!providerOauthDiscoveryService.supportsAutoRegistration({ config: config.config })) {
        throw new ServiceError(
          badRequestError({
            message: 'The provided OAuth configuration does not support auto registration'
          })
        );
      }

      asyncAutoDiscovery = true;
    } else {
      throw new Error('WTF - invalid setup mode');
    }

    if (!clientId && !asyncAutoDiscovery) {
      throw new ServiceError(badRequestError({ message: 'Client ID is required' }));
    }

    let providerConnection = await withTransaction(async db => {
      let con = await db.providerOAuthConnection.create({
        data: {
          id: await ID.generateId('oauthConnection'),
          metorialClientId: generateCustomId('mt_poatcon_', 35),

          name: d.input.name,
          description: d.input.description,

          isAutoDiscoveryActive: asyncAutoDiscovery,

          providerName: OAuthUtils.getProviderName(config.config),
          providerUrl: OAuthUtils.getProviderUrl(config.config),
          discoveryUrl: d.input.discoveryUrl,

          configOid: config.oid,

          clientId,
          clientSecret,

          registrationOid,

          instanceOid: d.instance.oid,
          templateOid: d.template?.oid,

          metadata: d.input.metadata ?? {}
        },
        include
      });

      await Fabric.fire('provider_oauth.connection.created:after', {
        organization: d.organization,
        instance: d.instance,
        performedBy: d.performedBy,
        context: d.context,
        providerOauthConnection: con
      });

      return con;
    });

    if (asyncAutoDiscovery) {
      await asyncAutoDiscoveryQueue.add({
        connectionId: providerConnection.id
      });
    }

    return providerConnection;
  }

  async updateConnection(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context?: Context;

    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    input: {
      name?: string;
      description?: string;

      config?: OAuthConfiguration;

      clientId?: string;
      clientSecret?: string;
      scopes?: string[];

      metadata?: Record<string, any>;
    };
  }) {
    if (d.connection.status === 'archived') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an archived connection'
        })
      );
    }

    await Fabric.fire('provider_oauth.connection.updated:before', {
      organization: d.organization,
      instance: d.instance,
      performedBy: d.performedBy,
      context: d.context,
      providerOauthConnection: d.connection
    });

    let updateData: Partial<ProviderOAuthConnection> = {
      name: d.input.name,
      description: d.input.description,
      clientId: d.input.clientId,
      clientSecret: d.input.clientSecret,
      metadata: d.input.metadata
    };

    if (d.input.config || d.input.scopes) {
      let config = await providerOauthConfigService.createConfig({
        instance: d.instance,
        config: d.input.config ?? d.connection.config.config,
        scopes: d.input.scopes ?? d.connection.config.scopes
      });

      updateData.configOid = config.oid;
    }

    return await withTransaction(async db => {
      let con = await db.providerOAuthConnection.update({
        where: { oid: d.connection.oid },
        data: updateData as any,
        include
      });

      await Fabric.fire('provider_oauth.connection.updated:after', {
        organization: d.organization,
        instance: d.instance,
        performedBy: d.performedBy,
        context: d.context,
        providerOauthConnection: con
      });

      return con;
    });
  }

  async archiveConnection(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context?: Context;

    connection: ProviderOAuthConnection;
  }) {
    if (d.connection.status === 'archived') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot archive an already archived connection'
        })
      );
    }

    await Fabric.fire('provider_oauth.connection.archived:before', {
      organization: d.organization,
      instance: d.instance,
      performedBy: d.performedBy,
      context: d.context,
      providerOauthConnection: d.connection
    });

    return await withTransaction(async db => {
      let con = await db.providerOAuthConnection.update({
        where: { oid: d.connection.oid },
        data: { status: 'archived' },
        include
      });

      await Fabric.fire('provider_oauth.connection.archived:after', {
        organization: d.organization,
        instance: d.instance,
        performedBy: d.performedBy,
        context: d.context,
        providerOauthConnection: con
      });

      return con;
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

  async getConnectionByClientId(d: { clientId: string; organizationId: string }) {
    let connection = await db.providerOAuthConnection.findUnique({
      where: {
        metorialClientId: d.clientId,
        instance: {
          organization: {
            id: d.organizationId
          }
        }
      },
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
}

export let providerOauthConnectionService = Service.create(
  'providerOauthConnection',
  () => new OauthConnectionServiceImpl()
).build();
