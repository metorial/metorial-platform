import { beforeEach, describe, expect, it, vi } from 'vitest';

let dbCalls = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  callbackFindFirst: vi.fn(),
  senderUpsert: vi.fn(),
  callbackEventFindFirst: vi.fn(),
  callbackEventUpsert: vi.fn(),
  eventFindUnique: vi.fn(),
  eventCreate: vi.fn(),
  eventUpdateMany: vi.fn()
}));
let queues = vi.hoisted(() => ({
  initializeEvent: vi.fn(),
  offloadPayloads: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    tenant: { findFirst: dbCalls.tenantFindFirst },
    callback: { findFirst: dbCalls.callbackFindFirst },
    sender: { upsert: dbCalls.senderUpsert },
    callbackEvent: {
      findFirst: dbCalls.callbackEventFindFirst,
      upsert: dbCalls.callbackEventUpsert
    },
    event: {
      findUnique: dbCalls.eventFindUnique,
      create: dbCalls.eventCreate,
      updateMany: dbCalls.eventUpdateMany
    }
  }
}));

vi.mock('../queues/send/init', () => ({
  newEventQueue: { add: queues.initializeEvent }
}));

vi.mock('../queues/send/callbackEventPayload', () => ({
  offloadCallbackEventPayloadQueue: { addMany: queues.offloadPayloads }
}));

import { env } from '../env';
import { computeIdempotentEventRequestFingerprint } from '../services/event';
import { createTestSignalClient, signalClient } from '../test/client';

let tenantA = {
  oid: 1n,
  id: 'tenant-a',
  identifier: 'tenant-a',
  name: 'Tenant A'
} as any;
let tenantB = {
  oid: 2n,
  id: 'tenant-b',
  identifier: 'tenant-b',
  name: 'Tenant B'
} as any;
let sender = {
  oid: 3n,
  id: 'sender-callbacks',
  identifier: 'callbacks',
  name: 'Callbacks'
} as any;
let callbackA = {
  oid: 4n,
  id: 'callback-dashboard',
  tenantOid: tenantA.oid,
  status: 'active',
  hasEventTypesFilter: false,
  eventTypes: [],
  destinations: [
    {
      status: 'active',
      eventDestination: { id: 'destination-a', status: 'active' }
    }
  ]
} as any;
let callbackB = {
  ...callbackA,
  oid: 5n,
  tenantOid: tenantB.oid,
  destinations: [
    {
      status: 'active',
      eventDestination: { id: 'destination-b', status: 'active' }
    }
  ]
} as any;

let eventsByIdempotencyKey = new Map<string, any>();
let callbackEventsByIdempotencyKey = new Map<string, any>();

let dashboardRequest = (overrides: Record<string, unknown> = {}) => ({
  tenantId: tenantA.id,
  callbackId: callbackA.id,
  eventId: 'dashboard_test:stable-action-id',
  callbackInstanceId: 'callback-instance-a',
  eventType: 'dashboard.test',
  payloadJson: '{"test":true}',
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
  eventsByIdempotencyKey = new Map();
  callbackEventsByIdempotencyKey = new Map();
  env.internal.HUB_SERVICE_CREDENTIAL = 'hub-service-credential';
  env.internal.SUBSPACE_SERVICE_CREDENTIAL = 'subspace-rotated-service-credential';

  dbCalls.tenantFindFirst.mockImplementation(async ({ where }: any) => {
    let id = where.OR[0].id ?? where.OR[1].identifier;
    return (
      [tenantA, tenantB].find(tenant => tenant.id === id || tenant.identifier === id) ?? null
    );
  });
  dbCalls.callbackFindFirst.mockImplementation(async ({ where }: any) =>
    [callbackA, callbackB].find(
      callback => callback.id === where.id && callback.tenantOid === where.tenantOid
    )
  );
  dbCalls.senderUpsert.mockResolvedValue(sender);
  dbCalls.callbackEventFindFirst.mockImplementation(async ({ where }: any) => {
    let callbackEvent = callbackEventsByIdempotencyKey.get(where.idempotencyKey);
    if (
      !callbackEvent ||
      callbackEvent.callbackOid !== where.callbackOid ||
      callbackEvent.callback.tenantOid !== where.callback.tenantOid
    ) {
      return null;
    }
    return callbackEvent;
  });
  dbCalls.eventFindUnique.mockImplementation(async ({ where }: any) =>
    where.idempotencyKey ? (eventsByIdempotencyKey.get(where.idempotencyKey) ?? null) : null
  );
  dbCalls.eventCreate.mockImplementation(async ({ data }: any) => {
    let tenant = data.tenantOid === tenantA.oid ? tenantA : tenantB;
    let callback = data.callbackOid === callbackA.oid ? callbackA : callbackB;
    let event = {
      ...data,
      tenant,
      sender,
      callback,
      createdAt: new Date('2026-08-15T08:00:00.000Z'),
      updatedAt: new Date('2026-08-15T08:00:00.000Z')
    };
    eventsByIdempotencyKey.set(data.idempotencyKey, event);
    return event;
  });
  dbCalls.eventUpdateMany.mockImplementation(async ({ where, data }: any) => {
    let event = [...eventsByIdempotencyKey.values()].find(item => item.id === where.id);
    if (!event) return { count: 0 };
    Object.assign(event, data);
    return { count: 1 };
  });
  dbCalls.callbackEventUpsert.mockImplementation(async ({ where, update, create }: any) => {
    let existing = callbackEventsByIdempotencyKey.get(where.idempotencyKey);
    let data = existing ? { ...existing, ...update } : { ...create };
    let callback = data.callbackOid === callbackA.oid ? callbackA : callbackB;
    let event =
      [...eventsByIdempotencyKey.values()].find(item => item.oid === data.eventOid) ?? null;
    let callbackEvent = {
      ...data,
      callback,
      event,
      inputJson: data.inputJson ?? null,
      inputStorageKey: data.inputStorageKey ?? null,
      outputJson: data.outputJson ?? null,
      outputStorageKey: data.outputStorageKey ?? null,
      createdAt: data.createdAt ?? new Date('2026-08-15T08:00:00.000Z'),
      updatedAt: new Date('2026-08-15T08:00:00.000Z')
    };
    callbackEventsByIdempotencyKey.set(where.idempotencyKey, callbackEvent);
    return callbackEvent;
  });
  queues.initializeEvent.mockResolvedValue(undefined);
  queues.offloadPayloads.mockResolvedValue(undefined);
});

