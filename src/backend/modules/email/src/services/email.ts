import { ID, withTransaction } from '@metorial/db';
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
    let email = await withTransaction(async db => {
      let email = await db.outgoingEmail.create({
        data: {
          id: ID.generateIdSync('email'),

          numberOfDestinations: d.to.length,
          numberOfDestinationsCompleted: 0,

          values: d.template,

          subject: d.content.subject,

          identityId: (await defaultEmailIdentity).oid
        }
      });

      await db.outgoingEmailContent.createMany({
        data: {
          subject: d.content.subject,
          html: d.content.html,
          text: d.content.text,
          emailId: email.oid
        }
      });

      await db.outgoingEmailDestination.createMany({
        data: d.to.map(t => ({
          status: 'pending',
          destination: t,
          emailId: email.oid
        }))
      });

      return email;
    });

    setTimeout(async () => {
      await sendEmailQueue.add({ emailId: email.id });
    }, 1000);

    return email;
  }
}

export let emailService = Service.create('emailService', () => new EmailService()).build();
