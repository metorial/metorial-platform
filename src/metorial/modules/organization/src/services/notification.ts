import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  ID,
  Organization,
  OrganizationMember,
  OrganizationNotification,
  OrganizationNotificationDestination,
  OrganizationNotificationType,
  withTransaction
} from '@metorial/db';
import {
  OrganizationNotificationTypeIdentifier,
  OrganizationNotificationTypes
} from '../definitions';
import { createOrganizationNotificationQueue } from '../queues/createNotification';

type OrganizationNotificationDestinationWithNotification =
  OrganizationNotificationDestination & {
    notification: OrganizationNotification & {
      type: OrganizationNotificationType;
    };
  };

class OrganizationNotificationService {
  async createNotification(i: {
    organization: Organization;
    type: OrganizationNotificationTypeIdentifier;
    input: {
      kind: string;
      title: string;
      message: string;
      payload?: PrismaJson.OrganizationNotificationPayload;
      actions?: PrismaJson.OrganizationNotificationActions;
      validUntil?: Date;
    };
    onlyForMemberIds?: string[];
    notForMemberIds?: string[];
  }) {
    let type = await OrganizationNotificationTypes[i.type];

    return withTransaction(async db => {
      let notification = await db.organizationNotification.create({
        data: {
          id: await ID.generateId('organizationNotification'),
          status: 'active',
          kind: i.input.kind,
          organizationOid: i.organization.oid,
          typeOid: type.oid,
          title: i.input.title,
          message: i.input.message,
          payload: i.input.payload ?? {},
          actions: i.input.actions ?? [],
          validUntil: i.input.validUntil,
          onlyForMemberIds: i.onlyForMemberIds ?? [],
          notForMemberIds: i.notForMemberIds ?? []
        },
        include: { type: true }
      });

      await addAfterTransactionHook(() =>
        createOrganizationNotificationQueue.add({ notificationId: notification.id })
      );

      return notification;
    });
  }

  async listNotifications(i: { member: OrganizationMember; organization: Organization }) {
    return db.organizationNotificationDestination.findMany({
      where: {
        memberOid: i.member.oid,
        notification: {
          organizationOid: i.organization.oid
        }
      },
      include: { notification: { include: { type: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getNotification(i: { member: OrganizationMember; notificationId: string }) {
    let notification = await db.organizationNotificationDestination.findFirst({
      where: {
        memberOid: i.member.oid,
        notification: { id: i.notificationId }
      },
      include: { notification: { include: { type: true } } }
    });
    if (!notification) throw new ServiceError(notFoundError('notification', i.notificationId));

    return notification;
  }

  async markNotificationRead(i: { member: OrganizationMember; notificationIds: string[] }) {
    let notificationIds = [...new Set(i.notificationIds)];
    let notifications = await db.organizationNotificationDestination.findMany({
      where: {
        memberOid: i.member.oid,
        notification: { id: { in: notificationIds } }
      },
      include: { notification: true }
    });

    if (notifications.length != notificationIds.length) {
      let foundIds = new Set(notifications.map(n => n.notification.id));
      let missingId = notificationIds.find(id => !foundIds.has(id))!;
      throw new ServiceError(notFoundError('notification', missingId));
    }

    let unreadNotifications = notifications.filter(n => !n.readAt);
    if (unreadNotifications.length == 0) return;

    await db.organizationNotificationDestination.updateMany({
      where: {
        id: { in: unreadNotifications.map(n => n.id) }
      },
      data: {
        readAt: new Date(),
        status: 'read'
      }
    });
  }

  async archiveNotification(i: {
    notification: OrganizationNotificationDestinationWithNotification;
  }) {
    if (i.notification.status == 'archived') return i.notification;

    return db.organizationNotificationDestination.update({
      where: { id: i.notification.id },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        readAt: i.notification.readAt ?? new Date()
      },
      include: { notification: { include: { type: true } } }
    });
  }

  async unarchiveNotification(i: {
    notification: OrganizationNotificationDestinationWithNotification;
  }) {
    if (i.notification.status == 'read') return i.notification;

    return db.organizationNotificationDestination.update({
      where: { id: i.notification.id },
      data: {
        status: 'read',
        archivedAt: null,
        readAt: i.notification.readAt ?? new Date()
      },
      include: { notification: { include: { type: true } } }
    });
  }
}

export let notificationService = Service.create(
  'organizationNotificationService',
  () => new OrganizationNotificationService()
).build();
