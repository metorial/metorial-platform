import { db, ID } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { sendOrganizationNotificationEmailQueue } from './sendNotificationEmail';

export let createOrganizationNotificationQueue = createQueue<{ notificationId: string }>({
  name: 'org/notification/create',
  driver: 'bullmq'
});

let createOrganizationNotificationDestinationQueue = createQueue<{
  notificationId: string;
  memberId: string;
}>({
  name: 'org/notification/destination',
  driver: 'bullmq',
  workerOpts: { concurrency: 5 }
});

export let createOrganizationNotificationProcessor =
  createOrganizationNotificationQueue.process(async ({ notificationId }) => {
    let notification = await db.organizationNotification.findUnique({
      where: { id: notificationId }
    });
    if (!notification) throw new QueueRetryError();

    for (let offset = 0; ; offset++) {
      let members = await db.organizationMember.findMany({
        where: {
          organizationOid: notification.organizationOid,
          status: 'active'
        },
        take: 100,
        skip: offset * 100,
        orderBy: { id: 'asc' }
      });
      if (!members.length) break;

      if (notification.onlyForMemberIds.length) {
        members = members.filter(member => notification.onlyForMemberIds.includes(member.id));
      }

      if (notification.notForMemberIds.length) {
        members = members.filter(member => !notification.notForMemberIds.includes(member.id));
      }

      await createOrganizationNotificationDestinationQueue.addMany(
        members.map(member => ({ notificationId, memberId: member.id }))
      );
    }
  });

export let createOrganizationNotificationDestinationProcessor =
  createOrganizationNotificationDestinationQueue.process(
    async ({ notificationId, memberId }) => {
      let notification = await db.organizationNotification.findUnique({
        where: { id: notificationId },
        include: { type: true }
      });
      if (!notification) throw new QueueRetryError();

      let member = await db.organizationMember.findFirst({
        where: {
          id: memberId,
          organizationOid: notification.organizationOid,
          status: 'active'
        }
      });
      if (!member) return;

      let destination = await db.organizationNotificationDestination.upsert({
        where: {
          memberOid_notificationOid: {
            memberOid: member.oid,
            notificationOid: notification.oid
          }
        },
        create: {
          id: await ID.generateId('organizationNotificationDestination'),
          status: notification.status,
          memberOid: member.oid,
          notificationOid: notification.oid
        },
        update: {}
      });

      if (notification.type.sendEmail && !destination.emailId) {
        await sendOrganizationNotificationEmailQueue.add({
          destinationId: destination.id
        });
      }
    }
  );
