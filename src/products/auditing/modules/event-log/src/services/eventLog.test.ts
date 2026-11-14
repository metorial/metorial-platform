import { beforeEach, describe, expect, it, vi } from 'vitest';

let { callbackEventService, chatEventService, db, loadOffloadedTriggerEventPayload } =
  vi.hoisted(() => ({
    callbackEventService: { getCallbackEventById: vi.fn() },
    chatEventService: { getManyChatEventPayloads: vi.fn() },
    loadOffloadedTriggerEventPayload: vi.fn(),
    db: {
      instance: { findFirst: vi.fn() },
      systemEvent: { findFirst: vi.fn(), findMany: vi.fn() }
    }
  }));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (factory: any) => ({
      run: async () => await factory({ prisma: async (fn: any) => await fn({}) })
    })
  }
}));

vi.mock('@metorial-subspace/module-callback', () => ({ callbackEventService }));
vi.mock('@metorial-subspace/module-chat', () => ({ chatEventService }));
vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/webhook-event-schema', () => ({ webhookEvents: {} }));

import { eventLogService } from './eventLog';

let organization = { oid: BigInt(1) } as any;
let instance = { id: 'ins_1', oid: BigInt(2) } as any;
let callbackSystemEvent = {
  id: 'evt_1',
  source: 'callback',
  callbackEventId: 'cbe_1',
  chatEventId: null,
  instance
} as any;

describe('eventLogService callback payload hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.systemEvent.findFirst.mockResolvedValue(callbackSystemEvent);
    db.systemEvent.findMany.mockResolvedValue([callbackSystemEvent]);
    chatEventService.getManyChatEventPayloads.mockResolvedValue(new Map());
  });

  it('includes inline callback payloads in Event GET', async () => {
    let payload = { source: 'inline' };
    callbackEventService.getCallbackEventById.mockResolvedValue({
      details: { payload }
    });

    let event = await eventLogService.getEventById({
      organization,
      eventId: 'evt_1'
    });

    expect(event.callbackPayload).toEqual(payload);
    expect(callbackEventService.getCallbackEventById).toHaveBeenCalledWith({
      instance,
      callbackEventId: 'cbe_1'
    });
  });

  it('includes callback payloads returned by the established offload loader in Event GET', async () => {
    loadOffloadedTriggerEventPayload.mockResolvedValue({ source: 'offloaded' });
    callbackEventService.getCallbackEventById.mockImplementation(async () => ({
      details: {
        payload: await loadOffloadedTriggerEventPayload('trigger-events/tre_1/payload')
      }
    }));

    let event = await eventLogService.getEventById({
      organization,
      eventId: 'evt_1'
    });

    expect(event.callbackPayload).toEqual({ source: 'offloaded' });
    expect(loadOffloadedTriggerEventPayload).toHaveBeenCalledWith(
      'trigger-events/tre_1/payload'
    );
  });

  it('does not hydrate payloads while listing events', async () => {
    let paginator = await eventLogService.listEvents({ organization });
    await paginator.run({ limit: 10 });

    expect(callbackEventService.getCallbackEventById).not.toHaveBeenCalled();
    expect(chatEventService.getManyChatEventPayloads).not.toHaveBeenCalled();
  });
});
