import {
  GetSendQuotaCommand,
  SendEmailCommand,
  SendRawEmailCommand,
  SESClient
} from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { EmailIdentity } from '../../prisma/generated/browser';
import { emailSettings } from '../env';

export interface SendAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

let transport = emailSettings.sesRegion
  ? {
      type: 'ses' as const,
      client: new SESClient(
        emailSettings.sesAccessKeyId
          ? {
              region: emailSettings.sesRegion!,
              credentials: {
                accessKeyId: emailSettings.sesAccessKeyId!,
                secretAccessKey: emailSettings.sesSecretAccessKey!
              }
            }
          : {
              region: emailSettings.sesRegion
            }
      )
    }
  : {
      type: 'smtp' as const,
      client: nodemailer.createTransport({
        host: emailSettings.smtpHost,
        port: emailSettings.smtpPort,
        secure: emailSettings.smtpSecure,
        auth: {
          user: emailSettings.smtpUser,
          pass: emailSettings.smtpPassword
        }
      })
    };

export let checkSesAccess = async () => {
  if (transport.type !== 'ses') return;

  await transport.client.send(new GetSendQuotaCommand({}));
  console.log('SES access verified');
};

let toMailAttachments = (attachments: SendAttachment[]) =>
  attachments.map(attachment => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    content: Buffer.from(attachment.content)
  }));

export let send = async (opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  identity: EmailIdentity;
  attachments?: SendAttachment[];
}) => {
  if (process.env.METORIAL_ENV == 'staging') {
    opts.subject = `[STAGING] ${opts.subject}`;
  } else if (process.env.METORIAL_ENV == 'development') {
    opts.subject = `[DEV] ${opts.subject}`;
  }

  let from = `${opts.identity.fromName} <${opts.identity.fromEmail}>`;
  let subject = `${opts.identity.subjectMarker || ''}${opts.subject}`;
  let attachments = opts.attachments ?? [];

  if (transport.type == 'ses' && attachments.length) {
    let message = await new MailComposer({
      from,
      to: opts.to,
      subject,
      html: opts.html,
      text: opts.text,
      attachments: toMailAttachments(attachments)
    })
      .compile()
      .build();

    return await transport.client.send(
      new SendRawEmailCommand({
        Source: from,
        Destinations: [opts.to],
        RawMessage: { Data: message }
      })
    );
  }

  if (transport.type == 'ses') {
    let result = await transport.client.send(
      new SendEmailCommand({
        Destination: {
          ToAddresses: [opts.to]
        },
        Message: {
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
          Subject: {
            Charset: 'UTF-8',
            Data: subject
          }
        },
        Source: from
      })
    );

    return result;
  }

  let result = await transport.client.sendMail({
    from,
    to: opts.to,
    subject,
    html: opts.html,
    text: opts.text,
    attachments: attachments.length ? toMailAttachments(attachments) : undefined
  });

  return {
    messageId: result.messageId,
    response: result.response,
    rejected: result.rejected
  };
};
