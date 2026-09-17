import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, metorialDb, recordCallbackEvent, getCallbackEventDelegate, processor } = vi.hoisted(
  () => ({
    db: { callbackEvent: { findUnique: vi.fn() } },
    metorialDb: { instance: { findUnique: vi.fn() } },
    recordCallbackEvent: vi.fn(),
    getCallbackEventDelegate: vi.fn(),
    processor: { fn: null as ((data: { callbackEventId: string }) => Promise<void>) | null }
  })
);

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial/db', () => ({ db: metorialDb }));
vi.mock('@metorial/module-event-tracker', () => ({
  eventTrackerService: { recordCallbackEvent }
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost' } } }));
vi.mock('../lib/eventDelegation', () => ({ getCallbackEventDelegate }));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    process: (fn: (data: { callbackEventId: string }) => Promise<void>) => {
      processor.fn = fn;
      return {};
    }
  }))
}));

await import('./processEvent');

let run = (callbackEventId: string) => processor.fn!({ callbackEventId });

let callbackEvent = (overrides: Record<string, any> = {}) => ({
  id: 'cbe_1',
  environment: { instanceOid: BigInt(33) },
  callback: {
    id: 'clb_1',
    ownership: 'user',
    managedAdapterGlobal: null,
    provider: { id: 'prov_1' }
  },
  providerTrigger: { key: 'issue.created' },
  ...overrides
});

describe('callbackEventProcessQueueProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metorialDb.instance.findUnique.mockResolvedValue({
      oid: BigInt(33),
      organizationOid: BigInt(4)
    });
  });

  it('does nothing when the callback event no longer exists', async () => {
    db.callbackEvent.findUnique.mockResolvedValue(null);

    await run('cbe_gone');

    expect(recordCallbackEvent).not.toHaveBeenCalled();
  });

  it('does nothing when the environment has no instance', async () => {
    db.callbackEvent.findUnique.mockResolvedValue(
      callbackEvent({ environment: { instanceOid: null } })
    );

    await run('cbe_1');

    expect(recordCallbackEvent).not.toHaveBeenCalled();
  });

  it('records a system event with the callback provider id for a user-owned callback', async () => {
    db.callbackEvent.findUnique.mockResolvedValue(callbackEvent());

    await run('cbe_1');

    expect(recordCallbackEvent).toHaveBeenCalledWith({
      organizationOid: BigInt(4),
      instanceOid: BigInt(33),
      callbackEventId: 'cbe_1',
      callbackId: 'clb_1',
      callbackTriggerKey: 'issue.created',
      providerId: 'prov_1'
    });
  });

  it('delegates a managed callback and never records a system event directly', async () => {
    getCallbackEventDelegate.mockReturnValue(vi.fn().mockResolvedValue(undefined));
    db.callbackEvent.findUnique.mockResolvedValue(
      callbackEvent({
        callback: {
          id: 'clb_1',
          ownership: 'managed',
          managedAdapterGlobal: { identifier: 'chat' },
          provider: { id: 'prov_1' }
        }
      })
    );

    await run('cbe_1');

    expect(getCallbackEventDelegate).toHaveBeenCalledWith('chat');
    expect(recordCallbackEvent).not.toHaveBeenCalled();
  });

  it('throws when a managed callback has no registered delegate', async () => {
    getCallbackEventDelegate.mockReturnValue(null);
    db.callbackEvent.findUnique.mockResolvedValue(
      callbackEvent({
        callback: {
          id: 'clb_1',
          ownership: 'managed',
          managedAdapterGlobal: { identifier: 'unknown' },
          provider: { id: 'prov_1' }
        }
      })
    );

    await expect(run('cbe_1')).rejects.toThrow(/No callback event delegate registered/);
    expect(recordCallbackEvent).not.toHaveBeenCalled();
  });
});
