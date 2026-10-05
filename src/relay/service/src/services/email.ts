import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { EmailIdentity } from '../../prisma/generated/browser';
import type { Sender } from '../../prisma/generated/client';
import { db } from '../db';
import { get4ByteIntId, ID, snowflake } from '../id';
import { sendEmailQueue } from '../queue/sendEmail';

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
    idempotencyKey?: string;
    type: 'email';
    to: string[];
    template: any;
    content: {
      subject: string;
      html: string;
      text: string;
    };
    identity: EmailIdentity;
  }) {
    let email;
    try {
      email = await db.outgoingEmail.create({
        data: {
          oid: get4ByteIntId(),
          id: ID.generateIdSync('outgoingEmail'),
          idempotencyKey: d.idempotencyKey,
          numberOfDestinations: d.to.length,
          numberOfDestinationsCompleted: 0,
          values: normalizeTemplate(d.template),
          subject: d.content.subject,
          identityId: d.identity.oid,
          content: {
            create: { subject: d.content.subject, html: d.content.html, text: d.content.text }
          },
          destinations: {
            create: d.to.map(destination => ({
              id: snowflake.nextId(),
              status: 'pending',
              destination
            }))
          }
        }
      });
    } catch (error) {
      if (!d.idempotencyKey || (error as { code?: string }).code !== 'P2002') throw error;
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

    if (!email.queuedAt) {
      await sendEmailQueue.add({ emailId: email.id }, { id: email.id });
      await db.outgoingEmail.update({
        where: { oid: email.oid },
        data: { queuedAt: new Date() }
      });
    }
    return email;
  }
}

export let emailService = Service.create('emailService', () => new EmailService()).build();
