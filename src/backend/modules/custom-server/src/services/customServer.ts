import {
  CodeBucketTemplate,
  CustomServer,
  CustomServerType,
  db,
  ID,
  Instance,
  ManagedServerTemplate,
  Organization,
  OrganizationActor,
  Server,
  withTransaction
} from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { serverListingService } from '@metorial/module-catalog';
import { codeBucketService } from '@metorial/module-code-bucket';
import { profileService } from '@metorial/module-community';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { createShortIdGenerator } from '@metorial/slugify';
import { customServerVersionService } from './customServerVersion';

let include = {
  server: true,
  instance: true,
  serverVariant: true,
  currentVersion: true,
  draftCodeBucket: true
};

let getVariantIdentifier = createShortIdGenerator(
  async id => !(await db.serverVariant.findFirst({ where: { identifier: id } })),
  { length: 8 }
);

class customServerServiceImpl {
  async createCustomServer(d: {
    instance: Instance;
    organization: Organization;
    performedBy: OrganizationActor;

    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
    };

    serverInstance:
      | {
          type: 'remote';
          implementation: {
            remoteUrl: string;
          };
          config?: {
            schema?: any;
            getLaunchParams?: string;
          };
        }
      | {
          type: 'managed';
          implementation: {
            template?: ManagedServerTemplate & {
              bucketTemplate: CodeBucketTemplate;
            };
          };
          config?: {
            schema?: any;
            getLaunchParams?: string;
          };
        };

    isEphemeral: boolean;
  }) {
    return withTransaction(async db => {
      let codeBucket = await (async () => {
        if (d.serverInstance.type != 'managed') return;

        if (!d.serverInstance.implementation.template) {
          return await codeBucketService.createCodeBucket({
            instance: d.instance,
            purpose: 'custom_server'
          });
        }

        return await codeBucketService.cloneCodeBucketTemplate({
          instance: d.instance,
          purpose: 'custom_server',
          template: d.serverInstance.implementation.template.bucketTemplate
        });
      })();

      let server = await db.server.create({
        data: {
          id: await ID.generateId('server'),
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          type: 'custom',
          ownerOrganizationOid: d.organization.oid,
          isPublic: false
        }
      });

      setTimeout(async () => {
        await serverListingService.setServerListing({
          server,
          instance: d.instance,
          organization: d.organization
        });
      }, 5000);

      let profile = await profileService.ensureProfile({
        for: {
          type: 'organization',
          organization: d.organization
        }
      });
      let provider = await profileService.ensureProfileVariantProvider({
        profile
      });

      let variant = await db.serverVariant.create({
        data: {
          id: await ID.generateId('serverVariant'),
          identifier: await getVariantIdentifier(),

          // There can be multiple production instances,
          // and hence also multiple default variants.
          // This is not unique.
          isDefault: d.instance.type == 'production',

          defaultForInstanceOid: d.instance.oid,

          providerOid: provider.oid,
          serverOid: server.oid,

          remoteUrl:
            d.serverInstance.type == 'remote'
              ? d.serverInstance.implementation.remoteUrl
              : null,

          sourceType: d.serverInstance.type
        }
      });

      let customServer = await db.customServer.create({
        data: {
          id: await ID.generateId('customServer'),
          type: d.serverInstance.type,
          status: d.isEphemeral ? 'archived' : 'active',
          isEphemeral: d.isEphemeral,
          serverOid: server.oid,
          organizationOid: d.organization.oid,
          serverVariantOid: variant.oid,
          instanceOid: d.instance.oid,
          name: d.input.name,
          description: d.input.description,
          draftCodeBucketOid: codeBucket?.oid
        }
      });

      await customServerVersionService.createVersion({
        server: customServer,
        instance: d.instance,
        organization: d.organization,
        serverInstance:
          d.serverInstance.type == 'managed'
            ? {
                type: 'managed',
                implementation: {},
                config: d.serverInstance.config
              }
            : d.serverInstance,
        performedBy: d.performedBy,

        // Permits us to update the server, even though it is not active.
        isEphemeralUpdate: d.isEphemeral
      });

      return (await db.customServer.findFirst({
        where: { id: customServer.id },
        include
      }))!;
    });
  }

  async updateCustomServer(d: {
    server: CustomServer;
    instance: Instance;
    organization: Organization;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    if (d.server.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update inactive server version'
        })
      );
    }

    return withTransaction(async db => {
      let server = await db.server.update({
        where: { oid: d.server.serverOid },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        }
      });

      setTimeout(async () => {
        await serverListingService.setServerListing({
          server,
          instance: d.instance,
          organization: d.organization
        });
      }, 2000);

      let customServer = await db.customServer.update({
        where: { id: d.server.id },
        data: {
          name: d.input.name,
          description: d.input.description
        },
        include
      });

      return customServer;
    });
  }

  async deleteCustomServer(d: { server: CustomServer & { server: Server } }) {
    if (d.server.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update inactive server version'
        })
      );
    }

    if (d.server.server.isPublic) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete public server'
        })
      );
    }

    return withTransaction(async db => {
      await db.server.updateMany({
        where: { oid: d.server.serverOid },
        data: { status: 'inactive' }
      });
      await db.serverVariant.updateMany({
        where: { serverOid: d.server.serverOid },
        data: { status: 'inactive' }
      });

      let server = await db.customServer.update({
        where: { id: d.server.id },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include
      });

      return server;
    });
  }

  async listCustomServers(d: { organization: Organization; types?: CustomServerType[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customServer.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active',
              type: d.types ? { in: d.types } : undefined
            },
            include
          })
      )
    );
  }

  async getCustomServerById(d: { organization: Organization; serverId: string }) {
    let server = await db.customServer.findFirst({
      where: {
        id: d.serverId,
        organizationOid: d.organization.oid
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('custom_server', d.serverId));
    }

    return server;
  }
}

export let customServerService = Service.create(
  'customServer',
  () => new customServerServiceImpl()
).build();
