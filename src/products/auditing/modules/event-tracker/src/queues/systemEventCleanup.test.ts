import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  handlers: new Map<string, (data?: any) => Promise<void>>(),
  manyAdd: vi.fn(),
  manyAddManyWithOps: vi.fn(),
  singleAddManyWithOps: vi.fn(),
  enqueue: vi.fn(),
  systemEventFindFirst: vi.fn(),
  systemEventFindMany: vi.fn(),
  systemEventDelete: vi.fn(),
  callbackEventFindFirst: vi.fn(),
  callbackEventFindMany: vi.fn(),
  callbackEventDelete: vi.fn(),
  chatEventFindFirst: vi.fn(),
  chatEventFindMany: vi.fn(),
  chatEventDelete: vi.fn(),
  purgeEventDeliveriesForSystemEvent: vi.fn()
}));

vi.mock('@metorial/module-event-delivery', () => ({
  purgeEventDeliveriesForSystemEvent: mocks.purgeEventDeliveriesForSystemEvent
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => {
    mocks.handlers.set(config.name, handler);
    return { handler };
  })
}));

vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn(processors => processors),
  hourlyPacedDelay: vi.fn(() => ({ delay: 250 })),
  createQueue: vi.fn(config => {
    let isMany = config.name.endsWith('/many');
    let isSingle = config.name.endsWith('/single');

    return {
      add: isMany ? mocks.manyAdd : vi.fn(),
      addMany: isMany ? mocks.manyAdd : vi.fn(),
      addManyWithOps: isSingle
        ? mocks.singleAddManyWithOps
        : isMany
          ? mocks.manyAddManyWithOps
          : vi.fn(),
      process: vi.fn(handler => {
        mocks.handlers.set(config.name, handler);
        return { handler };
      })
    };
  })
}));

vi.mock('@metorial/db', () => ({
  db: {
    systemEvent: {
      findFirst: mocks.systemEventFindFirst,
      findMany: mocks.systemEventFindMany,
      delete: mocks.systemEventDelete
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callbackEvent: {
      findFirst: mocks.callbackEventFindFirst,
      findMany: mocks.callbackEventFindMany,
      delete: mocks.callbackEventDelete
    },
    chatEvent: {
      findFirst: mocks.chatEventFindFirst,
      findMany: mocks.chatEventFindMany,
      delete: mocks.chatEventDelete
    }
  }
}));

vi.mock('../storage', () => ({
  getStorage: () => ({ deleteObject: vi.fn() }),
  getEventPayloadsBucketName: () => 'event-payloads',
  getChatEventPayloadsBucketName: () => 'chat-event-payloads'
}));

vi.mock('./objectDelete', () => ({
  auditingObjectDelete: {
    enqueue: mocks.enqueue,
    processor: { start: async () => {} }
  }
}));

import './systemEventCleanup';

let run = async (name: string, data?: any) => {
  let handler = mocks.handlers.get(name);
  if (!handler) throw new Error(`Missing handler for ${name}`);
  await handler(data);
};

describe('system event cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts all event cleanup scans with the same fourteen-day cutoff', async () => {
    await run('auditing/systemEvent/cleanup/cron');

    expect(mocks.manyAddManyWithOps).toHaveBeenCalledWith([
      {
        data: { resource: 'systemEvent', dueBefore: '2026-08-01T00:00:00.000Z' },
        opts: { delay: 0 }
      },
      {
        data: { resource: 'callbackEvent', dueBefore: '2026-08-01T00:00:00.000Z' },
        opts: { delay: 20_000 }
      },
      {
        data: { resource: 'chatEvent', dueBefore: '2026-08-01T00:00:00.000Z' },
        opts: { delay: 40_000 }
      }
    ]);
  });

  it('deletes a system event before enqueueing its offloaded payload', async () => {
    mocks.systemEventFindFirst.mockResolvedValue({
      oid: 1n,
      id: 'evt_1',
      payloadStorageKey: 'payload_1'
    });

    await run('auditing/systemEvent/cleanup/single', {
      resource: 'systemEvent',
      eventId: 'evt_1',
      dueBefore: '2026-08-01T00:00:00.000Z'
    });

    expect(mocks.systemEventDelete).toHaveBeenCalledWith({ where: { id: 'evt_1' } });
    expect(mocks.enqueue).toHaveBeenCalledWith('event-payloads', ['payload_1']);
    expect(mocks.systemEventDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueue.mock.invocationCallOrder[0]!
    );
  });

  it('cascades a callback event before enqueueing owned chat payloads', async () => {
    mocks.callbackEventFindFirst.mockResolvedValue({
      id: 'cb_evt_1',
      chatEvents: [{ payloadStorageKey: 'chat_payload_1' }, { payloadStorageKey: null }]
    });

    await run('auditing/systemEvent/cleanup/single', {
      resource: 'callbackEvent',
      eventId: 'cb_evt_1',
      dueBefore: '2026-08-01T00:00:00.000Z'
    });

    expect(mocks.callbackEventDelete).toHaveBeenCalledWith({
      where: { id: 'cb_evt_1' }
    });
    expect(mocks.enqueue).toHaveBeenCalledWith('chat-event-payloads', ['chat_payload_1']);
    expect(mocks.callbackEventDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueue.mock.invocationCallOrder[0]!
    );
  });

  it('deletes a chat event before enqueueing its offloaded payload', async () => {
    mocks.chatEventFindFirst.mockResolvedValue({
      id: 'chat_evt_1',
      payloadStorageKey: 'chat_payload_1'
    });

    await run('auditing/systemEvent/cleanup/single', {
      resource: 'chatEvent',
      eventId: 'chat_evt_1',
      dueBefore: '2026-08-01T00:00:00.000Z'
    });

    expect(mocks.chatEventDelete).toHaveBeenCalledWith({ where: { id: 'chat_evt_1' } });
    expect(mocks.enqueue).toHaveBeenCalledWith('chat-event-payloads', ['chat_payload_1']);
    expect(mocks.chatEventDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueue.mock.invocationCallOrder[0]!
    );
  });

  it('only selects callback events whose chat dependencies have also expired', async () => {
    mocks.callbackEventFindMany.mockResolvedValue([]);

    await run('auditing/systemEvent/cleanup/many', {
      resource: 'callbackEvent',
      dueBefore: '2026-08-01T00:00:00.000Z'
    });

    expect(mocks.callbackEventFindMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: new Date('2026-08-01T00:00:00.000Z') },
        id: undefined,
        chatEvents: {
          every: { createdAt: { lt: new Date('2026-08-01T00:00:00.000Z') } }
        }
      },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: 500
    });
  });
});
