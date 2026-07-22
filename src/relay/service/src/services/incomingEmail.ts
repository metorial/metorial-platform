import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { IncomingEmailThread, Sender } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { normalizeThreadSubject, parseIncomingEmail } from '../lib/incomingEmail';
import { emailService } from './email';

let include = {
  inbox: true,
  thread: true
};

let unique = <T>(items: T[]) => [...new Set(items)];

let getReplySubject = (subject: string) =>
  /^re\s*:/i.test(subject) ? subject : `Re: ${subject || '(no subject)'}`;

class IncomingEmailService {
  async receiveEmail(d: { sender: Sender; raw: string }) {
    let parsed = await parseIncomingEmail(d.raw);

    if (parsed.recipients.length == 0) {
      throw new ServiceError(
        badRequestError({
          message: 'Incoming email does not contain a supported recipient'
        })
      );
    }

    let inbox = await db.inbox.findFirst({
      where: {
        email: { in: parsed.recipients },
        senderOid: d.sender.oid
      }
    });

    if (!inbox) {
      throw new ServiceError(
        badRequestError({
          message: 'Incoming email recipient is not registered as an inbox'
        })
      );
    }

    if (parsed.messageId) {
      let existing = await db.incomingEmail.findFirst({
        where: {
          messageId: parsed.messageId,
          inboxOid: inbox.oid
        },
        include
      });

      if (existing) return existing;
    }

    let messageIds = unique([...parsed.inReplyToIds, ...parsed.referenceIds]);
    let thread = await this.resolveThread({
      sender: d.sender,
      inboxOid: inbox.oid,
      messageIds
    });

    if (!thread) {
      thread = await db.incomingEmailThread.create({
        data: {
          ...getId('incomingEmailThread'),
          inboxOid: inbox.oid,
          subject: normalizeThreadSubject(parsed.subject)
        },
        include: {
          inbox: true
        }
      });
    }

    return await db.incomingEmail.create({
      data: {
        ...getId('incomingEmail'),
        inboxOid: inbox.oid,
        threadOid: thread.oid,
        from: parsed.from,
        to: inbox.email,
        subject: parsed.subject,
        text: parsed.text,
        messageId: parsed.messageId,
        headers: parsed.headers
      },
      include
    });
  }

  async getIncomingEmailById(d: { sender: Sender; id: string }) {
    let email = await db.incomingEmail.findFirst({
      where: {
        id: d.id,
        inbox: {
          senderOid: d.sender.oid
        }
      },
      include
    });

    if (!email) throw new ServiceError(notFoundError('incoming_email'));
    return email;
  }

  async getManyIncomingEmailsByIds(d: { sender: Sender; ids: string[] }) {
    return await db.incomingEmail.findMany({
      where: {
        id: { in: d.ids },
        inbox: {
          senderOid: d.sender.oid
        }
      },
      include
    });
  }

  async listIncomingEmails(d: {
    sender: Sender;
    inboxIds?: string[];
    threadIds?: string[];
    ids?: string[];
    messageIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.incomingEmail.findMany({
            ...opts,
            where: {
              id: d.ids ? { in: d.ids } : undefined,
              messageId: d.messageIds ? { in: d.messageIds } : undefined,
              inbox: {
                senderOid: d.sender.oid,
                id: d.inboxIds ? { in: d.inboxIds } : undefined
              },
              thread: d.threadIds
                ? {
                    id: { in: d.threadIds }
                  }
                : undefined
            },
            include
          })
      )
    );
  }

  async replyToIncomingEmail(d: {
    sender: Sender;
    incomingEmailId: string;
    emailIdentityId: string;
    input: {
      to?: string[];
      template?: any;
      content: {
        subject?: string;
        html: string;
        text: string;
      };
    };
  }) {
    let incomingEmail = await this.getIncomingEmailById({
      sender: d.sender,
      id: d.incomingEmailId
    });
    let emailIdentity = await emailService.getIdentityById({
      sender: d.sender,
      id: d.emailIdentityId
    });
    let to = d.input.to?.length ? d.input.to : incomingEmail.from ? [incomingEmail.from] : [];

    if (to.length == 0) {
      throw new ServiceError(
        badRequestError({
          message: 'Reply must have at least one destination'
        })
      );
    }

    return await emailService.sendEmail({
      identity: emailIdentity,
      type: 'email',
      to,
      template: d.input.template ?? {},
      content: {
        subject: d.input.content.subject ?? getReplySubject(incomingEmail.subject),
        html: d.input.content.html,
        text: d.input.content.text
      },
      incomingEmailThread: incomingEmail.thread,
      replyToIncomingEmail: incomingEmail
    });
  }

  private async resolveThread(d: {
    sender: Sender;
    inboxOid: bigint;
    messageIds: string[];
  }): Promise<IncomingEmailThread | null> {
    if (d.messageIds.length == 0) return null;

    let previousIncomingEmail = await db.incomingEmail.findFirst({
      where: {
        messageId: { in: d.messageIds },
        inbox: {
          senderOid: d.sender.oid
        }
      },
      include: {
        thread: true
      }
    });

    if (previousIncomingEmail) return previousIncomingEmail.thread;

    let previousOutgoingSend = await db.outgoingEmailSend.findFirst({
      where: {
        messageId: { in: d.messageIds },
        destination: {
          email: {
            identity: {
              senderOid: d.sender.oid
            }
          }
        }
      },
      include: {
        destination: {
          include: {
            email: {
              include: {
                incomingEmailThread: true,
                replyToIncomingEmail: {
                  include: {
                    thread: true
                  }
                }
              }
            }
          }
        }
      }
    });

    let outgoingEmail = previousOutgoingSend?.destination.email;
    let outgoingThread =
      outgoingEmail?.incomingEmailThread ?? outgoingEmail?.replyToIncomingEmail?.thread ?? null;

    if (outgoingThread) return outgoingThread;

    return await db.incomingEmailThread.findFirst({
      where: {
        inboxOid: d.inboxOid,
        emails: {
          some: {
            messageId: { in: d.messageIds }
          }
        }
      }
    });
  }
}

export let incomingEmailService = Service.create(
  'incomingEmailService',
  () => new IncomingEmailService()
).build();
