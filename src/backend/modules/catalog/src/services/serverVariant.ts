import { db, Instance, Server, ServerVariantSourceType } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  currentVersion: {
    include: {
      schema: true
    }
  },
  server: true
};

let serverVariantSourceTypeOrder: ServerVariantSourceType[] = ['remote', 'docker'];

class ServerVariantService {
  async getServerVariantById(d: {
    serverVariantId: string;
    instance?: Instance;
    server?: Server;
  }) {
    let serverVariant = await db.serverVariant.findFirst({
      where: {
        serverOid: d.server ? d.server.oid : undefined,

        AND: [
          {
            OR: [{ id: d.serverVariantId }, { identifier: d.serverVariantId }]
          },

          // {
          //   OR: [
          //     { server: { type: 'imported' } },

          //     ...('instance' in d
          //       ? [
          //           { server: { ownerOrganizationOid: d.instance?.organizationOid } },
          //           { server: { isPublic: true } }
          //         ]
          //       : [])
          //   ]
          // },

          {
            OR: [
              { onlyForInstanceOid: null },
              { onlyForInstanceOid: 'instance' in d ? d.instance?.oid : null }
            ]
          }
        ]
      },
      include
    });
    if (!serverVariant) {
      throw new ServiceError(notFoundError('server_variant', d.serverVariantId));
    }

    return serverVariant;
  }

  async getServerVariantByIdOrLatestServerVariantSafe(d: {
    serverVariantId?: string;
    serverId?: string;
    instance: Instance;
  }) {
    if (d.serverVariantId) {
      return this.getServerVariantById({
        serverVariantId: d.serverVariantId,
        instance: d.instance
      });
    }

    if (d.serverId) {
      let allServerVariant = (
        await db.serverVariant.findMany({
          where: {
            server: { id: d.serverId }
          },
          include: { server: true }
        })
      ).sort((a, b) => {
        let aIndex = serverVariantSourceTypeOrder.indexOf(a.sourceType);
        let bIndex = serverVariantSourceTypeOrder.indexOf(b.sourceType);

        if (aIndex === bIndex) return a.id.localeCompare(b.id);

        return aIndex - bIndex;
      });

      if (allServerVariant.length) return allServerVariant[0];
    }
  }

  async listServerVariants(d: { server: Server }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverVariant.findMany({
            ...opts,
            where: {
              serverOid: d.server.oid
            },
            include
          })
      )
    );
  }
}

export let serverVariantService = Service.create(
  'serverVariantService',
  () => new ServerVariantService()
).build();
