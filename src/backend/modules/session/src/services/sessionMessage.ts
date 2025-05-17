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

  async listSessionMessages(d: { session: Session }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionMessage.findMany({
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

export let sessionMessageService = Service.create(
  'sessionMessage',
  () => new SessionMessageImpl()
).build();
