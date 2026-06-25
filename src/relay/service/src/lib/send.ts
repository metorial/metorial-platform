import { GetSendQuotaCommand, SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import type { EmailIdentity } from '../../prisma/generated/browser';
import { env } from '../env';

let transport = env.email.EMAIL_SES_REGION
  ? {
      type: 'ses' as const,
      client: new SESClient(
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

  await transport.client.send(new GetSendQuotaCommand({}));
  console.log('SES access verified');
};

export let send = async (opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  identity: EmailIdentity;
}) => {
  if (process.env.METORIAL_ENV == 'staging') {
    opts.subject = `[STAGING] ${opts.subject}`;
  } else if (process.env.METORIAL_ENV == 'development') {
    opts.subject = `[DEV] ${opts.subject}`;
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
            Data: `${opts.identity.subjectMarker || ''}${opts.subject}`
          }
        },
        Source: `${opts.identity.fromName} <${opts.identity.fromEmail}>`
      })
    );

    return result;
  }

  let result = await transport.client.sendMail({
    from: `${opts.identity.fromName} <${opts.identity.fromEmail}>`,
    to: opts.to,
    subject: `${opts.identity.subjectMarker || ''}${opts.subject}`,
    html: opts.html,
    text: opts.text
  });

  return {
    messageId: result.messageId,
    response: result.response,
    rejected: result.rejected
  };
};
