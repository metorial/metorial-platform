import { createCron } from '@metorial/cron';
import {
  db,
  ID,
  Organization,
  OrganizationMember,
  OrganizationNotificationDigestSetting,
  withTransaction
} from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { sendOrganizationNotificationDigestEmail } from '../email/notificationDigest';
import {
  getNextOrganizationNotificationDigestAt,
  getOrCreateOrganizationNotificationSetting
} from '../lib/notificationSettings';

let flushOrganizationNotificationDigestQueue = createQueue<{
  memberId: string;
  organizationId: string;
}>({
  name: 'org/notification/digest/flush',
  driver: 'bullmq',
  workerOpts: { concurrency: 10 }
});

let sendOrganizationNotificationDigestQueue = createQueue<{
  digestId: string;
}>({
  name: 'org/notification/digest/send',
  driver: 'bullmq',
  workerOpts: { concurrency: 5 }
});

export let enqueueOrganizationNotificationDigestFlush = async (i: {
  memberId: string;
  organizationId: string;
  sendAt: Date;
}) =>
  flushOrganizationNotificationDigestQueue.add(
    {
      memberId: i.memberId,
      organizationId: i.organizationId
    },
    {
      id: `${i.memberId}-${i.organizationId}-${i.sendAt.getTime()}`,
      delay: Math.max(i.sendAt.getTime() - Date.now(), 0)
    }
  );

export let rescheduleOrganizationNotificationDigest = async (i: {
  member: OrganizationMember;
  organization: Organization;
  setting: OrganizationNotificationDigestSetting;
}) => {
  let sendAt = getNextOrganizationNotificationDigestAt({
    timeMinutes: i.setting.timeMinutes,
    timezone: i.setting.timezone
  });

  let result = await db.organizationNotificationDestination.updateMany({
    where: {
      memberOid: i.member.oid,
      emailStatus: 'pending',
      notification: {
        organizationOid: i.organization.oid,
        type: { severity: 'notification' }
      }
    },
    data: { emailSendAfter: sendAt }
  });

  if (result.count) {
    await enqueueOrganizationNotificationDigestFlush({
      memberId: i.member.id,
      organizationId: i.organization.id,
      sendAt
    });
  }
};

let createOrganizationNotificationDigestCron = createCron(
  {
    name: 'org/notification/digest/sweep',
    cron: '* * * * *'
  },
  async () => {
    let dueDestinations = await db.organizationNotificationDestination.findMany({
      where: {
        emailStatus: 'pending',
        emailSendAfter: { lte: new Date() },
        notification: { type: { severity: 'notification' } }
      },
      select: {
        member: { select: { id: true } },
        notification: {
          select: { organization: { select: { id: true } } }
        }
      },
      take: 500,
      orderBy: { emailSendAfter: 'asc' }
    });

    let recipients = new Map<string, { memberId: string; organizationId: string }>();
    for (let destination of dueDestinations) {
      let recipient = {
        memberId: destination.member.id,
        organizationId: destination.notification.organization.id
      };
      recipients.set(`${recipient.memberId}:${recipient.organizationId}`, recipient);
    }

    await flushOrganizationNotificationDigestQueue.addMany([...recipients.values()]);
  }
);

let flushOrganizationNotificationDigestProcessor =
  flushOrganizationNotificationDigestQueue.process(async ({ memberId, organizationId }) => {
    let now = new Date();
    let member = await db.organizationMember.findFirst({
      where: {
        id: memberId,
        organization: { id: organizationId },
        status: 'active'
      },
      include: { organization: true }
    });
    if (!member) return;

    await db.organizationNotificationDestination.updateMany({
      where: {
        memberOid: member.oid,
        emailStatus: 'pending',
        emailSendAfter: { lte: now },
        notification: {
          organizationOid: member.organizationOid,
          validUntil: { lte: now }
        }
      },
      data: {
        emailStatus: 'disabled',
        emailSendAfter: null
      }
    });

    let dueDestinations = await db.organizationNotificationDestination.findMany({
      where: {
        memberOid: member.oid,
        emailStatus: 'pending',
        emailSendAfter: { lte: now },
        notification: {
          organizationOid: member.organizationOid,
          type: { severity: 'notification' },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }]
        }
      },
      select: { id: true, emailSendAfter: true },
      orderBy: { emailSendAfter: 'asc' }
    });
    if (!dueDestinations.length) return;

    let digest = await withTransaction(async tx => {
      let digest = await tx.organizationNotificationEmailDigest.create({
        data: {
          id: await ID.generateId('organizationNotificationEmailDigest'),
          memberOid: member.oid,
          organizationOid: member.organizationOid,
          scheduledFor: dueDestinations[0].emailSendAfter ?? now
        }
      });

      let claimed = await tx.organizationNotificationDestination.updateMany({
        where: {
          id: { in: dueDestinations.map(destination => destination.id) },
          emailStatus: 'pending',
          emailDigestOid: null
        },
        data: {
          emailStatus: 'batched',
          emailDigestOid: digest.oid
        }
      });

      if (!claimed.count) {
        await tx.organizationNotificationEmailDigest.delete({ where: { id: digest.id } });
        return null;
      }

      return digest;
    });

    if (digest) {
      await sendOrganizationNotificationDigestQueue.add(
        { digestId: digest.id },
        { id: digest.id }
      );
    }
  });

