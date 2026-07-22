import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { sendOrganizationNotificationEmail } from '../email/notification';

export let sendOrganizationNotificationEmailQueue = createQueue<{
  destinationId: string;
}>({
  name: 'org/notification/email',
  driver: 'bullmq',
  workerOpts: { concurrency: 5 }
});

export let sendOrganizationNotificationEmailProcessor =
  sendOrganizationNotificationEmailQueue.process(async ({ destinationId }) => {
    let destination = await db.organizationNotificationDestination.findUnique({
      where: { id: destinationId },
      include: {
        member: { include: { actor: true } },
        notification: {
          include: {
            type: true,
            organization: true
          }
        }
      }
    });
    if (!destination) throw new QueueRetryError();
    if (destination.emailId || !destination.notification.type.sendEmail) return;
    if (!destination.member.actor.email) return;

    let email = await sendOrganizationNotificationEmail.send({
      to: [destination.member.actor.email],
      data: {
        organization: destination.notification.organization,
        notification: destination.notification
      }
    });

    await db.organizationNotificationDestination.update({
      where: { id: destination.id },
      data: { emailId: email.id }
    });
  });
