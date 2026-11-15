import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues = new Map<string, any>();
let db = {
  triggerEvent: { findUnique: vi.fn() },
  triggerEventDispatch: { deleteMany: vi.fn() }
};
let receive = vi.fn();
let subspace: any;
let event: any;

vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: any) => {
    let queue: any = {
      add: vi.fn(),
      process: (handler: any) => {
        queue.handler = handler;
        return queue;
      }
    };
    queues.set(name, queue);
    return queue;
  }
}));
vi.mock('../../db', () => ({ db }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('../../subspace', () => ({ getSubspaceClient: () => subspace }));

let deliver = () => queues.get('shub/trg/evt/process/1').handler({ eventId: 'event' }, {});

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  queues.clear();

  subspace = { callbackEvent: { receive } };
  event = {
    id: 'event',
    oid: 12n,
    status: 'mapped',
    source: 'webhook',
    triggerId: 'changed',
    mappedType: 'changed',
    mappedId: 'item',
    createdAt: new Date(),
    webhookEvent: { id: 'webhook-event' },
    triggerRegistrationInstance: {
      triggerGroup: { key: 'events' },
      triggerRegistration: {
        id: 'registration',
        status: 'active',
        tenant: { identifier: 'tenant', disableCallbacks: false },
        callbackInstance: { id: 'callback-instance', callback: { id: 'callback' } }
      }
    }
  };
  db.triggerEvent.findUnique.mockResolvedValue(event);

  await import('./eventProcess');
});

describe('mapped event delivery', () => {
  it('delivers an event inside the age cap and then removes its dispatch row', async () => {
    let { TRIGGER_EVENT_DELIVER_MAX_AGE_MS } = await import('./_config');
    event.createdAt = new Date(Date.now() - TRIGGER_EVENT_DELIVER_MAX_AGE_MS + 60_000);

    await deliver();

    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerEventId: 'event',
        callbackInstanceId: 'callback-instance',
        occurredAt: event.createdAt
      })
    );
    expect(db.triggerEventDispatch.deleteMany).toHaveBeenCalledWith({
      where: { eventOid: 12n }
    });
    expect(receive.mock.invocationCallOrder[0]).toBeLessThan(
      db.triggerEventDispatch.deleteMany.mock.invocationCallOrder[0]!
    );
  });

  it('keeps the dispatch row when the receiver fails so the scanner retries', async () => {
    receive.mockRejectedValue(new Error('receiver unavailable'));

    await expect(deliver()).rejects.toThrow('receiver unavailable');

    expect(db.triggerEventDispatch.deleteMany).not.toHaveBeenCalled();
  });

  it('stops retrying an event older than the delivery age cap', async () => {
    let { TRIGGER_EVENT_DELIVER_MAX_AGE_MS } = await import('./_config');
    event.createdAt = new Date(Date.now() - TRIGGER_EVENT_DELIVER_MAX_AGE_MS - 60_000);

    await deliver();

    expect(receive).not.toHaveBeenCalled();
    expect(db.triggerEventDispatch.deleteMany).toHaveBeenCalledWith({
      where: { eventOid: 12n }
    });
  });

  it('removes the dispatch row when there is no receiver to deliver to', async () => {
    let log = vi.spyOn(console, 'log').mockImplementation(() => {});
    subspace = null;

    await deliver();

    expect(log).toHaveBeenCalledWith(expect.stringContaining('dropping trigger event event'));
    expect(db.triggerEventDispatch.deleteMany).toHaveBeenCalledWith({
      where: { eventOid: 12n }
    });
    expect(receive).not.toHaveBeenCalled();

    log.mockRestore();
  });
});
