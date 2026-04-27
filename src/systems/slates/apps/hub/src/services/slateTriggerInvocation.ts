import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { SlateTriggerInvocationType, type Tenant } from '../../prisma/generated/client';
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
    eventInputIds?: string[];
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

    let eventInputInvocationOids = d.eventInputIds
      ? await this.getTriggerInvocationOidsForEventInputs({
          tenant: d.tenant,
          eventInputIds: d.eventInputIds
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
              oid: eventInputInvocationOids ? { in: eventInputInvocationOids } : undefined,
              type: d.types ? { in: d.types } : undefined
            },
            include
          })
      )
    );
  }

  private async getTriggerInvocationOidsForEventInputs(d: {
    tenant: Tenant;
    eventInputIds: string[];
  }) {
    let eventInputs = await db.slateTriggerEventInput.findMany({
      where: {
        id: { in: d.eventInputIds },
        receiver: { tenantOid: d.tenant.oid }
      },
      include: {
        event: true
      }
    });

    let invocationOids: bigint[] = [];

    for (let eventInput of eventInputs) {
      let sourceInvocation = await db.slateTriggerInvocation.findFirst({
        where: {
          receiverTriggerOid: eventInput.receiverTriggerOid,
          type: {
            in: [
              SlateTriggerInvocationType.poll,
              SlateTriggerInvocationType.webhook_handle
            ]
          },
          createdAt: { lte: eventInput.createdAt }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (sourceInvocation) invocationOids.push(sourceInvocation.oid);

      if (eventInput.eventOid) {
        let eventInvocations = await db.slateTriggerInvocation.findMany({
          where: {
            eventOid: eventInput.eventOid
          }
        });

        invocationOids.push(...eventInvocations.map(invocation => invocation.oid));
        continue;
      }

      let mapInvocation = await db.slateTriggerInvocation.findFirst({
        where: {
          receiverTriggerOid: eventInput.receiverTriggerOid,
          type: SlateTriggerInvocationType.map_event,
          createdAt: { gte: eventInput.createdAt }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (mapInvocation) invocationOids.push(mapInvocation.oid);
    }

    return Array.from(new Set(invocationOids));
  }
}

export let slateTriggerInvocationService = Service.create(
  'slateTriggerInvocationService',
  () => new slateTriggerInvocationServiceImpl()
).build();
