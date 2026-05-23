import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db } from '../db';

let include = {};

class changeNotificationServiceImpl {
  async getChangeNotificationById(d: { id: string }) {
    let changeNotification = await db.changeNotification.findFirst({
      where: {
        id: d.id
      },
      include
    });
    if (!changeNotification) throw new ServiceError(notFoundError('slate.event'));
    return changeNotification;
  }

  async listChangeNotifications() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.changeNotification.findMany({
            ...opts,
            where: {},
            include
          })
      )
    );
  }
}

export let changeNotificationService = Service.create(
  'changeNotificationService',
  () => new changeNotificationServiceImpl()
).build();
