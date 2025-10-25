import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  destination: true,
  event: true,
  attempts: true
};

class callbackNotificationServiceImpl {
  async getCallbackNotificationById(d: { instance: Instance; notificationId: string }) {
    let notification = await db.callbackNotification.findFirst({
      where: {
        id: d.notificationId,
        destination: {
          instanceOid: d.instance.oid
        }
      },
      include
    });
    if (!notification)
      throw new ServiceError(notFoundError('callback.notification', d.notificationId));

    return notification;
  }

  async listCallbackNotifications(d: {
    instance: Instance;

    callbackIds?: string[];
    eventIds?: string[];
    destinationIds?: string[];
  }) {
    let events = d.eventIds
      ? await db.callbackEvent.findMany({
          where: {
            id: { in: d.eventIds }
          }
        })
      : undefined;
    let destinations = d.destinationIds
      ? await db.callbackDestination.findMany({
          where: {
            id: { in: d.destinationIds },
            instanceOid: d.instance.oid
          }
        })
      : undefined;
    let callbacks = d.callbackIds
      ? await db.callback.findMany({
          where: {
            id: { in: d.callbackIds },
            instanceOid: d.instance.oid
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.callbackNotification.findMany({
            ...opts,
            where: {
              destination: {
                instanceOid: d.instance.oid
              },

              AND: [
                events ? { eventOid: { in: events.map(e => e.oid) } } : undefined!,
                destinations
                  ? { destinationOid: { in: destinations.map(d => d.oid) } }
                  : undefined!,
                callbacks
                  ? { event: { callbackOid: { in: callbacks.map(c => c.oid) } } }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }
}

export let callbackNotificationService = Service.create(
  'callbackNotificationService',
  () => new callbackNotificationServiceImpl()
).build();
