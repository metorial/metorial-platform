import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Server,
  ServerDeployment,
  ServerDeploymentConfig,
  ServerDeploymentStatus,
  ServerImplementation,
  ServerVariant,
  withTransaction
} from '@metorial/db';
import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { serverVariantService } from '@metorial/module-catalog';
import { ingestEventService } from '@metorial/module-event';
import { secretService } from '@metorial/module-secret';
import { Paginator } from '@metorial/pagination';
import { getSentry } from '@metorial/sentry';
import { Service } from '@metorial/service';
import { Validator } from 'jsonschema';
import { serverDeploymentDeletedQueue } from '../queues/serverDeploymentDeleted';

let Sentry = getSentry();

let validator = new Validator();

let include = {
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
    config: Record<string, any>;
  }) {
    let variant = await serverVariantService.getServerVariantById({
      serverVariantId: d.serverImplementation.serverVariant.id,
      server: d.serverImplementation.server
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
      }
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

    serverImplementation: {
      instance: ServerImplementation & { serverVariant: ServerVariant; server: Server };
      isNewEphemeral: boolean;
    };

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config: Record<string, any>;
    };
    type: 'ephemeral' | 'persistent';
  }) {
    return withTransaction(async db => {
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

      let { schema, data } = await this.checkServerDeploymentConfig({
        serverImplementation: d.serverImplementation.instance,
        config: d.input.config
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

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          serverImplementationOid: d.serverImplementation.instance.oid,
          serverOid: d.serverImplementation.instance.server.oid,
          serverVariantOid: d.serverImplementation.instance.serverVariant.oid,
          configOid: config.oid,
          instanceOid: d.instance.oid
        },
        include
      });

      await ingestEventService.ingest('server.server_deployment:created', {
        serverDeployment,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      return serverDeployment;
    });
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
          config: d.input.config
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

      return serverDeployment;
    });
  }

  async deleteServerDeployment(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverDeployment: ServerDeployment & {
      config: ServerDeploymentConfig;
    };
  }) {
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

      return serverDeployment;
    });
  }

  async listServerDeployments(d: {
    serverVariantIds?: string[];
    serverImplementationIds?: string[];
    serverIds?: string[];
    instance: Instance;
    status?: ServerDeploymentStatus[];
  }) {
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

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverDeployment.findMany({
            ...opts,
            where: {
              status: d.status ? { in: d.status } : undefined,
              isEphemeral: false,

              instanceOid: d.instance.oid,

              serverOid: servers ? { in: servers.map(s => s.oid) } : undefined,
              serverImplementationOid: serverImplementations
                ? { in: serverImplementations.map(s => s.oid) }
                : undefined,
              serverImplementation: serverVariants
                ? { serverVariantOid: { in: serverVariants.map(s => s.oid) } }
                : undefined
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
