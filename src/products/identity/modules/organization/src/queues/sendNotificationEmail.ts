import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { sendOrganizationNotificationEmail } from '../email/notification';
import { getOrCreateOrganizationNotificationSetting } from '../lib/notificationSettings';

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
    if (destination.emailId || destination.emailStatus != 'pending') return;
    if (destination.notification.type.severity != 'alert') return;

    let now = new Date();
    let notification = destination.notification;
    let isEligible =
      destination.member.status == 'active' &&
      (!notification.validUntil || notification.validUntil > now) &&
      (!notification.onlyForMemberRoles.length ||
        notification.onlyForMemberRoles.includes(destination.member.role));
    let setting = isEligible
      ? await getOrCreateOrganizationNotificationSetting({
          member: destination.member,
          organization: notification.organization,
          type: notification.type
        })
      : null;

    if (!isEligible || !setting?.emailEnabled || !destination.member.actor.email) {
      await db.organizationNotificationDestination.update({
        where: { id: destination.id },
        data: {
          emailStatus: 'disabled',
          emailSendAfter: null
        }
      });
      return;
    }

    let email = await sendOrganizationNotificationEmail.send({
      to: [destination.member.actor.email],
      data: {
        organization: notification.organization,
        notification
      }
    });

    await db.organizationNotificationDestination.update({
      where: { id: destination.id },
      data: {
        emailStatus: 'sent',
        emailId: email.id,
        emailSentAt: new Date()
      }
    });
  });
