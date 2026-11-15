import { uniqueId } from '@lowerdeck/testing-tools';
import type { Event, EventDeliveryAttempt, EventDeliveryIntent } from '../prisma/generated/client';
import { db } from '../src/db';
import { getId } from '../src/id';
import { signal } from './client';

export let createTenant = async (name = 'Test Tenant') => {
  let presented = await signal.tenant.upsert({ identifier: uniqueId('tenant'), name });
  return db.tenant.findUniqueOrThrow({ where: { id: presented.id } });
};

export let createSender = async (name = 'Test Sender') => {
  let presented = await signal.sender.upsert({ identifier: uniqueId('sender'), name });
  return db.sender.findUniqueOrThrow({ where: { id: presented.id } });
};

export let createDestination = async (input: { tenantId: string; senderId: string }) => {
  let presented = await signal.eventDestination.create({
    ...input,
    name: uniqueId('destination'),
    eventTypes: null,
    retry: { type: 'linear', delaySeconds: 30, maxAttempts: 5 },
    variant: { type: 'http_endpoint', url: 'https://example.com/webhook', method: 'POST' }
  });

  return db.eventDestination.findUniqueOrThrow({
    where: { id: presented.id },
    include: { currentInstance: true }
  });
};

export let createEvent = async (input: {
  tenantOid: bigint;
  senderOid: bigint;
  overrides?: Partial<Event>;
}): Promise<Event> => {
  let eventType = input.overrides?.eventType ?? `test.event.${uniqueId('type')}`;

  return db.event.create({
    data: {
      ...getId('event'),
      status: 'pending',
      topics: ['test'],
      deliveryDestinationCount: -1,
      deliverySuccessCount: 0,
      deliveryFailureCount: 0,
      eventType,
      payloadJson: JSON.stringify({ eventType, ok: true }),
      onlyForDestinations: [],
      hasOnlyForDestinationsFilter: false,
      headers: [['content-type', 'application/json']],
      tenantOid: input.tenantOid,
      senderOid: input.senderOid,
      ...input.overrides
    } as Event
  });
};

export let createIntent = async (input: {
  eventOid: bigint;
  destinationOid: bigint;
  overrides?: Partial<EventDeliveryIntent>;
}): Promise<EventDeliveryIntent> =>
  db.eventDeliveryIntent.create({
    data: {
      ...getId('eventDeliveryIntent'),
      status: 'pending',
      attemptCount: 0,
      eventOid: input.eventOid,
      destinationOid: input.destinationOid,
      ...input.overrides
    } as EventDeliveryIntent
  });

export let createAttempt = async (input: {
  intentOid: bigint;
  destinationInstanceOid: bigint;
  overrides?: Partial<EventDeliveryAttempt>;
}): Promise<EventDeliveryAttempt> =>
  db.eventDeliveryAttempt.create({
    data: {
      ...getId('eventDeliveryAttempt'),
      status: 'failed',
      attemptNumber: 1,
      durationMs: 120,
      intentOid: input.intentOid,
      destinationInstanceOid: input.destinationInstanceOid,
      ...input.overrides
    } as EventDeliveryAttempt
  });
