import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, EventDeliveryAttemptStatus, Organization } from '@metorial/db';

export let eventDeliveryAttemptInclude = {
  intent: {
    include: {
      systemEvent: true,
      eventDestination: true
    }
  }
} as const;

class EventDeliveryAttemptServiceImpl {
  async listEventDeliveryAttempts(d: {
    organization: Organization;
    statuses?: EventDeliveryAttemptStatus[];
    eventDeliveryIds?: string[];
    eventIds?: string[];
    eventDestinationIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.eventDeliveryAttempt.findMany({
          ...opts,
          where: {
            organizationOid: d.organization.oid,
            status: d.statuses ? { in: d.statuses } : undefined,
            intent:
              d.eventDeliveryIds || d.eventIds || d.eventDestinationIds
                ? {
                    id: d.eventDeliveryIds ? { in: d.eventDeliveryIds } : undefined,
                    systemEvent: d.eventIds ? { id: { in: d.eventIds } } : undefined,
                    eventDestination: d.eventDestinationIds
                      ? { id: { in: d.eventDestinationIds } }
                      : undefined
                  }
                : undefined
          },
          include: eventDeliveryAttemptInclude
        })
      )
    );
  }

  async getEventDeliveryAttemptById(d: {
    organization: Organization;
    eventDeliveryAttemptId: string;
  }) {
    let attempt = await db.eventDeliveryAttempt.findFirst({
      where: { id: d.eventDeliveryAttemptId, organizationOid: d.organization.oid },
      include: eventDeliveryAttemptInclude
    });

    if (!attempt) {
      throw new ServiceError(
        notFoundError('organization.event_delivery_attempt', d.eventDeliveryAttemptId)
      );
    }

    return attempt;
  }
}

export let eventDeliveryAttemptService = Service.create(
  'eventDeliveryAttemptService',
  () => new EventDeliveryAttemptServiceImpl()
).build();
