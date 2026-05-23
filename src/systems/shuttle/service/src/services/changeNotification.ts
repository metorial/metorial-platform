import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db } from '../db';

let include = {
  server: {
    include: {
      tenant: true
    }
  },
  serverVersion: true
};

class changeNotificationServiceImpl {
  async getChangeNotificationById(d: { changeNotificationId: string }) {
    let changeNotification = await db.changeNotification.findFirst({
      where: {
        id: d.changeNotificationId
      },
      include
    });
    if (!changeNotification)
      throw new ServiceError(notFoundError('changeNotification_instance'));
    return changeNotification;
  }

  async listChangeNotifications(d: {}) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.changeNotification.findMany({
            ...opts,
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
