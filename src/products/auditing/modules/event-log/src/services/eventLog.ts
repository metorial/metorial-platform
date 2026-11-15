import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { callbackEventService } from '@metorial-subspace/module-callback';
import { chatEventService } from '@metorial-subspace/module-chat';
import { db, Organization, SystemEventSource } from '@metorial/db';
import { DateFilter, normalizeDateFilter } from '@metorial/list-utils';
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
    callbackIds?: string[];
    callbackTriggerKeys?: string[];
    chatConnectionIds?: string[];
    providerIds?: string[];
    createdAt?: DateFilter;
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
            OR: instanceOid ? [{ instanceOid: null }, { instanceOid }] : undefined,
            eventType: d.eventTypes?.length ? { in: d.eventTypes } : undefined,
            source: d.sources?.length ? { in: d.sources } : undefined,
            callbackId: d.callbackIds?.length ? { in: d.callbackIds } : undefined,
            callbackTriggerKey: d.callbackTriggerKeys?.length
              ? { in: d.callbackTriggerKeys }
              : undefined,
            chatConnectionId: d.chatConnectionIds?.length
              ? { in: d.chatConnectionIds }
              : undefined,
            providerId: d.providerIds?.length ? { in: d.providerIds } : undefined,
            createdAt: normalizeDateFilter(d.createdAt)
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

    let chatPayload = event.chatEventId
      ? ((
          await chatEventService.getManyChatEventPayloads({
            chatEventIds: [event.chatEventId]
          })
        ).get(event.chatEventId) ?? null)
      : null;

    let callbackPayload =
      event.source == 'callback' && event.callbackEventId && event.instance
        ? ((
            await callbackEventService.getCallbackEventById({
              instance: event.instance,
              callbackEventId: event.callbackEventId
            })
          ).details?.payload ?? null)
        : null;

    return { ...event, chatPayload, callbackPayload };
  }
}

export let eventLogService = Service.create(
  'eventLogService',
  () => new EventLogServiceImpl()
).build();
