import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { EventDeliveryAttemptStatus, Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  intent: {
    include: {
      event: {
        include: {
          sender: true
        }
      },
      destination: true
    }
  },
  destinationInstance: {
    include: {
      webhook: true
    }
  }
};

class eventDeliveryAttemptServiceImpl {
  async getEventDeliveryAttemptById(d: { id: string; tenant: Tenant }) {
    let func = await db.eventDeliveryAttempt.findFirst({
      where: {
        id: d.id,
        intent: {
          event: {
            tenantOid: d.tenant.oid
          }
        }
      },
      include
    });
    if (!func) throw new ServiceError(notFoundError('event.delivery_attempt'));
    return func;
  }

  async listEventDeliveryAttempts(d: {
    tenant: Tenant;

    eventIds?: string[];
    intentIds?: string[];
    destinationIds?: string[];
    status?: EventDeliveryAttemptStatus[];
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
    let intents = d.intentIds
      ? await db.eventDeliveryIntent.findMany({
          where: {
            id: { in: d.intentIds },
            event: {
              tenantOid: d.tenant.oid
            }
          },
          select: { oid: true }
        })
      : undefined;
    let destinations = d.destinationIds
      ? await db.eventDestinationInstance.findMany({
          where: {
            destination: {
              id: { in: d.destinationIds }
            }
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.eventDeliveryAttempt.findMany({
            ...opts,
            where: {
              intent: {
                event: {
                  tenantOid: d.tenant.oid
                },

                eventOid: events ? { in: events.map(e => e.oid) } : undefined
              },

              intentOid: intents ? { in: intents.map(i => i.oid) } : undefined,
              destinationInstanceOid: destinations
                ? { in: destinations.map(d => d.oid) }
                : undefined,
              status: d.status ? { in: d.status } : undefined
            },
            include
          })
      )
    );
  }
}

export let eventDeliveryAttemptService = Service.create(
  'eventDeliveryAttemptService',
  () => new eventDeliveryAttemptServiceImpl()
).build();
