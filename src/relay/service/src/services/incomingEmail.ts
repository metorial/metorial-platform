import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { IncomingEmailThread, Prisma, Sender } from '../../prisma/generated/client';
import { db } from '../db';
import { getId, snowflake } from '../id';
import {
  getIncomingEmailHash,
  normalizeThreadSubject,
  parseIncomingEmail
} from '../lib/incomingEmail';
import { emailService } from './email';

let include = {
  inbox: true,
  thread: true,
  attachments: true
} as const;

type IncomingEmailWithRelations = Prisma.IncomingEmailGetPayload<{
  include: typeof include;
}>;

let unique = <T>(items: T[]) => [...new Set(items)];

let getReplySubject = (subject: string) =>
  /^re\s*:/i.test(subject) ? subject : `Re: ${subject || '(no subject)'}`;

class IncomingEmailService {
  async receiveEmail(d: { sender: Sender; raw: string }): Promise<IncomingEmailWithRelations> {
    let parsed = await parseIncomingEmail(d.raw);

    if (parsed.recipients.length == 0) {
      throw new ServiceError(
        badRequestError({
          message: 'Incoming email does not contain a supported recipient'
        })
      );
    }
    if (!parsed.from) {
      throw new ServiceError(
        badRequestError({
          message: 'Incoming email does not contain a valid sender'
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

    let totalAttachmentSize = parsed.attachments.reduce(
      (total, attachment) => total + attachment.size,
      0
    );
    if (
      parsed.attachments.length > 20 ||
      parsed.attachments.some(attachment => attachment.size > 10 * 1024 * 1024) ||
      totalAttachmentSize > 25 * 1024 * 1024
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Incoming email attachments exceed Relay size limits'
        })
      );
    }

    let dedupKey = parsed.messageId
      ? `message-id:${parsed.messageId}`
      : `sha256:${await getIncomingEmailHash(d.raw)}`;
    let messageIds = unique([...parsed.inReplyToIds, ...parsed.referenceIds]);

    try {
      return await db.$transaction<IncomingEmailWithRelations>(async tx => {
        let existing = await tx.incomingEmail.findUnique({
          where: {
            inboxOid_dedupKey: {
              inboxOid: inbox.oid,
              dedupKey
            }
          },
          include
        });
        if (existing) return existing;

        let thread = await this.resolveThread({
          sender: d.sender,
          inboxOid: inbox.oid,
          messageIds,
          tx
        });

        if (!thread) {
          thread = await tx.incomingEmailThread.create({
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

        return await tx.incomingEmail.create({
          data: {
            ...getId('incomingEmail'),
            inboxOid: inbox.oid,
            threadOid: thread.oid,
            from: parsed.from,
            to: inbox.email,
            subject: parsed.subject,
            text: parsed.text,
            html: parsed.html,
            messageId: parsed.messageId,
            dedupKey,
            headers: parsed.headers,
            attachments: {
              create: parsed.attachments.map(attachment => ({
                id: snowflake.nextId(),
                ...attachment
              }))
            }
          },
          include
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code != 'P2002') throw error;

      let existing = await db.incomingEmail.findUnique({
        where: {
          inboxOid_dedupKey: {
            inboxOid: inbox.oid,
            dedupKey
          }
        },
        include
      });
      if (existing) return existing;
      throw error;
    }
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
      fromName?: string;
      replyTo?: string;
      idempotencyKey?: string;
      attachments?: {
        filename: string;
        contentType: string;
        content: string;
        disposition?: string;
        contentId?: string;
      }[];
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
      fromName: d.input.fromName,
      replyTo: d.input.replyTo,
      idempotencyKey: d.input.idempotencyKey,
      attachments: d.input.attachments,
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
    tx?: any;
  }): Promise<IncomingEmailThread | null> {
    if (d.messageIds.length == 0) return null;
    let client = d.tx ?? db;

    let previousIncomingEmail = await client.incomingEmail.findFirst({
      where: {
        messageId: { in: d.messageIds },
        inboxOid: d.inboxOid
      },
      include: {
        thread: true
      }
    });

    if (previousIncomingEmail) return previousIncomingEmail.thread;

    let previousOutgoingSend = await client.outgoingEmailSend.findFirst({
      where: {
        messageId: { in: d.messageIds },
        destination: {
          email: {
            identity: {
              senderOid: d.sender.oid
            },
            OR: [
              {
                incomingEmailThread: {
                  inboxOid: d.inboxOid
                }
              },
              {
                replyToIncomingEmail: {
                  inboxOid: d.inboxOid
                }
              }
            ]
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
      outgoingEmail?.incomingEmailThread ??
      outgoingEmail?.replyToIncomingEmail?.thread ??
      null;

    if (outgoingThread) return outgoingThread;

    return await client.incomingEmailThread.findFirst({
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
