import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { EmailIdentity } from '../../prisma/generated/browser';
import type {
  IncomingEmail,
  IncomingEmailThread,
  Sender
} from '../../prisma/generated/client';
import { db } from '../db';
import { get4ByteIntId, ID, snowflake } from '../id';
import { normalizeEmailAddress } from '../lib/emailAddress';
import { sendEmailQueue } from '../queue/sendEmail';

type EmailAttachmentInput = {
  filename: string;
  contentType: string;
  content: string;
  disposition?: string;
  contentId?: string;
};

let normalizeTemplate = (template: any): any => {
  if (
    typeof template == 'string' ||
    typeof template == 'number' ||
    typeof template == 'boolean'
  )
    return template;
  if (typeof template != 'object' || template === null) return undefined;

  if (Array.isArray(template)) return template.map(normalizeTemplate);

  let newObj: any = {};
  for (let key in template) {
    let value = template[key];
    if (typeof value == 'string' || typeof value == 'number' || typeof value == 'boolean') {
      newObj[key] = value;
    } else {
      newObj[key] = normalizeTemplate(value);
    }
  }
  return newObj;
};

let decodeAttachments = (attachments: EmailAttachmentInput[] = []) => {
  if (attachments.length > 20) {
    throw new ServiceError(
      badRequestError({
        message: 'Email attachments exceed Relay count limit'
      })
    );
  }

  let decoded = attachments.map(attachment => {
    if (
      !attachment.filename.trim() ||
      /[\r\n\u0000-\u001f\u007f]/.test(attachment.filename) ||
      !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(attachment.contentType) ||
      (attachment.disposition &&
        attachment.disposition != 'inline' &&
        attachment.disposition != 'attachment') ||
      (attachment.contentId && /[\r\n\u0000-\u001f\u007f]/.test(attachment.contentId))
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Email attachment metadata is invalid'
        })
      );
    }

    let encodedContent = attachment.content.replace(/\s/g, '');
    if (
      encodedContent.length % 4 == 1 ||
      (encodedContent.length > 0 && !/^[A-Za-z0-9+/]*={0,2}$/.test(encodedContent))
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Email attachment content must be valid base64'
        })
      );
    }

    let content = Uint8Array.from(Buffer.from(encodedContent, 'base64'));
    return {
      filename: attachment.filename,
      contentType: attachment.contentType,
      disposition: attachment.disposition,
      contentId: attachment.contentId,
      content,
      size: content.byteLength
    };
  });
  let totalSize = decoded.reduce((total, attachment) => total + attachment.size, 0);

  if (
    decoded.some(attachment => attachment.size > 10 * 1024 * 1024) ||
    totalSize > 25 * 1024 * 1024
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'Email attachments exceed Relay size limits'
      })
    );
  }

  return decoded;
};

let getIdentity = createLocallyCachedFunction({
  getHash: (d: { sender: Sender; id: string }) => d.id + '-' + d.sender.oid,
  ttlSeconds: 60,
  provider: async (d: { sender: Sender; id: string }) =>
    await db.emailIdentity.findFirst({
      where: {
        id: d.id,
        senderOid: d.sender.oid
      },
      include: {
        sender: true
      }
    })
});

class EmailService {
  async ensureCustomIdentity(d: { sender: Sender; email: string; name: string }) {
    return await db.emailIdentity.upsert({
      where: {
        senderOid_slug: {
          slug: d.email,
          senderOid: d.sender.oid
        }
      },
      create: {
        oid: get4ByteIntId(),
        id: ID.generateIdSync('emailIdentity'),
        type: 'email',
        slug: d.email,
        fromName: d.name,
        fromEmail: d.email,
        senderOid: d.sender.oid
      },
      update: {
        fromName: d.name,
        fromEmail: d.email
      },
      include: {
        sender: true
      }
    });
  }

  async getIdentityById(d: { sender: Sender; id: string }) {
    let identity = await getIdentity(d);
    if (!identity) throw new ServiceError(notFoundError('email'));
    return identity;
  }

