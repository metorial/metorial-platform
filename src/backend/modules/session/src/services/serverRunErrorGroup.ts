import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  defaultServerRunError: {
    include: {
      serverRun: {
        include: {
          serverDeployment: true,
          serverVersion: true,
          serverSession: {
            include: {
              session: true
            }
          }
        }
      }
    }
  }
};

class ServerRunErrorGroupImpl {
  async getServerRunErrorGroupById(d: { instance: Instance; serverRunErrorGroupId: string }) {
    let serverRunErrorGroup = await db.serverRunErrorGroup.findFirst({
      where: {
        id: d.serverRunErrorGroupId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverRunErrorGroup)
      throw new ServiceError(notFoundError('server.server_run.error_group'));

    return serverRunErrorGroup;
  }

  async listServerRunErrorGroups(d: { instance: Instance; serverIds?: string[] }) {
    let servers = d.serverIds?.length
      ? await db.server.findMany({
          where: { id: { in: d.serverIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverRunErrorGroup.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              AND: [
                servers ? { serverOid: { in: servers?.map(s => s.oid) } } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }
}

export let serverRunErrorGroupService = Service.create(
  'serverRunErrorGroup',
  () => new ServerRunErrorGroupImpl()
).build();
