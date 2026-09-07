import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  triggerRegistrationInstance: {
    include: {
      triggerGroup: true,
      triggerRegistration: { include: { callbackInstance: true } }
    }
  },
  webhookEvent: { select: { id: true } }
};

class triggerEventServiceImpl {
  async getTriggerEventById(d: { tenant: Tenant; id: string }) {
    let event = await db.triggerEvent.findFirst({
      where: {
        id: d.id,
        triggerRegistrationInstance: { triggerRegistration: { tenantOid: d.tenant.oid } }
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('trigger_event'));
    return event;
  }

  async listTriggerEvents(d: {
    tenant: Tenant;
    callbackIds?: string[];
    callbackInstanceIds?: string[];
    triggerRegistrationIds?: string[];
  }) {
    let callbacks = d.callbackIds
      ? await db.callback.findMany({
          where: { tenantOid: d.tenant.oid, id: { in: d.callbackIds } },
          select: { oid: true }
        })
      : undefined;
    let callbackInstances = d.callbackInstanceIds
      ? await db.callbackInstance.findMany({
          where: { tenantOid: d.tenant.oid, id: { in: d.callbackInstanceIds } },
          select: { oid: true }
        })
      : undefined;
    let registrations = d.triggerRegistrationIds
      ? await db.triggerRegistration.findMany({
          where: { tenantOid: d.tenant.oid, id: { in: d.triggerRegistrationIds } },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.triggerEvent.findMany({
            ...opts,
            where: {
              triggerRegistrationInstance: {
                triggerRegistrationOid: registrations
                  ? { in: registrations.map(r => r.oid) }
                  : undefined,
                triggerRegistration: {
                  tenantOid: d.tenant.oid,
                  callbackInstance: callbacks
                    ? { callbackOid: { in: callbacks.map(c => c.oid) } }
                    : callbackInstances
                      ? { oid: { in: callbackInstances.map(i => i.oid) } }
                      : undefined
                }
              }
            },
            include
          })
      )
    );
  }

  async getManyTriggerEventsByIds(d: { tenant: Tenant; ids: string[] }) {
    return db.triggerEvent.findMany({
      where: {
        id: { in: d.ids },
        triggerRegistrationInstance: { triggerRegistration: { tenantOid: d.tenant.oid } }
      },
      include
    });
  }
}

export let triggerEventService = Service.create(
  'triggerEventService',
  () => new triggerEventServiceImpl()
).build();