  async sendEmail(d: {
    type: 'email';
    to: string[];
    template: any;
    content: {
      subject: string;
      html: string;
      text: string;
    };
    identity: EmailIdentity;
    fromName?: string;
    replyTo?: string;
    idempotencyKey?: string;
    attachments?: EmailAttachmentInput[];
    incomingEmailThread?: IncomingEmailThread;
    replyToIncomingEmail?: IncomingEmail;
  }) {
    let attachments = decodeAttachments(d.attachments);
    let to = d.to.map(normalizeEmailAddress);
    let replyTo = d.replyTo ? normalizeEmailAddress(d.replyTo) : undefined;
    if (!to.length || to.some(destination => !destination) || (d.replyTo && !replyTo)) {
      throw new ServiceError(
        badRequestError({
          message: 'Email destinations and reply-to must be valid single email addresses'
        })
      );
    }
    let existing = d.idempotencyKey
      ? await db.outgoingEmail.findUnique({
          where: {
            identityId_idempotencyKey: {
              identityId: d.identity.oid,
              idempotencyKey: d.idempotencyKey
            }
          }
        })
      : null;
    let email = existing;

    if (!email) {
      try {
        email = await db.$transaction(async tx => {
        if (d.idempotencyKey) {
          let existingInTransaction = await tx.outgoingEmail.findUnique({
            where: {
              identityId_idempotencyKey: {
                identityId: d.identity.oid,
                idempotencyKey: d.idempotencyKey
              }
            }
          });
          if (existingInTransaction) return existingInTransaction;
        }

        let newEmail = await tx.outgoingEmail.create({
          data: {
            oid: snowflake.nextId(),
            id: ID.generateIdSync('outgoingEmail'),

            numberOfDestinations: to.length,
            numberOfDestinationsCompleted: 0,

            values: normalizeTemplate(d.template),
            subject: d.content.subject,

            identityId: d.identity.oid,
            fromName: d.fromName ?? d.identity.fromName,
            replyTo,
            idempotencyKey: d.idempotencyKey,
            incomingEmailThreadOid: d.incomingEmailThread?.oid,
            replyToIncomingEmailOid: d.replyToIncomingEmail?.oid
          }
        });

        await tx.outgoingEmailContent.create({
          data: {
            subject: d.content.subject,
            html: d.content.html,
            text: d.content.text,
            emailId: newEmail.oid
          }
        });

        await tx.outgoingEmailDestination.createMany({
          data: to.map(t => ({
            id: snowflake.nextId(),
            status: 'pending',
            destination: t,
            emailId: newEmail.oid
          }))
        });

        if (attachments.length) {
          await tx.outgoingEmailAttachment.createMany({
            data: attachments.map(attachment => ({
              id: snowflake.nextId(),
              emailId: newEmail.oid,
              ...attachment
            }))
          });
        }

        return newEmail;
        });
      } catch (error) {
        if ((error as { code?: string }).code != 'P2002' || !d.idempotencyKey) throw error;
        email = await db.outgoingEmail.findUnique({
          where: {
            identityId_idempotencyKey: {
              identityId: d.identity.oid,
              idempotencyKey: d.idempotencyKey
            }
          }
        });
        if (!email) throw error;
      }
    }

    // Always (re)assert the deterministic delivery job. If the process dies after the
    // database transaction but before queueing, a caller retry with the same idempotency
    // key must repair the missing job instead of returning an email that is never sent.
    await sendEmailQueue.add({ emailId: email.id }, { id: `relay-send-${email.id}` });

    return email;
  }

  async getOutgoingEmailById(d: { sender: Sender; id: string }) {
    let email = await db.outgoingEmail.findFirst({
      where: {
        id: d.id,
        identity: {
          senderOid: d.sender.oid
        }
      },
      include: {
        destinations: {
          include: {
            OutgoingEmailSend: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            contentType: true,
            disposition: true,
            contentId: true,
            size: true
          }
        }
      }
    });

    if (!email) throw new ServiceError(notFoundError('outgoing_email'));
    return email;
  }
}

export let emailService = Service.create('emailService', () => new EmailService()).build();
