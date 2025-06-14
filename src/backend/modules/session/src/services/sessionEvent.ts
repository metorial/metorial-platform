import { db, Session } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  serverRun: {
    include: {
      serverVersion: true,
      serverDeployment: {
        include: {
          server: true
        }
      },
      serverSession: true
    }
  },
  serverRunError: {
    include: {
      serverRun: {
        include: {
          serverVersion: true,
          serverDeployment: {
            include: {
              server: true
            }
          },
          serverSession: true
        }
      }
    }
  }
};

class SessionEventImpl {
  async getSessionEventById(d: { session: Session; sessionEventId: string }) {
    let sessionEvent = await db.sessionEvent.findFirst({
      where: {
        id: d.sessionEventId,
        sessionOid: d.session.oid
      },
      include
    });
    if (!sessionEvent) throw new ServiceError(notFoundError('server_session'));

    return sessionEvent;
  }

  async listSessionEvents(d: {
    session: Session;
    serverRunIds?: string[];
    serverSessionIds?: string[];
  }) {
    let serverRuns = d.serverRunIds?.length
      ? await db.serverRun.findMany({
          where: { id: { in: d.serverRunIds }, instanceOid: d.session.instanceOid }
        })
      : undefined;

    let serverSessions = d.serverSessionIds?.length
      ? await db.serverSession.findMany({
          where: { id: { in: d.serverSessionIds }, instanceOid: d.session.instanceOid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionEvent.findMany({
            ...opts,
            where: {
              sessionOid: d.session.oid,

              AND: [
                serverRuns
                  ? {
                      serverRunOid: { in: serverRuns.map(s => s.oid) }
                    }
                  : undefined!,

                serverSessions
                  ? {
                      serverRun: {
                        serverSessionOid: { in: serverSessions.map(s => s.oid) }
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

export let sessionEventService = Service.create(
  'sessionEvent',
  () => new SessionEventImpl()
).build();
