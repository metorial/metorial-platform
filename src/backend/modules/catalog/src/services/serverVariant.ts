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
  async getServerVariantById(
    d: { serverVariantId: string } & ({ server: Server } | { instance: Instance })
  ) {
    let serverVariant = await db.serverVariant.findFirst({
      where: {
        serverOid: 'server' in d ? d.server.oid : undefined,

        // TODO: when we add private servers, we need to check the instance here
        // OR: [{server: {type: 'imported'}}, {server: {type: 'instance', instanceOid: d.instance.oid}}],

        OR: [{ id: d.serverVariantId }, { identifier: d.serverVariantId }]
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
