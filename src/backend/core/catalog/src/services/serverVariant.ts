import { db, Server } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  currentVersion: {
    include: {
      config: true
    }
  },
  server: true
};

class ServerVariantService {
  async getServerVariantById(d: { serverVariantId: string; server: Server }) {
    let serverVariant = await db.serverVariant.findFirst({
      where: {
        serverOid: d.server.oid,
        OR: [{ id: d.serverVariantId }, { identifier: d.serverVariantId }]
      },
      include
    });
    if (!serverVariant) {
      throw new ServiceError(notFoundError('server_variant', d.serverVariantId));
    }

    return serverVariant;
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
