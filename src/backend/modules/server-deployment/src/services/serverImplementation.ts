import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Server,
  ServerImplementation,
  ServerImplementationStatus,
  ServerVariant,
  withTransaction
} from '@metorial/db';
import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { ingestEventService } from '@metorial/module-event';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { serverImplementationCreatedQueue } from '../queues/serverImplementationCreated';

let include = {
  server: true,
  serverVariant: true,
  providerOAuthConfig: true
};

class ServerImplementationServiceImpl {
  private async ensureServerImplementationActive(serverImplementation: ServerImplementation) {
    if (serverImplementation.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted server_implementation'
        })
      );
    }
  }

  async getServerImplementationById(d: {
    instance: Instance;
    serverImplementationId: string;
  }) {
    let serverImplementation = await db.serverImplementation.findFirst({
      where: {
        id: d.serverImplementationId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverImplementation)
      throw new ServiceError(
        notFoundError('server.server_implementation', d.serverImplementationId)
      );

    return serverImplementation;
  }

  async createServerImplementation(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverVariant: ServerVariant & { server: Server };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      getLaunchParams?: string;
    };
    type: 'ephemeral' | 'persistent';
  }) {
    if (d.serverVariant.status !== 'active' || d.serverVariant.server.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create server implementation for inactive server'
        })
      );
    }

    await Fabric.fire('server.server_implementation.created:before', {
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance
    });

    return withTransaction(async db => {
      let serverImplementation = await db.serverImplementation.create({
        data: {
          id: await ID.generateId('serverImplementation'),
          status: d.type === 'ephemeral' ? 'archived' : 'active',
          isEphemeral: d.type === 'ephemeral',
          isDefault: null, // MUST BE NULL, NOT FALSE

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          getLaunchParams: d.input.getLaunchParams,

          serverVariantOid: d.serverVariant.oid,
          serverOid: d.serverVariant.server.oid,
          instanceOid: d.instance.oid
        },
        include
      });

      await ingestEventService.ingest('server.server_implementation:created', {
        serverImplementation,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      await serverImplementationCreatedQueue.add(
        { serverImplementationId: serverImplementation.id },
        { delay: 100 }
      );

      await Fabric.fire('server.server_implementation.created:after', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        implementation: serverImplementation
      });

      return serverImplementation;
    });
  }

  async ensureDefaultImplementation(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverVariant: ServerVariant & { server: Server };
  }) {
    return withTransaction(async db => {
      let id = await ID.generateId('serverImplementation');

      let defaultImplementation = await db.serverImplementation.findUnique({
        where: {
          serverVariantOid_instanceOid_isDefault: {
            serverVariantOid: d.serverVariant.oid,
            instanceOid: d.instance.oid,
            isDefault: true
          }
        },
        include
      });
      if (defaultImplementation) return defaultImplementation;

      if (d.serverVariant.status !== 'active' || d.serverVariant.server.status !== 'active') {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot create server implementation for inactive server'
          })
        );
      }

      await Fabric.fire('server.server_implementation.created:before', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      let serverImplementation = await db.serverImplementation.upsert({
        where: {
          serverVariantOid_instanceOid_isDefault: {
            serverVariantOid: d.serverVariant.oid,
            instanceOid: d.instance.oid,
            isDefault: true
          }
        },
        update: {},
        create: {
          id,
          status: 'active',
          isEphemeral: false,
          isDefault: true,

          serverVariantOid: d.serverVariant.oid,
          serverOid: d.serverVariant.server.oid,
          instanceOid: d.instance.oid
        },
        include
      });

      if (serverImplementation.id == id) {
        await ingestEventService.ingest('server.server_implementation:created', {
          serverImplementation,
          organization: d.organization,
          performedBy: d.performedBy,
          instance: d.instance
        });

        await serverImplementationCreatedQueue.add(
          { serverImplementationId: serverImplementation.id },
          { delay: 100 }
        );
      }

      await Fabric.fire('server.server_implementation.created:after', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        implementation: serverImplementation
      });

      return serverImplementation;
    });
  }

  async updateServerImplementation(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverImplementation: ServerImplementation;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Record<string, any>;
      getLaunchParams?: string;
    };
  }) {
    await Fabric.fire('server.server_implementation.updated:before', {
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance,
      implementation: d.serverImplementation
    });

    await this.ensureServerImplementationActive(d.serverImplementation);

    return withTransaction(async db => {
      let serverImplementation = await db.serverImplementation.update({
        where: {
          id: d.serverImplementation.id
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          getLaunchParams: d.input.getLaunchParams
        },
        include
      });

      await ingestEventService.ingest('server.server_implementation:updated', {
        serverImplementation,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      await Fabric.fire('server.server_implementation.updated:after', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        implementation: serverImplementation
      });

      return serverImplementation;
    });
  }

  async deleteServerImplementation(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverImplementation: ServerImplementation;
  }) {
    await Fabric.fire('server.server_implementation.deleted:before', {
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance,
      implementation: d.serverImplementation
    });

    await this.ensureServerImplementationActive(d.serverImplementation);

    return withTransaction(async db => {
      let serverImplementation = await db.serverImplementation.update({
        where: {
          id: d.serverImplementation.id
        },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include
      });

      await ingestEventService.ingest('server.server_implementation:deleted', {
        serverImplementation,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      await Fabric.fire('server.server_implementation.deleted:after', {
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        implementation: serverImplementation
      });

      await db.serverDeployment.updateMany({
        where: { serverImplementationOid: serverImplementation.oid },
        data: { status: 'deleted', deletedAt: new Date() }
      });

      return serverImplementation;
    });
  }

  async listServerImplementations(d: {
    serverVariantIds?: string[];
    serverIds?: string[];
    instance: Instance;
    status?: ServerImplementationStatus[];
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

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverImplementation.findMany({
            ...opts,
            where: {
              status: d.status ? { in: d.status } : { notIn: ['archived', 'deleted'] },
              isEphemeral: false,

              instanceOid: d.instance.oid,

              serverOid: servers ? { in: servers.map(s => s.oid) } : undefined,
              serverVariantOid: serverVariants
                ? { in: serverVariants.map(s => s.oid) }
                : undefined
            },
            include
          })
      )
    );
  }
}

export let serverImplementationService = Service.create(
  'serverImplementation',
  () => new ServerImplementationServiceImpl()
).build();
