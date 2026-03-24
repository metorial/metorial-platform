import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  receiver: true,
  receiverTrigger: true,
  action: true,
  invocation: true
};

class slateTriggerEventServiceImpl {
  async getTriggerEventById(d: { tenant: Tenant; id: string }) {
    let event = await db.slateTriggerEvent.findFirst({
      where: {
        id: d.id,
        receiver: { tenantOid: d.tenant.oid }
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('slate.trigger.event'));
    return event;
  }

  async listTriggerEvents(d: {
    tenant: Tenant;
    receiverIds?: string[];
    receiverTriggerIds?: string[];
    eventTypes?: string[];
  }) {
    let receivers = d.receiverIds
      ? await db.slateTriggerReceiver.findMany({
          where: { id: { in: d.receiverIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    let receiverTriggers = d.receiverTriggerIds
      ? await db.slateTriggerReceiverTrigger.findMany({
          where: {
            id: { in: d.receiverTriggerIds },
            receiver: { tenantOid: d.tenant.oid }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateTriggerEvent.findMany({
            ...opts,
            where: {
              receiver: { tenantOid: d.tenant.oid },
              receiverOid: receivers ? { in: receivers.map(r => r.oid) } : undefined,
              receiverTriggerOid: receiverTriggers
                ? { in: receiverTriggers.map(rt => rt.oid) }
                : undefined,
              type: d.eventTypes ? { in: d.eventTypes } : undefined
            },
            include
          })
      )
    );
  }
}

export let slateTriggerEventService = Service.create(
  'slateTriggerEventService',
  () => new slateTriggerEventServiceImpl()
).build();
