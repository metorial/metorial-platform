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

describe('eventLogService attribute filters', () => {
  let listWhere = async (attributeFilters?: string[]) => {
    let paginator = await eventLogService.listEvents({ organization, attributeFilters });
    await paginator.run({ limit: 10 });

    return db.systemEvent.findMany.mock.calls[0]![0].where;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.systemEvent.findMany.mockResolvedValue([]);
  });

  it('does not filter by attributes when none are given', async () => {
    expect((await listWhere()).AND).toBeUndefined();
  });

  it('matches any of the values given for the same key', async () => {
    let where = await listWhere(['mimeType:application/pdf', 'mimeType:text/plain']);

    expect(where.AND).toEqual([
      { attributes: { hasSome: ['mimeType:application/pdf', 'mimeType:text/plain'] } }
    ]);
  });

  it('requires every key to match', async () => {
    let where = await listWhere(['fileId:f1', 'mimeType:text/plain', 'fileId:f2']);

    expect(where.AND).toEqual([
      { attributes: { hasSome: ['fileId:f1', 'fileId:f2'] } },
      { attributes: { hasSome: ['mimeType:text/plain'] } }
    ]);
  });

  it('filters by keys that name built-in object members', async () => {
    let where = await listWhere(['toString:x', 'constructor:y']);

    expect(where.AND).toEqual([
      { attributes: { hasSome: ['toString:x'] } },
      { attributes: { hasSome: ['constructor:y'] } }
    ]);
  });

  it('keeps colons inside the value', async () => {
    let where = await listWhere(['range:A1:B2']);

    expect(where.AND).toEqual([{ attributes: { hasSome: ['range:A1:B2'] } }]);
  });

  it('rejects a malformed attribute filter with a bad request', async () => {
    await expect(
      eventLogService.listEvents({ organization, attributeFilters: ['fileId'] })
    ).rejects.toMatchObject({
      data: expect.objectContaining({ status: 400, code: 'bad_request' })
    });
    expect(db.systemEvent.findMany).not.toHaveBeenCalled();
  });
});
