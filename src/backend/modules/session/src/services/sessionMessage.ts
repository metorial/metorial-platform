import { db, Session } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  serverSession: true
};

class SessionMessageImpl {
  async getSessionMessageById(d: { session: Session; sessionMessageId: string }) {
    let sessionMessage = await db.sessionMessage.findFirst({
      where: {
        id: d.sessionMessageId,
        sessionOid: d.session.oid
      },
      include
    });
    if (!sessionMessage) throw new ServiceError(notFoundError('server_session'));

    return sessionMessage;
  }

  async listSessionMessages(d: {
    session: Session;
    serverRunIds?: string[];
    serverSessionIds?: string[];
  }) {
    let serverRuns = d.serverRunIds?.length
      ? await db.serverRun.findMany({
          where: { id: { in: d.serverRunIds } }
        })
      : undefined;

    let serverSessions = d.serverSessionIds?.length
      ? await db.serverSession.findMany({
          where: { id: { in: d.serverSessionIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionMessage.findMany({
            ...opts,
            where: {
              sessionOid: d.session.oid,

              AND: [
                serverRuns
                  ? {
                      serverSession: {
                        serverRuns: {
                          some: {
                            oid: { in: serverRuns?.map(s => s.oid) }
                          }
                        }
                      }
                    }
                  : undefined!,

                serverSessions
                  ? {
                      serverSessionOid: { in: serverSessions.map(s => s.oid) }
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

export let sessionMessageService = Service.create(
  'sessionMessage',
  () => new SessionMessageImpl()
).build();
