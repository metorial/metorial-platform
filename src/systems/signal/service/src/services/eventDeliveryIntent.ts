import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { EventDeliveryIntentStatus, Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  event: {
    include: {
      sender: true
    }
  },
  destination: {
    include: {
      currentInstance: {
        include: {
          webhook: true
        }
      }
    }
  }
};

class eventDeliveryIntentServiceImpl {
  async getEventDeliveryIntentById(d: { id: string; tenant: Tenant }) {
    let func = await db.eventDeliveryIntent.findFirst({
      where: {
        id: d.id,
        event: {
          tenantOid: d.tenant.oid
        }
      },
      include
    });
    if (!func) throw new ServiceError(notFoundError('event.delivery_intent'));
    return func;
  }

  async listEventDeliveryIntents(d: {
    tenant: Tenant;
    eventIds?: string[];
    destinationIds?: string[];
    status?: EventDeliveryIntentStatus[];
  }) {
    let events = d.eventIds
      ? await db.event.findMany({
          where: {
            id: { in: d.eventIds },
            tenantOid: d.tenant.oid
          },
          select: { oid: true }
        })
      : undefined;
    let destinations = d.destinationIds
      ? await db.eventDestination.findMany({
          where: {
            id: { in: d.destinationIds }
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.eventDeliveryIntent.findMany({
            ...opts,
            where: {
              event: {
                tenantOid: d.tenant.oid
              },

              eventOid: events ? { in: events.map(e => e.oid) } : undefined,
              destinationOid: destinations ? { in: destinations.map(d => d.oid) } : undefined,
              status: d.status ? { in: d.status } : undefined
            },
            include
          })
      )
    );
  }
}

export let eventDeliveryIntentService = Service.create(
  'eventDeliveryIntentService',
  () => new eventDeliveryIntentServiceImpl()
).build();
