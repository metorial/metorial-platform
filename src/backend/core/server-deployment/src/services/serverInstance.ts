import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Server,
  ServerInstance,
  ServerInstanceStatus,
  ServerVariant,
  withTransaction
} from '@metorial/db';
import { forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { ingestEventService } from '@metorial/module-event';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  server: true,
  serverVariant: true
};

class ServerInstanceServiceImpl {
  private async ensureServerInstanceActive(serverInstance: ServerInstance) {
    if (serverInstance.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted server_instance'
        })
      );
    }
  }

  async getServerInstanceById(d: { instance: Instance; serverInstanceId: string }) {
    let serverInstance = await db.serverInstance.findFirst({
      where: {
        id: d.serverInstanceId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverInstance)
      throw new ServiceError(notFoundError('server_instance', d.serverInstanceId));

    return serverInstance;
  }

  async createServerInstance(d: {
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
    return withTransaction(async db => {
      let serverInstance = await db.serverInstance.create({
        data: {
          id: await ID.generateId('serverInstance'),
          status: d.type === 'ephemeral' ? 'archived' : 'active',
          isEphemeral: d.type === 'ephemeral',

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

      await ingestEventService.ingest('server.server_instance:created', {
        serverInstance,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      return serverInstance;
    });
  }

  async updateServerInstance(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverInstance: ServerInstance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      getLaunchParams?: string;
    };
  }) {
    await this.ensureServerInstanceActive(d.serverInstance);

    return withTransaction(async db => {
      let serverInstance = await db.serverInstance.update({
        where: {
          id: d.serverInstance.id
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          getLaunchParams: d.input.getLaunchParams
        },
        include
      });

      await ingestEventService.ingest('server.server_instance:updated', {
        serverInstance,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      return serverInstance;
    });
  }

  async deleteServerInstance(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    serverInstance: ServerInstance;
  }) {
    await this.ensureServerInstanceActive(d.serverInstance);

    return withTransaction(async db => {
      let serverInstance = await db.serverInstance.update({
        where: {
          id: d.serverInstance.id
        },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include
      });

      await ingestEventService.ingest('server.server_instance:deleted', {
        serverInstance,
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance
      });

      return serverInstance;
    });
  }

  async listServerInstances(d: {
    serverVariantIds?: string[];
    serverIds?: string[];
    instance: Instance;
    status?: ServerInstanceStatus[];
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
          await db.serverInstance.findMany({
            ...opts,
            where: {
              status: d.status ? { in: d.status } : undefined,
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

export let serverInstanceService = Service.create(
  'serverInstance',
  () => new ServerInstanceServiceImpl()
).build();
