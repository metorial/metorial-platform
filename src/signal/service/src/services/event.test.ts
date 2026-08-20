import { describe, expect, it, vi } from 'vitest';

vi.mock('../queues/send/init', () => ({
  newEventQueue: { add: vi.fn() }
}));
import {
  computeIdempotentEventRequestFingerprint,
  computeStoredIdempotentEventRequestFingerprint,
  ensureEventInitializationEnqueued,
  eventServiceImpl,
  normalizeEventHeaders
} from './event';

let tenant = { oid: 1n, id: 'tenant-a' } as any;
let sender = { oid: 2n, id: 'sender-a' } as any;
let input = {
  idempotencyKey: 'stable-key',
  topics: ['users', 'orders', 'orders'],
  eventType: 'created',
  payloadJson: '{"z":1, "a":2}',
  headers: { 'X-Z': '2', 'x-a': '1' },
  onlyForDestinations: ['dest-b', 'dest-a', 'dest-a'],
  callbackInstanceId: 'instance-a',
  callbackSourceId: 'source-a',
  callbackTriggerId: 'trigger-a'
};
let callback = { oid: 3n, id: 'callback-a' } as any;

describe('Signal idempotent event fingerprint', () => {
  it('matches the shared protocol v1 vector', () => {
    expect(
      computeIdempotentEventRequestFingerprint({
        tenantId: tenant.id,
        senderId: sender.id,
        callbackId: callback.id,
        input
      })
    ).toBe('bcfe0b247b0e8d7b48047b84b08236c8c9416164c1d6a45d131972b4c1d50617');
  });

  it('translates ambiguous case-normalized headers to the Signal service error', () => {
    let operations = [
      () => normalizeEventHeaders({ 'X-Test': 'a', 'x-test': 'b' }),
      () =>
        computeIdempotentEventRequestFingerprint({
          tenantId: tenant.id,
          senderId: sender.id,
          callbackId: callback.id,
          input: { ...input, headers: { 'X-Test': 'a', 'x-test': 'b' } }
        })
    ];
    for (let operation of operations) {
      let thrown: unknown;
      try {
        operation();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({ data: { code: 'invalid_canonical_headers' } });
    }
  });

  it('does not translate unexpected protocol-boundary errors', () => {
    let unexpected = new Error('unexpected headers failure');
    let headers = {} as Record<string, string>;
    Object.defineProperty(headers, 'x-test', {
      enumerable: true,
      get: () => {
        throw unexpected;
      }
    });
    expect(() => normalizeEventHeaders(headers)).toThrow(unexpected);
  });

  it('binds the idempotency fingerprint to tenant, callback, instance, and payload', () => {
    let fingerprint = computeIdempotentEventRequestFingerprint({
      tenantId: tenant.id,
      senderId: sender.id,
      callbackId: callback.id,
      input
    });
    let variants = [
      { tenantId: 'tenant-other', callbackId: callback.id, input },
      { tenantId: tenant.id, callbackId: 'callback-other', input },
      {
        tenantId: tenant.id,
        callbackId: callback.id,
        input: { ...input, callbackInstanceId: 'instance-other' }
      },
      {
        tenantId: tenant.id,
        callbackId: callback.id,
        input: { ...input, payloadJson: '{"different":true}' }
      }
    ];

    for (let variant of variants) {
      expect(
        computeIdempotentEventRequestFingerprint({
          senderId: sender.id,
          ...variant
        })
      ).not.toBe(fingerprint);
    }
  });
});

describe('Signal idempotent create semantics', () => {
  it('creates once and returns the same event for the same key and fingerprint', async () => {
    let persisted: any = null;
    let store = {
      event: {
        findUnique: vi.fn(async () => persisted),
        create: vi.fn(async ({ data }: any) => {
          persisted = {
            ...data,
            id: 'event-a',
            tenantOid: tenant.oid,
            senderOid: sender.oid,
            sender,
            callback
          };
          return persisted;
        })
      }
    } as any;
    let enqueue = vi.fn(async () => {});
    let service = new eventServiceImpl(store, enqueue);

    let first = await service.createIdempotentEvent({ tenant, sender, callback, input });
    let second = await service.createIdempotentEvent({ tenant, sender, callback, input });

    expect(second.id).toBe(first.id);
    expect(store.event.create).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('returns a typed terminal conflict for the same key with different bytes', async () => {
    let fingerprint = computeIdempotentEventRequestFingerprint({
      tenantId: tenant.id,
      senderId: sender.id,
      callbackId: callback.id,
      input
    });
    let existing = {
      id: 'event-a',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      initializationStatus: 'initialized',
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      sender,
      callback
    };
    let store = {
      event: {
        findUnique: vi.fn(async () => existing),
        create: vi.fn()
      }
    } as any;
    let service = new eventServiceImpl(
      store,
      vi.fn(async () => {})
    );

    await expect(
      service.createIdempotentEvent({
        tenant,
        sender,
        callback,
        input: { ...input, payloadJson: '{"different":true}' }
      })
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });
    expect(store.event.create).not.toHaveBeenCalled();
  });

  it.each([
    ['tenant', { tenant: { ...tenant, oid: 100n, id: 'tenant-other' } }],
    ['callback', { callback: { ...callback, oid: 300n, id: 'callback-other' } }],
    ['callback instance', { input: { ...input, callbackInstanceId: 'instance-other' } }]
  ])('rejects reuse of one key with a different %s binding', async (_, variant) => {
    let fingerprint = computeIdempotentEventRequestFingerprint({
      tenantId: tenant.id,
      senderId: sender.id,
      callbackId: callback.id,
      input
    });
    let existing = {
      id: 'event-a',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      initializationStatus: 'initialized',
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      sender,
      callback
    };
    let store = {
      event: {
        findUnique: vi.fn(async () => existing),
        create: vi.fn()
      }
    } as any;
    let service = new eventServiceImpl(
      store,
      vi.fn(async () => {})
    );

    await expect(
      service.createIdempotentEvent({
        tenant,
        sender,
        callback,
        input,
        ...variant
      })
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });
    expect(store.event.create).not.toHaveBeenCalled();
  });

  it('recovers an ambiguous commit/enqueue boundary without creating a second event', async () => {
    let persisted: any = null;
    let store = {
      event: {
        findUnique: vi.fn(async () => persisted),
        create: vi.fn(async ({ data }: any) => {
          persisted = {
            ...data,
            id: 'event-stable',
            tenantOid: tenant.oid,
            senderOid: sender.oid,
            sender,
            callback
          };
          return persisted;
        }),
        updateMany: vi.fn(async ({ data }: any) => {
          persisted = { ...persisted, ...data };
          return { count: 1 };
        })
      }
    } as any;
    let enqueueAttempts = 0;
    let queueAdd = vi.fn(async (_data: any, opts: any) => {
      enqueueAttempts += 1;
      expect(opts).toEqual({ id: 'event-stable' });
      if (enqueueAttempts === 1) throw new Error('ambiguous queue response');
    });
    let service = new eventServiceImpl(store, event =>
      ensureEventInitializationEnqueued(event, {
        enqueue: queueAdd as any,
        store
      })
    );

    let first = await service.createIdempotentEvent({ tenant, sender, callback, input });
    let retry = await service.createIdempotentEvent({ tenant, sender, callback, input });

    expect(first.id).toBe('event-stable');
    expect(retry.id).toBe(first.id);
    expect(store.event.create).toHaveBeenCalledOnce();
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(queueAdd.mock.calls[0]![0]).toEqual({ eventId: 'event-stable' });
    expect(queueAdd.mock.calls[1]![0]).toEqual({ eventId: 'event-stable' });
  });

  it('resolves a concurrent unique-key race only when the winner fingerprint matches', async () => {
    let fingerprint = computeIdempotentEventRequestFingerprint({
      tenantId: tenant.id,
      senderId: sender.id,
      callbackId: callback.id,
      input
    });
    let winner = {
      id: 'event-winner',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      initializationStatus: 'awaiting_enqueue',
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      sender,
      callback
    };
    let calls = 0;
    let store = {
      event: {
        findUnique: vi.fn(async () => (++calls === 1 ? null : winner)),
        create: vi.fn(async () => {
          throw { code: 'P2002' };
        })
      }
    } as any;
    let service = new eventServiceImpl(
      store,
      vi.fn(async () => {})
    );

    await expect(
      service.createIdempotentEvent({ tenant, sender, callback, input })
    ).resolves.toBe(winner);
  });

  it('lazily repairs an exact legacy fingerprint and accepts the original retry', async () => {
    let legacy = {
      oid: 10n,
      id: 'event-legacy',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: null,
      initializationStatus: 'initialized',
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      tenant,
      sender,
      callback,
      topics: ['orders', 'users'],
      eventType: input.eventType,
      payloadJson: input.payloadJson,
      headers: [
        ['x-a', '1'],
        ['x-z', '2']
      ],
      onlyForDestinations: ['dest-a', 'dest-b'],
      hasOnlyForDestinationsFilter: true,
      callbackInstanceId: input.callbackInstanceId,
      callbackSourceId: input.callbackSourceId,
      callbackTriggerId: input.callbackTriggerId
    } as any;
    let store = {
      event: {
        findUnique: vi.fn(async () => legacy),
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn()
      }
    } as any;
    let enqueue = vi.fn(async () => {});
    let service = new eventServiceImpl(store, enqueue);

    await expect(
      service.createIdempotentEvent({ tenant, sender, callback, input })
    ).resolves.toMatchObject({
      id: 'event-legacy',
      requestFingerprint: 'bcfe0b247b0e8d7b48047b84b08236c8c9416164c1d6a45d131972b4c1d50617'
    });
    expect(store.event.updateMany).toHaveBeenCalledWith({
      where: {
        oid: legacy.oid,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: null
      },
      data: {
        requestFingerprint: 'bcfe0b247b0e8d7b48047b84b08236c8c9416164c1d6a45d131972b4c1d50617'
      }
    });
    expect(store.event.create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it('repairs a legacy row before rejecting a mismatched retry', async () => {
    let legacy = {
      oid: 10n,
      id: 'event-legacy',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: null,
      initializationStatus: 'initialized',
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      tenant,
      sender,
      callback,
      topics: ['orders', 'users'],
      eventType: input.eventType,
      payloadJson: input.payloadJson,
      headers: [
        ['x-a', '1'],
        ['x-z', '2']
      ],
      onlyForDestinations: ['dest-a', 'dest-b'],
      hasOnlyForDestinationsFilter: true,
      callbackInstanceId: input.callbackInstanceId,
      callbackSourceId: input.callbackSourceId,
      callbackTriggerId: input.callbackTriggerId
    } as any;
    let updateMany = vi.fn(async () => ({ count: 1 }));
    let service = new eventServiceImpl(
      {
        event: {
          findUnique: vi.fn(async () => legacy),
          updateMany,
          create: vi.fn()
        }
      } as any,
      vi.fn(async () => {})
    );

    await expect(
      service.createIdempotentEvent({
        tenant,
        sender,
        callback,
        input: { ...input, payloadJson: '{"different":true}' }
      })
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it('reconstructs the exact v1 fingerprint for legacy offloaded payloads', async () => {
    let fingerprint = await computeStoredIdempotentEventRequestFingerprint(
      {
        oid: 10n,
        id: 'event-legacy-offloaded',
        idempotencyKey: input.idempotencyKey,
        tenant,
        sender,
        callback,
        topics: ['orders', 'users'],
        eventType: input.eventType,
        payloadJson: null,
        onlyForDestinations: ['dest-a', 'dest-b'],
        hasOnlyForDestinationsFilter: true,
        callbackInstanceId: input.callbackInstanceId,
        callbackSourceId: input.callbackSourceId,
        callbackTriggerId: input.callbackTriggerId
      } as any,
      {
        readOffloadedPayload: async () => ({
          body: input.payloadJson,
          headers: [
            ['x-a', '1'],
            ['x-z', '2']
          ]
        })
      }
    );
    expect(fingerprint).toBe(
      computeIdempotentEventRequestFingerprint({
        tenantId: tenant.id,
        senderId: sender.id,
        callbackId: callback.id,
        input
      })
    );
  });
});

describe('Signal initialization enqueue crash boundary', () => {
  it('keeps the committed awaiting marker when enqueue fails', async () => {
    let updateMany = vi.fn();
    await expect(
      ensureEventInitializationEnqueued(
        { id: 'event-a', initializationStatus: 'awaiting_enqueue' },
        {
          enqueue: vi.fn(async () => {
            throw new Error('queue unavailable');
          }) as any,
          store: { event: { updateMany } } as any
        }
      )
    ).resolves.toBeUndefined();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
