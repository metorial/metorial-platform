import { db, Session } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  serverSession: {
    include: {
      serverDeployment: {
        include: {
          server: true,
          serverVariant: true
        }
      }
    }
  }
};

class SessionConnectionImpl {
  async getSessionConnectionById(d: { session: Session; sessionConnectionId: string }) {
    let sessionConnection = await db.sessionConnection.findFirst({
      where: {
        id: d.sessionConnectionId,
        sessionOid: d.session.oid
      },
      include
    });
    if (!sessionConnection)
      throw new ServiceError(notFoundError('session_connection', d.sessionConnectionId));

    return sessionConnection;
  }

  async listSessionConnections(d: { session: Session }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionConnection.findMany({
            ...opts,
            where: {
              sessionOid: d.session.oid
            },
            include
          })
      )
    );
  }
}

export let sessionConnectionService = Service.create(
  'sessionConnection',
  () => new SessionConnectionImpl()
).build();
