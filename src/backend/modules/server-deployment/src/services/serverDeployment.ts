import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  Server,
  ServerDeployment,
  ServerDeploymentConfig,
  ServerDeploymentStatus,
  ServerImplementation,
  ServerVariant,
  withTransaction
} from '@metorial/db';
import { delay } from '@metorial/delay';
import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { serverVariantService } from '@metorial/module-catalog';
import { engineServerDiscoveryService } from '@metorial/module-engine';
import { ingestEventService } from '@metorial/module-event';
import {
  providerOauthConnectionService,
  providerOauthDiscoveryService
} from '@metorial/module-provider-oauth';
import { searchService } from '@metorial/module-search';
import { secretService } from '@metorial/module-secret';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { Validator } from 'jsonschema';
import { serverDeploymentDeletedQueue } from '../queues/serverDeploymentDeleted';
import { serverDeploymentSetupQueue } from '../queues/serverDeploymentSetup';

let validator = new Validator();

let include = {
  oauthConnection: {
    include: {
      instance: true,
      template: true,
      config: true
    }
  },
  serverImplementation: {
    include: {
      server: true,
      serverVariant: true
    }
  },
  server: true,
  config: {
    include: {
      configSecret: true
    }
  }
};

class ServerDeploymentServiceImpl {
  private async ensureServerDeploymentActive(serverDeployment: ServerDeployment) {
    if (serverDeployment.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted server_deployment'
        })
      );
    }
  }

  private async checkServerDeploymentConfig(d: {
    serverImplementation: ServerImplementation & {
      serverVariant: ServerVariant;
      server: Server;
    };
    instance: Instance;
    config: Record<string, any>;
  }) {
    let variant = await serverVariantService.getServerVariantById({
      serverVariantId: d.serverImplementation.serverVariant.id,
      server: d.serverImplementation.server,
      instance: d.instance
    });
    if (!variant.currentVersion) {
      throw new ServiceError(
        badRequestError({
          message: 'Server variant cannot be deployed to Metorial'
        })
      );
    }

    let schema = variant.currentVersion.schema;
    let jsonSchema =
      typeof schema.schema == 'string' ? JSON.parse(schema.schema) : schema.schema;

    let data = { ...d.config };

    let validate = validator.validate(data, jsonSchema);
    if (!validate.valid) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid server deployment config',
          errors: validate.errors?.map(e => ({
            message: e.message,
            code: e.name,
            params: e.path
          }))
        })
      );
    }

    return {
      data,
      schema
    };
  }

  async getServerDeploymentById(d: { instance: Instance; serverDeploymentId: string }) {
    let serverDeployment = await db.serverDeployment.findFirst({
      where: {
        id: d.serverDeploymentId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverDeployment)
      throw new ServiceError(notFoundError('server_deployment', d.serverDeploymentId));

    return serverDeployment;
  }

  async getManyServerDeployments(d: { instance: Instance; serverDeploymentIds?: string[] }) {
    let uniqueIds = d.serverDeploymentIds
      ? Array.from(new Set(d.serverDeploymentIds))
      : undefined;

    let deployments = await db.serverDeployment.findMany({
      where: {
        id: uniqueIds ? { in: uniqueIds } : undefined,
        instanceOid: d.instance.oid
      },
      include: { server: true, serverImplementation: true }
    });

    if (uniqueIds && uniqueIds.length != deployments.length) {
      let notFoundIds = uniqueIds.filter(id => !deployments.find(d => d.id == id));

      throw new ServiceError(notFoundError('server_deployment', notFoundIds[0]));
    }

    return deployments;
  }

  async createServerDeployment(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;

    serverImplementation: {
      instance: ServerImplementation & { serverVariant: ServerVariant; server: Server };
      isNewEphemeral: boolean;
    };

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config: Record<string, any>;
      oauthConfig?: {
        clientId: string;
        clientSecret: string;
      };
    };

    type: 'ephemeral' | 'persistent';
    parent?: 'magic_mcp_server';
  }) {
    if (
      d.serverImplementation.instance.status != 'active' &&
      !d.serverImplementation.isNewEphemeral
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create a server deployment for a deleted server implementation'
        })
      );
    }

    if (d.serverImplementation.instance.server.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create a server deployment for a deleted server'
        })
      );
    }

    if (
      !d.serverImplementation.isNewEphemeral &&
      d.serverImplementation.instance.status != 'active'
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create a server deployment for a deleted server instance'
        })
      );
    }

    await Fabric.fire('server.server_deployment.created:before', {
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance,
      context: d.context,
      implementation: d.serverImplementation.instance
    });

    let currentVersionOid = d.serverImplementation.instance.serverVariant.currentVersionOid;
    let currentVersion = currentVersionOid
      ? await db.serverVersion.findFirst({
          where: { oid: currentVersionOid },
          include: {
            customServerVersion: {
              include: {
                remoteServerInstance: true,
                lambdaServerInstance: true
              }
            }
          }
        })
      : null;

    let serverInstance =
      currentVersion?.customServerVersion?.remoteServerInstance ??
      currentVersion?.customServerVersion?.lambdaServerInstance;

    if (d.serverImplementation.instance.server.type == 'custom' && !serverInstance) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create a server deployment for a custom server that is not deployed'
        })
      );
    }

    let serverDeployment = await withTransaction(async db => {
      let connection: ProviderOAuthConnection | null = null;
      let oauthConfig: ProviderOAuthConfig | null = null;

      if (serverInstance?.providerOAuthConfigOid) {
        oauthConfig = await db.providerOAuthConfig.findFirstOrThrow({
          where: { oid: serverInstance.providerOAuthConfigOid }
        });

        let tries = 0;
        while (oauthConfig.discoverStatus == 'discovering') {
          await delay(tries < 2 ? 100 : 1000);

          oauthConfig = await db.providerOAuthConfig.findUniqueOrThrow({
            where: { id: oauthConfig!.id }
          });

          if (tries >= 10) {
            throw new ServiceError(
              conflictError({ message: 'OAuth configuration is still being discovered' })
            );
          }
        }

        if (
          !providerOauthDiscoveryService.supportsAutoRegistration({
            config: oauthConfig.config
          }) ||
          d.input.oauthConfig ||
          oauthConfig.discoverStatus == 'manual'
        ) {
          if (!d.input.oauthConfig) {
            throw new ServiceError(
              badRequestError({
                message: 'OAuth configuration is required for this server deployment'
              })
            );
          }

          connection = await providerOauthConnectionService.createConnection({
            organization: d.organization,
            instance: d.instance,
            performedBy: d.performedBy,
            context: d.context,

            isEphemeral: true,

            input: {
              name: `OAuth Connection for ${d.input.name ?? d.serverImplementation.instance.name ?? d.serverImplementation.instance.server.name}`,
              description: 'Auto-created by Metorial for server deployment',

              setup: {
                mode: 'manual',
                config: oauthConfig.config,
                scopes: oauthConfig.scopes,
                clientId: d.input.oauthConfig.clientId,
                clientSecret: d.input.oauthConfig.clientSecret
              }
            }
          });
        } else {
          connection = await providerOauthConnectionService.createConnection({
            organization: d.organization,
            instance: d.instance,
            performedBy: d.performedBy,
            context: d.context,

            isEphemeral: true,

            input: {
              name: `OAuth Connection for ${d.input.name ?? d.serverImplementation.instance.name ?? d.serverImplementation.instance.server.name}`,
              description: 'Auto-created by Metorial for server deployment',

              setup: {
                mode: 'async_auto_registration',
                oauthConfigId: oauthConfig.id
              }
            }
          });
        }
      }

      let { schema, data } = await this.checkServerDeploymentConfig({
        serverImplementation: d.serverImplementation.instance,
        config: d.input.config,
        instance: d.instance
      });

      let secret = await secretService.createSecret({
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        input: {
          type: 'server_deployment_config',
          secretData: data
        }
      });

      let config = await db.serverDeploymentConfig.create({
        data: {
          id: await ID.generateId('serverDeploymentConfig'),
          schemaOid: schema.oid,
          configSecretOid: secret.oid,
          instanceOid: d.instance.oid,
          isEphemeral: true // Eventually, we will have reusable persistent configs
        }
      });

      let serverDeployment = await db.serverDeployment.create({
        data: {
          id: await ID.generateId('serverDeployment'),
          status: d.type === 'ephemeral' ? 'archived' : 'active',
          isEphemeral: d.type === 'ephemeral',

          oauthConfigOid: oauthConfig?.oid,
          oauthConnectionOid: connection?.oid,

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          serverImplementationOid: d.serverImplementation.instance.oid,
          serverOid: d.serverImplementation.instance.server.oid,
          serverVariantOid: d.serverImplementation.instance.serverVariant.oid,
          configOid: config.oid,
          instanceOid: d.instance.oid,

          isMagicMcpSession: d.parent === 'magic_mcp_server'
        },
        include
      });

      if (connection && !connection.isEphemeral) {
        await db.providerOAuthConnection.updateMany({
          where: { oid: connection.oid },
          data: { isEphemeral: true }
        });
      }

      await ingestEventService.ingest('server.server_deployment:created', {
        serverDeployment,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      await Fabric.fire('server.server_deployment.created:after', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        context: d.context,
        deployment: serverDeployment,
        implementation: d.serverImplementation.instance
      });

      return serverDeployment;
    });

    await serverDeploymentSetupQueue.add({
      serverDeploymentId: serverDeployment.id
    });

    if (!serverDeployment.serverImplementation.serverVariant.lastDiscoveredAt) {
      await engineServerDiscoveryService.discoverServerAsync({
        serverDeployment
      });
    }

    return serverDeployment;
  }

  async updateServerDeployment(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;

    serverDeployment: ServerDeployment & {
      serverImplementation: ServerImplementation & {
        serverVariant: ServerVariant;
        server: Server;
      };
      config: ServerDeploymentConfig;
    };
    input: {
      name?: string;
      description?: string | null;
      metadata?: Record<string, any>;
      config?: Record<string, any>;
    };
  }) {
    await Fabric.fire('server.server_deployment.updated:before', {
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance,
      deployment: d.serverDeployment,
      implementation: d.serverDeployment.serverImplementation
    });

    await this.ensureServerDeploymentActive(d.serverDeployment);

    return withTransaction(async db => {
      if (d.input.config) {
        if (!d.serverDeployment.config.isEphemeral) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot perform nested update on a persistent server deployment config'
            })
          );
        }

        let { schema, data } = await this.checkServerDeploymentConfig({
          serverImplementation: d.serverDeployment.serverImplementation,
          config: d.input.config,
          instance: d.instance
        });

        let secret = await secretService.createSecret({
          organization: d.organization,
          performedBy: d.performedBy,
          instance: d.instance,
          input: {
            type: 'server_deployment_config',
            secretData: data
          }
        });

        await db.serverDeploymentConfig.update({
          where: {
            oid: d.serverDeployment.config.oid
          },
          data: {
            schemaOid: schema.oid,
            configSecretOid: secret.oid
          }
        });

        await secretService.deleteSecret({
          performedBy: d.performedBy,
          secret: await secretService.getSecretById({
            instance: d.instance,
            secretId: d.serverDeployment.config.configSecretOid
          })
        });
      }

      let serverDeployment = await db.serverDeployment.update({
        where: {
          oid: d.serverDeployment.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        },
        include
      });

      await ingestEventService.ingest('server.server_deployment:updated', {
        serverDeployment,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      await Fabric.fire('server.server_deployment.updated:after', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        deployment: serverDeployment,
        implementation: d.serverDeployment.serverImplementation
      });

      return serverDeployment;
    });
  }

  async deleteServerDeployment(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverDeployment: ServerDeployment & {
      config: ServerDeploymentConfig;
      serverImplementation: ServerImplementation;
    };
  }) {
    await Fabric.fire('server.server_deployment.deleted:before', {
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance,
      deployment: d.serverDeployment,
      implementation: d.serverDeployment.serverImplementation
    });

    await this.ensureServerDeploymentActive(d.serverDeployment);

    return withTransaction(async db => {
      let serverDeployment = await db.serverDeployment.update({
        where: {
          id: d.serverDeployment.id
        },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include
      });

      await ingestEventService.ingest('server.server_deployment:deleted', {
        serverDeployment,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      await serverDeploymentDeletedQueue.add(
        {
          serverDeploymentId: serverDeployment.id,
          performedById: d.performedBy.id
        },
        { delay: 100 }
      );

      await Fabric.fire('server.server_deployment.deleted:after', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        deployment: serverDeployment,
        implementation: d.serverDeployment.serverImplementation
      });

      return serverDeployment;
    });
  }

  async listServerDeployments(d: {
    serverVariantIds?: string[];
    serverImplementationIds?: string[];
    serverIds?: string[];
    sessionIds?: string[];
    instance: Instance;
    status?: ServerDeploymentStatus[];
    search?: string;
  }) {
    let search = d.search
      ? await searchService.search<{ id: string }>({
          index: 'server_deployment',
          query: d.search,
          options: {
            // filters: {
            //   instanceId: { $eq: d.instance.id }
            // },
            limit: 50
          }
        })
      : undefined;

    let servers = d.serverIds?.length
      ? await db.server.findMany({
          where: { id: { in: d.serverIds } }
        })
      : undefined;
    let serverVariants = d.serverVariantIds?.length
      ? await db.serverVariant.findMany({
          where: { id: { in: d.serverVariantIds } }
        })
      : undefined;
    let serverImplementations = d.serverImplementationIds?.length
      ? await db.serverImplementation.findMany({
          where: { id: { in: d.serverImplementationIds } }
        })
      : undefined;
    let sessions = d.sessionIds?.length
      ? await db.session.findMany({
          where: { id: { in: d.sessionIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverDeployment.findMany({
            ...opts,
            where: {
              status: d.status ? { in: d.status } : { notIn: ['archived', 'deleted'] },
              isEphemeral: false,

              instanceOid: d.instance.oid,

              serverOid: servers ? { in: servers.map(s => s.oid) } : undefined,
              serverImplementationOid: serverImplementations
                ? { in: serverImplementations.map(s => s.oid) }
                : undefined,
              serverImplementation: serverVariants
                ? { serverVariantOid: { in: serverVariants.map(s => s.oid) } }
                : undefined,

              sessionsOldDontUse: sessions
                ? {
                    some: {
                      oid: { in: sessions.map(s => s.oid) }
                    }
                  }
                : undefined,

              id: search ? { in: search.map(s => s.id) } : undefined
            },
            include
          })
      )
    );
  }
}

export let serverDeploymentService = Service.create(
  'serverDeployment',
  () => new ServerDeploymentServiceImpl()
).build();
