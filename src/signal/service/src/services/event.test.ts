import { describe, expect, it, vi } from 'vitest';

vi.mock('../queues/send/init', () => ({
  newEventQueue: { add: vi.fn() }
}));

import {
  computeIdempotentEventRequestFingerprint,
  ensureEventInitializationEnqueued,
  eventServiceImpl,
  normalizeEventHeaders
} from './event';

let tenant = { oid: 1n, id: 'tenant-a' } as any;
let sender = { oid: 2n, id: 'sender-a' } as any;
let callback = { oid: 3n, id: 'callback-a' } as any;
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

let fingerprint = () =>
  computeIdempotentEventRequestFingerprint({
    tenantId: tenant.id,
    senderId: sender.id,
    callbackId: callback.id,
    input
  });

describe('Signal idempotent event fingerprint', () => {
  it('matches the shared protocol v1 vector', () => {
    expect(fingerprint()).toBe(
      'bcfe0b247b0e8d7b48047b84b08236c8c9416164c1d6a45d131972b4c1d50617'
    );
  });

  it('translates ambiguous case-normalized headers to a typed request error', () => {
    expect(() => normalizeEventHeaders({ 'X-Test': 'a', 'x-test': 'b' })).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'invalid_canonical_headers' })
      })
    );
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
    expect(store.event.create).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({
      requestFingerprint: fingerprint(),
      initializationStatus: 'awaiting_enqueue',
      topics: ['orders', 'users'],
      onlyForDestinations: ['dest-a', 'dest-b'],
      headers: [
        ['x-a', '1'],
        ['x-z', '2']
      ]
    });
  });

  it.each([
    ['payload', { input: { ...input, payloadJson: '{"different":true}' } }],
    ['tenant', { tenant: { ...tenant, oid: 100n, id: 'tenant-other' } }],
    ['sender', { sender: { ...sender, oid: 200n, id: 'sender-other' } }],
    ['callback', { callback: { ...callback, oid: 300n, id: 'callback-other' } }],
    ['callback instance', { input: { ...input, callbackInstanceId: 'instance-other' } }]
  ])('rejects reuse of one key with a different %s binding', async (_, variant) => {
    let existing = {
      id: 'event-a',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint(),
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
      service.createIdempotentEvent({ tenant, sender, callback, input, ...variant })
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });
    expect(store.event.create).not.toHaveBeenCalled();
  });

  it('resolves a concurrent unique-key race only through the committed winner', async () => {
    let winner = {
      id: 'event-winner',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint(),
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

  it('fails closed when an existing idempotent row has no stored fingerprint', async () => {
    let existing = {
      id: 'event-without-fingerprint',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: null,
      initializationStatus: 'initialized',
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      sender,
      callback
    };
    let enqueue = vi.fn(async () => {});
    let store = {
      event: {
        findUnique: vi.fn(async () => existing),
        create: vi.fn(),
        updateMany: vi.fn()
      }
    } as any;
    let service = new eventServiceImpl(store, enqueue);

    await expect(
      service.createIdempotentEvent({ tenant, sender, callback, input })
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });
    expect(store.event.updateMany).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('Signal initialization enqueue crash boundary', () => {
  it('uses a stable queue ID and repairs a failed enqueue when the create is retried', async () => {
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
    let attempts = 0;
    let queueAdd = vi.fn(async (_data: any, opts: any) => {
      attempts += 1;
      expect(opts).toEqual({ id: 'event-stable' });
      if (attempts === 1) throw new Error('ambiguous queue response');
    });
    let consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let service = new eventServiceImpl(store, event =>
      ensureEventInitializationEnqueued(event, { enqueue: queueAdd as any, store })
    );

    let first = await service.createIdempotentEvent({ tenant, sender, callback, input });
    let retry = await service.createIdempotentEvent({ tenant, sender, callback, input });

    expect(first.id).toBe('event-stable');
    expect(retry.id).toBe('event-stable');
    expect(store.event.create).toHaveBeenCalledOnce();
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(persisted.initializationStatus).toBe('queued');
    consoleError.mockRestore();
  });
});
