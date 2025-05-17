import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
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
};

class ServerRunErrorImpl {
  async getServerRunErrorById(d: { instance: Instance; serverRunErrorId: string }) {
    let serverRunError = await db.serverRunError.findFirst({
      where: {
        id: d.serverRunErrorId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverRunError) throw new ServiceError(notFoundError('server.server_run.error'));

    return serverRunError;
  }

  async listServerRunErrors(d: {
    instance: Instance;

    serverSessionIds?: string[];
    serverDeploymentIds?: string[];
    serverImplementationIds?: string[];
  }) {
    let serverSessions = d.serverSessionIds?.length
      ? await db.serverSession.findMany({
          where: { id: { in: d.serverSessionIds } }
        })
      : undefined;
    let serverDeployments = d.serverDeploymentIds?.length
      ? await db.serverDeployment.findMany({
          where: { id: { in: d.serverDeploymentIds } }
        })
      : undefined;
    let serverImplementations = d.serverImplementationIds?.length
      ? await db.serverImplementation.findMany({
          where: { id: { in: d.serverImplementationIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverRunError.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              AND: [
                serverSessions
                  ? {
                      serverRun: {
                        serverSessionOid: { in: serverSessions?.map(s => s.oid) }
                      }
                    }
                  : undefined!,
                serverDeployments
                  ? {
                      serverDeploymentOid: { in: serverDeployments.map(s => s.oid) }
                    }
                  : undefined!,
                serverImplementations
                  ? {
                      serverDeployment: {
                        serverImplementationOid: { in: serverImplementations.map(s => s.oid) }
                      }
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }
}

export let serverRunErrorService = Service.create(
  'serverRunError',
  () => new ServerRunErrorImpl()
).build();
