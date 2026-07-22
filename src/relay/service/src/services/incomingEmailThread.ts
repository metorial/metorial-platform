import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Sender } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  inbox: true
};

class IncomingEmailThreadService {
  async getIncomingEmailThreadById(d: { sender: Sender; id: string }) {
    let thread = await db.incomingEmailThread.findFirst({
      where: {
        id: d.id,
        inbox: {
          senderOid: d.sender.oid
        }
      },
      include
    });

    if (!thread) throw new ServiceError(notFoundError('incoming_email_thread'));
    return thread;
  }

  async getManyIncomingEmailThreadsByIds(d: { sender: Sender; ids: string[] }) {
    return await db.incomingEmailThread.findMany({
      where: {
        id: { in: d.ids },
        inbox: {
          senderOid: d.sender.oid
        }
      },
      include
    });
  }

  async listIncomingEmailThreads(d: {
    sender: Sender;
    inboxIds?: string[];
    ids?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.incomingEmailThread.findMany({
            ...opts,
            where: {
              id: d.ids ? { in: d.ids } : undefined,
              inbox: {
                senderOid: d.sender.oid,
                id: d.inboxIds ? { in: d.inboxIds } : undefined
              }
            },
            include
          })
      )
    );
  }
}

export let incomingEmailThreadService = Service.create(
  'incomingEmailThreadService',
  () => new IncomingEmailThreadService()
).build();
