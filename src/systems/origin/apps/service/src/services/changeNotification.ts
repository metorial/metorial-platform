import { notFoundError, ServiceError } from '@lowerdeck/error';
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
            tenant: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
      )
    );
  }
}

export let changeNotificationService = Service.create(
  'changeNotificationService',
  () => new ChangeNotificationServiceImpl()
).build();
