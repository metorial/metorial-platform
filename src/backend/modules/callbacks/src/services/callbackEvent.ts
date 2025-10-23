import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  processingAttempts: true
};

class callbackEventServiceImpl {
  async getCallbackEventById(d: { instance: Instance; eventId: string }) {
    let event = await db.callbackEvent.findFirst({
      where: {
        id: d.eventId,
        callback: {
          instanceOid: d.instance.oid
        }
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('callback.event', d.eventId));

    return event;
  }

  async listCallbackEvents(d: { callbackIds?: string[]; instance: Instance }) {
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
          await db.callbackEvent.findMany({
            ...opts,
            where: {
              callback: {
                instanceOid: d.instance.oid,
                ...(callbacks ? { oid: { in: callbacks.map(c => c.oid) } } : {})
              }
            },
            include
          })
      )
    );
  }
}

export let callbackEventService = Service.create(
  'callbackEventService',
  () => new callbackEventServiceImpl()
).build();
