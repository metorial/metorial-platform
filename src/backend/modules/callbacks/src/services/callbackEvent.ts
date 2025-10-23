import { Callback, db } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  processingAttempts: true
};

class callbackEventServiceImpl {
  async getCallbackEventById(d: { callback: Callback; eventId: string }) {
    let event = await db.callbackEvent.findFirst({
      where: {
        id: d.eventId,
        callbackOid: d.callback.oid
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('callback.event', d.eventId));

    return event;
  }

  async listCallbackEvents(d: { callback: Callback }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.callbackEvent.findMany({
            ...opts,
            where: {
              callbackOid: d.callback.oid
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
