import { db, Instance, ServerRunStatus } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  serverDeployment: {
    include: {
      server: true
    }
  },
  serverVersion: true,
  serverSession: {
    include: {
      session: true
    }
  }
};

class ServerRunImpl {
  async getServerRunById(d: { instance: Instance; serverRunId: string }) {
    let serverRun = await db.serverRun.findFirst({
      where: {
        id: d.serverRunId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverRun) throw new ServiceError(notFoundError('server.server_run'));

    return serverRun;
  }

  async listServerRuns(d: {
    instance: Instance;
    status?: ServerRunStatus[];
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
          await db.serverRun.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              AND: [
                d.status ? { status: { in: d.status } } : undefined!,

                serverSessions
                  ? {
                      serverSessionOid: { in: serverSessions.map(s => s.oid) }
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

export let serverRunService = Service.create('serverRun', () => new ServerRunImpl()).build();
