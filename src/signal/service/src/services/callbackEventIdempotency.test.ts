import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findCallbackEvent: vi.fn(),
  upsertCallbackEvent: vi.fn(),
  createEvent: vi.fn(),
  upsertSender: vi.fn(),
  offloadPayloads: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    callbackEvent: {
      findFirst: mocks.findCallbackEvent,
      upsert: mocks.upsertCallbackEvent
    }
  }
}));

vi.mock('../id', () => ({
  getId: () => ({ oid: 91n, id: 'cbe_generated' }),
  snowflake: { nextId: () => 91n }
}));

vi.mock('../queues/send/callbackEventPayload', () => ({
  offloadCallbackEventPayloadQueue: { addMany: mocks.offloadPayloads }
}));

vi.mock('./event', () => ({
  eventService: { createEvent: mocks.createEvent }
}));

vi.mock('./sender', () => ({
  senderService: { upsertSender: mocks.upsertSender }
}));

vi.mock('./webhookDestinationSigningSecret', () => ({
  webhookDestinationSigningSecretService: {}
}));

import { callbackService } from './callback';

let tenant = { oid: 1n, id: 'tenant-dashboard' } as any;
let sender = { oid: 2n, id: 'sender-callbacks' } as any;
let callback = {
  oid: 3n,
  id: 'callback-dashboard',
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
let event = {
  oid: 4n,
  id: 'event-stable',
  initializationStatus: 'awaiting_enqueue'
} as any;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.upsertSender.mockResolvedValue(sender);
  mocks.findCallbackEvent.mockResolvedValue(null);
  mocks.createEvent.mockResolvedValue(event);
  mocks.upsertCallbackEvent.mockImplementation(async ({ create }: any) => ({
    ...create,
    id: 'cbe_stable',
    inputJson: create.inputJson ?? null,
    outputJson: create.outputJson ?? null,
    event
  }));
  mocks.offloadPayloads.mockResolvedValue(undefined);
});

describe('Signal callback event idempotent delivery bridge', () => {
  it('uses the same fingerprinted Event request for an ambiguous callback retry', async () => {
    let action = {
      tenant,
      callback,
      input: {
        eventId: 'dashboard_test:stable-action-id',
        callbackInstanceId: 'cbi_authorized',
        sourceId: 'dashboard_test',
        triggerKey: 'dashboard_test',
        status: 'succeeded' as const,
        eventType: 'dashboard.test',
        deliveryPayloadJson: '{"test":true}',
        inputJson: '{"test":true}',
        outputJson: '{"test":true}'
      }
    };

    let first = await callbackService.recordCallbackEvent(action);
    mocks.findCallbackEvent.mockResolvedValue({
      oid: 91n,
      id: first.id,
      eventOid: event.oid
    });
    let retry = await callbackService.recordCallbackEvent(action);

    expect(retry.id).toBe(first.id);
    expect(mocks.createEvent).toHaveBeenCalledTimes(2);
    let firstEventRequest = mocks.createEvent.mock.calls[0]![0];
    let retryEventRequest = mocks.createEvent.mock.calls[1]![0];
    expect(retryEventRequest).toEqual(firstEventRequest);
    expect(firstEventRequest).toEqual({
      input: {
        idempotencyKey: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        topics: ['callback:callback-dashboard', 'callback_instance:cbi_authorized'],
        eventType: 'dashboard.test',
        payloadJson: '{"test":true}',
        headers: {
          'metorial-callback-id': 'callback-dashboard',
          'metorial-callback-instance-id': 'cbi_authorized'
        },
        onlyForDestinations: ['destination-a']
      },
      sender,
      tenant,
      callback,
      callbackInstanceId: 'cbi_authorized',
      callbackSourceId: 'dashboard_test',
      callbackTriggerId: undefined
    });
  });
});
