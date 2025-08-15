import {
  CustomServer,
  CustomServerType,
  db,
  ID,
  Instance,
  Organization,
  RemoteServerInstance,
  Server,
  withTransaction
} from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { profileService } from '@metorial/module-community';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { createShortIdGenerator } from '@metorial/slugify';
import { customServerVersionService } from './customServerVersion';

let include = {
  server: true,
  instance: true,
  serverVariant: true,
  currentVersion: true
};

let getVariantIdentifier = createShortIdGenerator(
  async id => !(await db.serverVariant.findFirst({ where: { identifier: id } })),
  { length: 8 }
);

class customServerServiceImpl {
  async createCustomServer(d: {
    instance: Instance;
    organization: Organization;

    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
    };

    serverInstance: {
      type: 'remote';
      implementation: RemoteServerInstance;

      config?: {
        schema?: any;
        getLaunchParams?: string;
      };
    };

    isEphemeral: boolean;
  }) {
    return withTransaction(async db => {
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

          // TODO: Add other service types as needed
          sourceType:
            d.serverInstance.type == 'remote'
              ? 'remote'
              : (() => {
                  throw new Error('Unsupported server type');
                })()
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
          description: d.input.description
        }
      });

      await customServerVersionService.createVersion({
        server: customServer,
        instance: d.instance,
        organization: d.organization,
        serverInstance: d.serverInstance,

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
      await db.server.updateMany({
        where: { oid: d.server.serverOid },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        }
      });

      let server = await db.customServer.update({
        where: { id: d.server.id },
        data: {
          name: d.input.name,
          description: d.input.description
        },
        include
      });

      return server;
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
