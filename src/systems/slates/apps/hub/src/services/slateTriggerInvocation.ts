import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlateTriggerInvocationType, Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  receiver: true,
  receiverTrigger: true,
  event: true,
  invocation: true
};

class slateTriggerInvocationServiceImpl {
  async getTriggerInvocationById(d: { tenant: Tenant; id: string }) {
    let invocation = await db.slateTriggerInvocation.findFirst({
      where: {
        id: d.id,
        receiver: { tenantOid: d.tenant.oid }
      },
      include
    });
    if (!invocation) throw new ServiceError(notFoundError('slate.trigger.invocation'));
    return invocation;
  }

  async getManyTriggerInvocationsById(d: { tenant: Tenant; ids: string[] }) {
    return await db.slateTriggerInvocation.findMany({
      where: {
        id: { in: d.ids },
        receiver: { tenantOid: d.tenant.oid }
      },
      include
    });
  }

  async listTriggerInvocations(d: {
    tenant: Tenant;
    receiverIds?: string[];
    receiverTriggerIds?: string[];
    eventIds?: string[];
    types?: SlateTriggerInvocationType[];
  }) {
    let receivers = d.receiverIds
      ? await db.slateTriggerReceiver.findMany({
          where: {
            id: { in: d.receiverIds },
            tenantOid: d.tenant.oid
          }
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

    let events = d.eventIds
      ? await db.slateTriggerEvent.findMany({
          where: {
            id: { in: d.eventIds },
            receiver: { tenantOid: d.tenant.oid }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateTriggerInvocation.findMany({
            ...opts,
            where: {
              receiver: { tenantOid: d.tenant.oid },
              receiverOid: receivers ? { in: receivers.map(r => r.oid) } : undefined,
              receiverTriggerOid: receiverTriggers
                ? { in: receiverTriggers.map(rt => rt.oid) }
                : undefined,
              eventOid: events ? { in: events.map(e => e.oid) } : undefined,
              type: d.types ? { in: d.types } : undefined
            },
            include
          })
      )
    );
  }
}

export let slateTriggerInvocationService = Service.create(
  'slateTriggerInvocationService',
  () => new slateTriggerInvocationServiceImpl()
).build();
