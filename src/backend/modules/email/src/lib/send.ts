import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { getConfig } from '@metorial/config';
import { EmailIdentity } from '@metorial/db';
import nodemailer from 'nodemailer';

let email = getConfig().email;

let transport =
  email.type == 'ses'
    ? {
        type: 'ses' as const,
        client: new SESClient(
          email.aws
            ? {
                region: email.aws.region,
                credentials: {
                  accessKeyId: email.aws.accessKeyId,
                  secretAccessKey: email.aws.secretAccessKey
                }
              }
            : {}
        )
      }
    : {
        type: 'smtp' as const,
        client: nodemailer.createTransport({
          host: email.host,
          port: email.port,
          secure: email.secure,
          auth: {
            user: email.auth.user,
            pass: email.auth.pass
          }
        })
      };

export let send = async (opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  identity: EmailIdentity;
}) => {
  if (getConfig().env == 'staging') {
    opts.subject = `[STAGING] ${opts.subject}`;
  } else if (getConfig().env == 'development') {
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
