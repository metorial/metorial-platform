import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Inbox, Sender } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { normalizeEmailAddress } from '../lib/emailAddress';

class InboxService {
  async createInbox(d: {
    sender: Sender;
    input: {
      email: string;
    };
  }) {
    let email = normalizeEmailAddress(d.input.email);
    if (!email) {
      throw new ServiceError(
        badRequestError({
          message: 'Inbox email is required'
        })
      );
    }

    let inbox = await db.inbox.upsert({
      where: { email },
      create: {
        ...getId('inbox'),
        email,
        senderOid: d.sender.oid
      },
      update: {}
    });

    if (inbox.senderOid != d.sender.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Inbox email is already provisioned by another sender'
        })
      );
    }

    return inbox;
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