describe('Signal internal dashboard callback controller', () => {
  it('rejects missing, invalid, and Hub credentials before tenant or callback lookup', async () => {
    let invalidClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': 'invalid-service-credential' }
    });
    let hubClient = createTestSignalClient({
      headers: {
        'x-metorial-signal-service-credential': env.internal.HUB_SERVICE_CREDENTIAL
      }
    });

    for (let client of [signalClient, invalidClient, hubClient]) {
      await expect(
        client.callback.recordDashboardTestEvent(dashboardRequest())
      ).rejects.toMatchObject({ data: { status: 401 } });
    }

    expect(dbCalls.tenantFindFirst).not.toHaveBeenCalled();
    expect(dbCalls.callbackFindFirst).not.toHaveBeenCalled();
    expect(dbCalls.senderUpsert).not.toHaveBeenCalled();
    expect(dbCalls.eventCreate).not.toHaveBeenCalled();
  });

  it('sets dashboard metadata server-side and retries with one fingerprinted delivery identity', async () => {
    let internalClient = createTestSignalClient({
      headers: {
        'x-metorial-signal-service-credential': env.internal.SUBSPACE_SERVICE_CREDENTIAL
      }
    });
    let request = {
      ...dashboardRequest(),
      sourceId: 'caller-controlled-source',
      triggerKey: 'caller-controlled-trigger'
    } as any;

    let first = await internalClient.callback.recordDashboardTestEvent(request);
    let retry = await internalClient.callback.recordDashboardTestEvent(request);

    expect(retry.id).toBe(first.id);
    expect(first).toMatchObject({
      sourceId: 'dashboard_test',
      triggerKey: 'dashboard_test',
      callbackId: callbackA.id,
      callbackInstanceId: 'callback-instance-a',
      input: { test: true },
      output: { test: true }
    });
    expect(eventsByIdempotencyKey).toHaveLength(1);
    expect(dbCalls.eventCreate).toHaveBeenCalledOnce();

    let event = [...eventsByIdempotencyKey.values()][0]!;
    expect(event.requestFingerprint).toBe(
      computeIdempotentEventRequestFingerprint({
        tenantId: tenantA.id,
        senderId: sender.id,
        callbackId: callbackA.id,
        input: {
          idempotencyKey: event.idempotencyKey,
          topics: [`callback:${callbackA.id}`, 'callback_instance:callback-instance-a'],
          eventType: 'dashboard.test',
          payloadJson: '{"test":true}',
          headers: {
            'metorial-callback-id': callbackA.id,
            'metorial-callback-instance-id': 'callback-instance-a'
          },
          onlyForDestinations: ['destination-a'],
          callbackInstanceId: 'callback-instance-a',
          callbackSourceId: 'dashboard_test'
        }
      })
    );
    expect(queues.initializeEvent).toHaveBeenCalledTimes(2);
    expect(queues.initializeEvent.mock.calls[0]).toEqual([
      { eventId: event.id },
      { id: event.id }
    ]);
    expect(queues.initializeEvent.mock.calls[1]).toEqual(queues.initializeEvent.mock.calls[0]);
  });

  it('rejects cross-tenant reuse of the same event identity without a second Event', async () => {
    let internalClient = createTestSignalClient({
      headers: {
        'x-metorial-signal-service-credential': env.internal.SUBSPACE_SERVICE_CREDENTIAL
      }
    });
    await internalClient.callback.recordDashboardTestEvent(dashboardRequest());

    await expect(
      internalClient.callback.recordDashboardTestEvent(
        dashboardRequest({
          tenantId: tenantB.id,
          callbackInstanceId: 'callback-instance-b'
        })
      )
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });

    expect(eventsByIdempotencyKey).toHaveLength(1);
    expect(dbCalls.eventCreate).toHaveBeenCalledOnce();
  });

  it('retains the ordinary callback record endpoint authentication semantics', async () => {
    let result = await signalClient.callback.recordEvent({
      tenantId: tenantA.id,
      callbackId: callbackA.id,
      eventId: 'provider-event-a',
      callbackInstanceId: 'callback-instance-a',
      sourceId: 'provider-source',
      triggerKey: 'provider-trigger',
      status: 'failed',
      eventType: 'provider.failed',
      errorCode: 'provider_error'
    });

    expect(result).toMatchObject({
      sourceId: 'provider-source',
      triggerKey: 'provider-trigger',
      status: 'failed'
    });
    expect(dbCalls.tenantFindFirst).toHaveBeenCalled();
    expect(dbCalls.callbackFindFirst).toHaveBeenCalled();
  });
});
