import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Callback, Sender, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { newEventQueue } from '../queues/send/init';

let include = {
  sender: true,
  callback: true
};

class eventServiceImpl {
  async createEvent(d: {
    input: {
      idempotencyKey?: string;
      topics: string[];
      eventType: string;
      payloadJson: string;
      headers: Record<string, string>;
      onlyForDestinations?: string[];
    };
    sender: Sender;
    tenant: Tenant;
    callback?: Callback;
    callbackInstanceId?: string | null;
    callbackSourceId?: string | null;
    callbackTriggerId?: string | null;
  }) {
    if (d.input.idempotencyKey) {
      let existing = await db.event.findFirst({
        where: {
          idempotencyKey: d.input.idempotencyKey,
          tenantOid: d.tenant.oid
        },
        include
      });
      if (existing) return existing;
    }

    let event = await db.event.create({
      data: {
        ...getId('event'),
        idempotencyKey: d.input.idempotencyKey,

        status: 'pending',

        topics: d.input.topics,
        eventType: d.input.eventType,
        payloadJson: d.input.payloadJson,
        headers: Object.entries(d.input.headers),

        onlyForDestinations: d.input.onlyForDestinations,
        hasOnlyForDestinationsFilter: !!d.input.onlyForDestinations,

        deliveryDestinationCount: -1,
        deliveryFailureCount: 0,
        deliverySuccessCount: 0,

        senderOid: d.sender.oid,
        tenantOid: d.tenant.oid,

        callbackOid: d.callback?.oid,
        callbackInstanceId: d.callbackInstanceId,
        callbackSourceId: d.callbackSourceId,
        callbackTriggerId: d.callbackTriggerId
      },
      include
    });

    await newEventQueue.add({ eventId: event.id });

    return event;
  }

  async getEventById(d: { id: string; tenant: Tenant }) {
    let func = await db.event.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!func) throw new ServiceError(notFoundError('event'));
    return func;
  }

  async listEvents(d: {
    tenant: Tenant;
    eventTypes?: string[];
    topics?: string[];
    senderIds?: string[];
    callbackId?: string;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.event.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,

              eventType: d.eventTypes ? { in: d.eventTypes } : undefined,
              topics: d.topics ? { hasSome: d.topics } : undefined,

              sender: d.senderIds
                ? { OR: [{ id: { in: d.senderIds } }, { identifier: { in: d.senderIds } }] }
                : undefined,
              callback: d.callbackId ? { id: d.callbackId } : undefined
            },
            include
          })
      )
    );
  }
}

export let eventService = Service.create('eventService', () => new eventServiceImpl()).build();
