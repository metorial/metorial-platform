import { db, Server, ServerVariant } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  server: true,
  serverVariant: true,
  schema: true
};

class ServerVersionService {
  async getServerVersionById(d: { serverVersionId: string; server: Server }) {
    let serverVersion = await db.serverVersion.findFirst({
      where: {
        serverOid: d.server.oid,
        OR: [{ id: d.serverVersionId }, { identifier: d.serverVersionId }]
      },
      include
    });
    if (!serverVersion) {
      throw new ServiceError(notFoundError('server_version', d.serverVersionId));
    }

    return serverVersion;
  }

  async listServerVersions(d: { server: Server; variant?: ServerVariant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverVersion.findMany({
            ...opts,
            where: {
              serverOid: d.server.oid,
              serverVariantOid: d.variant?.oid
            },
            include
          })
      )
    );
  }
}

export let serverVersionService = Service.create(
  'serverVersionService',
  () => new ServerVersionService()
).build();
