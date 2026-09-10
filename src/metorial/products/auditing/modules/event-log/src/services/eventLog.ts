import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Organization, SystemEventSource } from '@metorial/db';
import { webhookEvents } from '@metorial/webhook-event-schema';

export let systemEventInclude = {
  instance: true
} as const;

class EventLogServiceImpl {
  async getWebhookEvents() {
    return Object.values(webhookEvents);
  }

  async listEvents(d: {
    organization: Organization;
    instanceId?: string;
    eventTypes?: string[];
    sources?: SystemEventSource[];
  }) {
    let instanceOid: bigint | undefined;
    if (d.instanceId) {
      let instance = await db.instance.findFirst({
        where: { id: d.instanceId, organizationOid: d.organization.oid },
        select: { oid: true }
      });
      if (!instance) {
        throw new ServiceError(badRequestError({ message: 'Unknown instance_id' }));
      }
      instanceOid = instance.oid;
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.systemEvent.findMany({
          ...opts,
          where: {
            organizationOid: d.organization.oid,
            instanceOid,
            eventType: d.eventTypes?.length ? { in: d.eventTypes } : undefined,
            source: d.sources?.length ? { in: d.sources } : undefined
          },
          include: systemEventInclude
        })
      )
    );
  }

  async getEventById(d: { organization: Organization; eventId: string }) {
    let event = await db.systemEvent.findFirst({
      where: { id: d.eventId, organizationOid: d.organization.oid },
      include: systemEventInclude
    });

    if (!event) {
      throw new ServiceError(notFoundError('organization.event', d.eventId));
    }

    return event;
  }
}

export let eventLogService = Service.create(
  'eventLogService',
  () => new EventLogServiceImpl()
).build();
