import { db, Session } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  serverRun: {
    include: {
      serverVersion: true,
      serverDeployment: true,
      serverSession: true
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

  async listSessionEvents(d: { session: Session }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionEvent.findMany({
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

export let sessionEventService = Service.create(
  'sessionEvent',
  () => new SessionEventImpl()
).build();
