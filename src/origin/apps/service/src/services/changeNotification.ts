import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db } from '../db';

class ChangeNotificationServiceImpl {
  async getChangeNotificationById(d: { changeNotificationId: string }) {
    let notification = await db.changeNotification.findFirst({
      where: {
        id: d.changeNotificationId
      },
      include: {
        repo: { include: { account: true } },
        repoPush: { include: { repo: true } },
        repositorySync: true,
        tenant: true
      }
    });
    if (!notification)
      throw new ServiceError(notFoundError('change_notification', d.changeNotificationId));

    return notification;
  }

  async listChangeNotifications(d: { repoId?: string }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.changeNotification.findMany({
          ...opts,
          where: {
            ...(d.repoId && { repo: { id: d.repoId } })
          },
          include: {
            repo: { include: { account: true } },
            repoPush: { include: { repo: true } },
            repositorySync: true,
            tenant: true
          },
          orderBy: opts.orderBy?.length ? opts.orderBy : [{ createdAt: 'desc' }]
        })
      )
    );
  }

  async pollChangeNotifications(d: {
    tenantOid: bigint;
    afterCursor?: string;
    limit: number;
  }) {
    if (d.afterCursor && !/^\d+$/.test(d.afterCursor)) {
      throw new ServiceError(
        badRequestError({ message: 'Invalid change notification cursor' })
      );
    }
    let after = d.afterCursor ? BigInt(d.afterCursor) : undefined;
    let notifications = await db.changeNotification.findMany({
      where: {
        tenantOid: d.tenantOid,
        type: 'repository_sync_status_changed',
        ...(after != null && { oid: { gt: after } })
      },
      include: {
        repo: { include: { account: true } },
        repoPush: { include: { repo: true } },
        repositorySync: true,
        tenant: true
      },
      orderBy: { oid: 'asc' },
      take: Math.min(Math.max(d.limit, 1), 100)
    });
    return {
      notifications,
      nextCursor:
        notifications.length > 0
          ? notifications[notifications.length - 1]!.oid.toString()
          : d.afterCursor
    };
  }
}

export let changeNotificationService = Service.create(
  'changeNotificationService',
  () => new ChangeNotificationServiceImpl()
).build();
