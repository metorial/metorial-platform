import { GetAccountCommand, SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
import type { EmailIdentity } from '../../prisma/generated/browser';
import { env } from '../env';

let transport = env.email.EMAIL_SES_REGION
  ? {
      type: 'ses' as const,
      client: new SESv2Client(
        env.email.EMAIL_SES_ACCESS_KEY_ID
          ? {
              region: env.email.EMAIL_SES_REGION!,
              credentials: {
                accessKeyId: env.email.EMAIL_SES_ACCESS_KEY_ID!,
                secretAccessKey: env.email.EMAIL_SES_SECRET_ACCESS_KEY!
              }
            }
          : {
              region: env.email.EMAIL_SES_REGION
            }
      )
    }
  : {
      type: 'smtp' as const,
      client: nodemailer.createTransport({
        host: env.email.EMAIL_HOST,
        port: env.email.EMAIL_PORT,
        secure: env.email.EMAIL_SECURE,
        auth: {
          user: env.email.EMAIL_USER,
          pass: env.email.EMAIL_PASSWORD
        }
      })
    };

export let checkSesAccess = async () => {
  if (transport.type !== 'ses') return;

  await transport.client.send(new GetAccountCommand({}));
  console.log('SES access verified');
};

export let send = async (opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  identity: EmailIdentity;
  fromName?: string;
  replyTo?: string;
  attachments?: {
    filename: string;
    contentType: string;
    disposition?: string | null;
    contentId?: string | null;
    content: Uint8Array;
  }[];
  headers?: {
    inReplyTo?: string;
    references?: string[];
  };
}) => {
  let fromName = (opts.fromName ?? opts.identity.fromName).replace(/[\r\n]+/g, ' ').trim();
  let from = `${fromName} <${opts.identity.fromEmail}>`;

  if (process.env.METORIAL_ENV == 'staging') {
    opts.subject = `[STAGING] ${opts.subject}`;
  } else if (process.env.METORIAL_ENV == 'development') {
    opts.subject = `[DEV] ${opts.subject}`;
  }

  if (transport.type == 'ses') {
    let headers = [
      ...(opts.headers?.inReplyTo
        ? [
            {
              Name: 'In-Reply-To',
              Value: opts.headers.inReplyTo
            }
          ]
        : []),
      ...(opts.headers?.references?.length
        ? [
            {
              Name: 'References',
              Value: opts.headers.references.join(' ')
            }
          ]
        : [])
    ];

    let result = await transport.client.send(
      new SendEmailCommand({
        Destination: {
          ToAddresses: [opts.to]
        },
        FromEmailAddress: from,
        ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
        Content: {
          Simple: {
            Subject: {
              Charset: 'UTF-8',
              Data: `${opts.identity.subjectMarker || ''}${opts.subject}`
            },
            Body: {
              Html: {
                Charset: 'UTF-8',
                Data: opts.html
              },
              Text: {
                Charset: 'UTF-8',
                Data: opts.text
              }
            },
            Headers: headers.length ? headers : undefined,
            Attachments: opts.attachments?.map(attachment => ({
              FileName: attachment.filename,
              ContentType: attachment.contentType,
              ContentDisposition:
                attachment.disposition?.toLowerCase() == 'inline' ? 'INLINE' : 'ATTACHMENT',
              ContentTransferEncoding: 'BASE64',
              ContentId: attachment.contentId ?? undefined,
              RawContent: attachment.content
            }))
          }
        }
      })
    );

    return result;
  }

  let result: any = await transport.client.sendMail({
    from,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: `${opts.identity.subjectMarker || ''}${opts.subject}`,
    html: opts.html,
    text: opts.text,
    inReplyTo: opts.headers?.inReplyTo,
    references: opts.headers?.references,
    attachments: opts.attachments?.map(attachment => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      contentDisposition:
        attachment.disposition?.toLowerCase() == 'inline'
          ? ('inline' as const)
          : ('attachment' as const),
      cid: attachment.contentId ?? undefined,
      content: Buffer.from(attachment.content)
    }))
  });

  return {
    messageId: result.messageId,
    response: result.response,
    rejected: result.rejected
  };
};
