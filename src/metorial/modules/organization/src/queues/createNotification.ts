import { db, ID } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import {
  getNextOrganizationNotificationDigestAt,
  getOrCreateOrganizationNotificationDigestSetting,
  getOrCreateOrganizationNotificationSetting
} from '../lib/notificationSettings';
import { enqueueOrganizationNotificationDigestFlush } from './createNotificationDigest';
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
          status: 'active',
          ...(notification.onlyForMemberRoles.length
            ? { role: { in: notification.onlyForMemberRoles } }
            : {})
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
        include: { type: true, organization: true }
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
      if (
        notification.onlyForMemberRoles.length &&
        !notification.onlyForMemberRoles.includes(member.role)
      ) {
        return;
      }

      let existingDestination = await db.organizationNotificationDestination.findUnique({
        where: {
          memberOid_notificationOid: {
            memberOid: member.oid,
            notificationOid: notification.oid
          }
        }
      });

      if (existingDestination) {
        if (existingDestination.emailStatus != 'pending') return;

        if (notification.type.severity == 'alert') {
          await sendOrganizationNotificationEmailQueue.add({
            destinationId: existingDestination.id
          });
        } else if (existingDestination.emailSendAfter) {
          await enqueueOrganizationNotificationDigestFlush({
            memberId: member.id,
            organizationId: notification.organization.id,
            sendAt: existingDestination.emailSendAfter
          });
        }
        return;
      }

      let destination = await db.organizationNotificationDestination.create({
        data: {
          id: await ID.generateId('organizationNotificationDestination'),
          status: notification.status,
          memberOid: member.oid,
          notificationOid: notification.oid
        }
      });

      let setting = await getOrCreateOrganizationNotificationSetting({
        member,
        organization: notification.organization,
        type: notification.type
      });
      if (!setting.emailEnabled) return;

      if (notification.type.severity == 'alert') {
        destination = await db.organizationNotificationDestination.update({
          where: { id: destination.id },
          data: { emailStatus: 'pending' }
        });
        await sendOrganizationNotificationEmailQueue.add({
          destinationId: destination.id
        });
        return;
      }

      let digestSetting = await getOrCreateOrganizationNotificationDigestSetting({
        member,
        organization: notification.organization
      });
      let sendAt = getNextOrganizationNotificationDigestAt({
        timeMinutes: digestSetting.timeMinutes,
        timezone: digestSetting.timezone
      });
      await db.organizationNotificationDestination.update({
        where: { id: destination.id },
        data: {
          emailStatus: 'pending',
          emailSendAfter: sendAt
        }
      });
      await enqueueOrganizationNotificationDigestFlush({
        memberId: member.id,
        organizationId: notification.organization.id,
        sendAt
      });
    }
  );