let sendOrganizationNotificationDigestProcessor =
  sendOrganizationNotificationDigestQueue.process(async ({ digestId }) => {
    let digest = await db.organizationNotificationEmailDigest.findUnique({
      where: { id: digestId },
      include: {
        organization: true,
        member: { include: { actor: true } },
        destinations: {
          include: {
            notification: { include: { type: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!digest) throw new QueueRetryError();
    if (digest.status == 'sent' || digest.status == 'skipped') return;

    if (digest.emailId) {
      await db.organizationNotificationEmailDigest.update({
        where: { id: digest.id },
        data: { status: 'sent', sentAt: digest.sentAt ?? new Date() }
      });
      return;
    }

    let now = new Date();
    let typeByOid = new Map(
      digest.destinations.map(destination => [
        destination.notification.typeOid,
        destination.notification.type
      ])
    );
    let settings = await Promise.all(
      [...typeByOid.values()].map(type =>
        getOrCreateOrganizationNotificationSetting({
          member: digest.member,
          organization: digest.organization,
          type
        })
      )
    );
    let enabledTypeOids = new Set(
      settings.filter(setting => setting.emailEnabled).map(setting => setting.typeOid)
    );

    let validDestinations =
      digest.member.status == 'active'
        ? digest.destinations.filter(destination => {
            let notification = destination.notification;
            return (
              destination.emailStatus == 'batched' &&
              enabledTypeOids.has(notification.typeOid) &&
              (!notification.validUntil || notification.validUntil > now) &&
              (!notification.onlyForMemberRoles.length ||
                notification.onlyForMemberRoles.includes(digest.member.role))
            );
          })
        : [];
    let validIds = new Set(validDestinations.map(destination => destination.id));
    let disabledIds = digest.destinations
      .filter(destination => !validIds.has(destination.id))
      .map(destination => destination.id);

    if (disabledIds.length) {
      await db.organizationNotificationDestination.updateMany({
        where: { id: { in: disabledIds }, emailStatus: 'batched' },
        data: {
          emailStatus: 'disabled',
          emailDigestOid: null,
          emailSendAfter: null
        }
      });
    }

    if (!validDestinations.length || !digest.member.actor.email) {
      await db.organizationNotificationEmailDigest.update({
        where: { id: digest.id },
        data: { status: 'skipped' }
      });
      return;
    }

    let email = await sendOrganizationNotificationDigestEmail.send({
      to: [digest.member.actor.email],
      data: {
        organization: digest.organization,
        notifications: validDestinations.map(destination => destination.notification)
      }
    });
    let sentAt = new Date();

    await withTransaction(async tx => {
      await tx.organizationNotificationEmailDigest.update({
        where: { id: digest.id },
        data: {
          status: 'sent',
          emailId: email.id,
          sentAt
        }
      });
      await tx.organizationNotificationDestination.updateMany({
        where: { id: { in: validDestinations.map(destination => destination.id) } },
        data: {
          emailStatus: 'sent',
          emailId: email.id,
          emailSentAt: sentAt,
          emailSendAfter: null
        }
      });
    });
  });

export let organizationNotificationDigestProcessors = combineQueueProcessors([
  createOrganizationNotificationDigestCron,
  flushOrganizationNotificationDigestProcessor,
  sendOrganizationNotificationDigestProcessor
]);
