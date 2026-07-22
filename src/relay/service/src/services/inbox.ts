import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Inbox, Sender } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { normalizeEmailAddress } from '../lib/incomingEmail';

class InboxService {
  async createInbox(d: {
    sender: Sender;
    input: {
      email: string;
    };
  }) {
    return await db.inbox.create({
      data: {
        ...getId('inbox'),
        email: normalizeEmailAddress(d.input.email)!,
        senderOid: d.sender.oid
      }
    });
  }

  async getInboxById(d: { sender: Sender; id: string }) {
    let inbox = await db.inbox.findFirst({
      where: {
        id: d.id,
        senderOid: d.sender.oid
      }
    });

    if (!inbox) throw new ServiceError(notFoundError('inbox'));
    return inbox;
  }

  async getManyInboxesByIds(d: { sender: Sender; ids: string[] }) {
    return await db.inbox.findMany({
      where: {
        id: { in: d.ids },
        senderOid: d.sender.oid
      }
    });
  }

  async getInboxByEmail(d: { sender: Sender; email: string }) {
    let inbox = await db.inbox.findFirst({
      where: {
        email: normalizeEmailAddress(d.email),
        senderOid: d.sender.oid
      }
    });

    if (!inbox) throw new ServiceError(notFoundError('inbox'));
    return inbox;
  }

  async listInboxes(d: { sender: Sender }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.inbox.findMany({
            ...opts,
            where: {
              senderOid: d.sender.oid
            }
          })
      )
    );
  }

  async deleteInbox(d: { inbox: Inbox }) {
    return await db.inbox.delete({
      where: { oid: d.inbox.oid }
    });
  }
}

export let inboxService = Service.create('inboxService', () => new InboxService()).build();
