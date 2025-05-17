import { db, ID } from '@metorial/db';
import { Service } from '@metorial/service';
import { defaultEmailIdentity } from '../definitions';
import { sendEmailQueue } from '../queue/sendEmail';

class EmailService {
  async sendEmail(d: {
    type: 'email';
    to: string[];
    template: any;
    content: {
      subject: string;
      html: string;
      text: string;
    };
  }) {
    let emails = await db.outgoingEmail.create({
      data: {
        id: ID.generateIdSync('email'),

        numberOfDestinations: d.to.length,
        numberOfDestinationsCompleted: 0,

        destinations: {
          create: d.to.map(t => ({
            status: 'pending',
            destination: t
          }))
        },

        values: d.template,

        subject: d.content.subject,

        identityId: (await defaultEmailIdentity).oid,

        content: {
          create: {
            subject: d.content.subject,
            html: d.content.html,
            text: d.content.text
          }
        }
      }
    });

    await sendEmailQueue.add({ emailId: emails.id });

    return emails;
  }
}

export let emailService = Service.create('emailService', () => new EmailService()).build();
