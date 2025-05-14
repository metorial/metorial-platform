import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Server,
  ServerDeployment,
  ServerDeploymentStatus,
  ServerInstance,
  ServerVariant,
  withTransaction
} from '@metorial/db';
import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { serverVariantService } from '@metorial/module-catalog';
import { ingestEventService } from '@metorial/module-event';
import { secretService } from '@metorial/module-secret';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { Ajv } from 'ajv';

let ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true
});

let include = {
  serverInstance: {
    include: {
      server: true,
      serverVariant: true
    }
  },
  server: true,
  configSecret: true
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
    serverInstance: ServerInstance & { serverVariant: ServerVariant; server: Server };
    config: Record<string, any>;
  }) {
    let variant = await serverVariantService.getServerVariantById({
      serverVariantId: d.serverInstance.serverVariant.id,
      server: d.serverInstance.server
    });
    if (!variant.currentVersion) {
      throw new ServiceError(
        badRequestError({
          message: 'Server variant cannot be deployed to Metorial'
        })
      );
    }

    let config = variant.currentVersion.config;

    let validate = ajv.compile(config.schema);
    let data = { ...d.config };

    if (!validate(data)) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid server deployment config',
          errors: validate.errors?.map(e => ({
            message: e.message,
            code: e.keyword,
            params: e.params
          }))
        })
      );
    }

    return {
      data,
      config
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

  async createServerDeployment(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;

    serverInstance: {
      instance: ServerInstance & { serverVariant: ServerVariant; server: Server };
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
      if (!d.serverInstance.isNewEphemeral && d.serverInstance.instance.status != 'active') {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot create a server deployment for a deleted server instance'
          })
        );
      }

      let { config, data } = await this.checkServerDeploymentConfig({
        serverInstance: d.serverInstance.instance,
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

      let serverDeployment = await db.serverDeployment.create({
        data: {
          id: await ID.generateId('serverDeployment'),
          status: d.type === 'ephemeral' ? 'archived' : 'active',
          isEphemeral: d.type === 'ephemeral',

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          serverInstanceOid: d.serverInstance.instance.oid,
          serverOid: d.serverInstance.instance.server.oid,
          configOid: config.oid,
          configSecretOid: secret.oid,
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
      serverInstance: ServerInstance & {
        serverVariant: ServerVariant;
        server: Server;
      };
    };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config?: Record<string, any>;
    };
  }) {
    await this.ensureServerDeploymentActive(d.serverDeployment);

    return withTransaction(async db => {
      let newSecretOid: bigint | undefined = undefined;
      let oldSecretOid: bigint | undefined = undefined;
      let newConfigOid: bigint | undefined = undefined;

      if (d.input.config) {
        let { config, data } = await this.checkServerDeploymentConfig({
          serverInstance: d.serverDeployment.serverInstance,
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

        newSecretOid = secret.oid;
        newConfigOid = config.oid;

        oldSecretOid = d.serverDeployment.configSecretOid;
      }

      let serverDeployment = await db.serverDeployment.update({
        where: {
          id: d.serverDeployment.id
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          configSecretOid: newSecretOid,
          configOid: newConfigOid
        },
        include
      });

      if (typeof oldSecretOid == 'bigint' && oldSecretOid !== newSecretOid) {
        await secretService.deleteSecret({
          performedBy: d.performedBy,
          secret: await secretService.getSecretById({
            instance: d.instance,
            secretId: oldSecretOid
          })
        });
      }

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
    serverDeployment: ServerDeployment;
  }) {
    await this.ensureServerDeploymentActive(d.serverDeployment);

    return withTransaction(async db => {
      await secretService.deleteSecret({
        performedBy: d.performedBy,
        secret: await secretService.getSecretById({
          instance: d.instance,
          secretId: d.serverDeployment.configSecretOid
        })
      });

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

      return serverDeployment;
    });
  }

  async listServerDeployments(d: {
    serverVariantIds?: string[];
    serverInstanceIds?: string[];
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
    let serverInstances = d.serverInstanceIds?.length
      ? await db.serverInstance.findMany({
          where: { id: { in: d.serverInstanceIds } }
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
              serverInstanceOid: serverInstances
                ? { in: serverInstances.map(s => s.oid) }
                : undefined,
              serverInstance: serverVariants
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
