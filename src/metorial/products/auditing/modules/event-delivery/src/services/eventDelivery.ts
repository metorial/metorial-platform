import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  db,
  EventDeliveryIntent,
  EventDeliveryIntentStatus,
  EventDestination,
  Organization,
  SystemEvent,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { attemptDeliveryQueue } from '../queues/attempt';

export let eventDeliveryInclude = {
  systemEvent: true,
  eventDestination: true,
  instance: true,
  attempts: { orderBy: { attemptNumber: 'asc' } }
} as const;

class EventDeliveryServiceImpl {
  async listEventDeliveries(d: {
    organization: Organization;
    statuses?: EventDeliveryIntentStatus[];
    eventIds?: string[];
    eventDestinationIds?: string[];
    instanceIds?: string[];
    eventTypes?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.eventDeliveryIntent.findMany({
          ...opts,
          where: {
            organizationOid: d.organization.oid,
            status: d.statuses ? { in: d.statuses } : undefined,
            systemEvent:
              d.eventIds || d.eventTypes
                ? {
                    id: d.eventIds ? { in: d.eventIds } : undefined,
                    eventType: d.eventTypes ? { in: d.eventTypes } : undefined
                  }
                : undefined,
            eventDestination: d.eventDestinationIds
              ? { id: { in: d.eventDestinationIds } }
              : undefined,
            instance: d.instanceIds ? { id: { in: d.instanceIds } } : undefined
          },
          include: eventDeliveryInclude
        })
      )
    );
  }

  async getEventDeliveryById(d: { organization: Organization; eventDeliveryId: string }) {
    let eventDelivery = await db.eventDeliveryIntent.findFirst({
      where: { id: d.eventDeliveryId, organizationOid: d.organization.oid },
      include: eventDeliveryInclude
    });

    if (!eventDelivery) {
      throw new ServiceError(notFoundError('organization.event_delivery', d.eventDeliveryId));
    }

    return eventDelivery;
  }

  async retryEventDelivery(d: {
    organization: Organization;
    eventDelivery: EventDeliveryIntent & {
      systemEvent: SystemEvent;
      eventDestination: EventDestination;
    };
    auditScope: AuditScope;
  }) {
    if (d.eventDelivery.status == 'pending' || d.eventDelivery.status == 'retrying') {
      throw new ServiceError(
        badRequestError({
          message: 'This delivery is still in progress',
          description: 'Only a delivered, failed or cancelled delivery can be retried.'
        })
      );
    }

    let eventDelivery = await withTransaction(async db => {
      await Fabric.fire('organization.event_delivery.retried:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDelivery: d.eventDelivery
      });

      let eventDelivery = await db.eventDeliveryIntent.update({
        where: { oid: d.eventDelivery.oid },
        data: {
          status: 'retrying',
          errorCode: null,
          errorMessage: null,
          completedAt: null,
          nextAttemptAt: new Date(),
          // A manual retry gets its own budget on top of whatever the automatic attempts used, so
          // an exhausted delivery can still be replayed without editing the destination.
          retryMaxAttempts: d.eventDelivery.attemptCount + d.eventDelivery.retryMaxAttempts
        },
        include: eventDeliveryInclude
      });

      await Fabric.fire('organization.event_delivery.retried:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDelivery,
        previousEventDelivery: d.eventDelivery
      });

      return eventDelivery;
    });

    let attemptNumber = eventDelivery.attemptCount + 1;

    await attemptDeliveryQueue.add(
      { intentId: eventDelivery.id, attemptNumber },
      { id: `event-delivery-attempt:${eventDelivery.id}:${attemptNumber}` }
    );

    return eventDelivery;
  }
}

export let eventDeliveryService = Service.create(
  'eventDeliveryService',
  () => new EventDeliveryServiceImpl()
).build();
