import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues = new Map<string, any>();
let db = {
  triggerRawEvent: { findUnique: vi.fn(), update: vi.fn() },
  triggerEvent: { count: vi.fn() },
  triggerEventDispatch: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() }
};
let events = {
  upsertPending: vi.fn(),
  recordInvocation: vi.fn(),
  resolveMapped: vi.fn(),
  resolveRetryableFailure: vi.fn(),
  resolveFinalFailure: vi.fn()
};
let invocation = { createInvocationWithState: vi.fn(), mapTriggerEvent: vi.fn() };
let processQueue = { add: vi.fn(), addManyWithOps: vi.fn() };
let rawEventOffloadQueue = { add: vi.fn() };
let rawEvent: any;

vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: any) => {
    let queue: any = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: (handler: any) => {
        queue.handler = handler;
        return queue;
      }
    };
    queues.set(name, queue);
    return queue;
  }
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_options: any, handler: any) => ({ handler })
}));
vi.mock('../../db', () => ({ db }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('../../internal/triggerEventServiceInternal', () => ({
  triggerEventServiceInternal: events
}));
vi.mock('../../lib/slateVersion', () => ({
  getActiveSlateVersion: vi.fn(async () => ({ id: 'version' }))
}));
vi.mock('../../services/secret', () => ({ secretService: {} }));
vi.mock('../../services/slateInvocation', () => ({ slateInvocationService: invocation }));
vi.mock('./cleanup', () => ({ triggerRawEventCleanupQueue: { add: vi.fn() } }));
vi.mock('./eventProcess', () => ({ triggerEventProcessQueue: processQueue }));
vi.mock('./payloadOffload', () => ({
  triggerEventPayloadOffloadQueue: { add: vi.fn() },
  triggerRawEventPayloadOffloadQueue: rawEventOffloadQueue
}));

let run = (name: string, data: any) => queues.get(name).handler(data, { attemptsMade: 0 });
let map = () =>
  run('shub/trg/evt/mapOne/1', { rawEventId: 'raw', triggerId: 'changed', attempt: 1 });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  queues.clear();

  rawEvent = {
    id: 'raw',
    oid: 10n,
    source: 'webhook',
    webhookEventOid: 7n,
    payload: { changed: true },
    processingStatus: 'pending',
    pendingTriggerMapCount: 1,
    triggerRegistrationInstance: {
      id: 'instance',
      oid: 2n,
      triggerRegistration: {
        status: 'active',
        tenant: { disableCallbacks: false },
        slate: {},
        instance: {},
        instanceConfig: { value: {} },
        authConfig: null
      }
    }
  };
  db.triggerRawEvent.findUnique.mockResolvedValue(rawEvent);
  db.triggerRawEvent.update.mockResolvedValue({ id: 'raw', oid: 10n });
  db.triggerEventDispatch.updateMany.mockResolvedValue({ count: 1 });
  events.upsertPending.mockResolvedValue({ id: 'event', oid: 12n, status: 'pending' });
  events.resolveMapped.mockResolvedValue({
    accepted: true,
    rawEvent: { pendingTriggerMapCount: 0 }
  });
  invocation.createInvocationWithState.mockResolvedValue({});
  invocation.mapTriggerEvent.mockResolvedValue({
    status: 'success',
    invocation: { oid: 60n },
    data: { output: { mapped: true }, type: 'changed', id: 'item' }
  });

  await import('./map');
});

describe('mapped event delivery enqueue', () => {
  it('enqueues a freshly mapped event under the job id the dispatch scanner uses', async () => {
    await map();

    expect(processQueue.add).toHaveBeenCalledTimes(1);
    expect(processQueue.add).toHaveBeenCalledWith({ eventId: 'event' }, { id: 'event' });
    expect(events.resolveMapped.mock.invocationCallOrder[0]).toBeLessThan(
      processQueue.add.mock.invocationCallOrder[0]!
    );

    await import('./dispatch');
    db.triggerEventDispatch.findMany.mockResolvedValue([
      { eventOid: 12n, event: { id: 'event' } }
    ]);

    await run('shub/trg/mapped/dispatch/1', { cutoff: new Date().toISOString() });

    expect(processQueue.addManyWithOps).toHaveBeenCalledWith([
      { data: { eventId: 'event' }, opts: processQueue.add.mock.lastCall![1] }
    ]);
  });

  it('reuses that job id when a duplicate map job finds the event mapped but undelivered', async () => {
    events.upsertPending.mockResolvedValue({ id: 'event', oid: 12n, status: 'mapped' });
    db.triggerEventDispatch.findUnique.mockResolvedValue({ eventOid: 12n });

    await map();

    expect(db.triggerEventDispatch.findUnique).toHaveBeenCalledWith({
      where: { eventOid: 12n },
      select: { eventOid: true }
    });
    expect(invocation.mapTriggerEvent).not.toHaveBeenCalled();
    expect(processQueue.add).toHaveBeenCalledWith({ eventId: 'event' }, { id: 'event' });
  });

  it('does not deliver again when a duplicate map job runs after the delivery finished', async () => {
    events.upsertPending.mockResolvedValue({ id: 'event', oid: 12n, status: 'mapped' });
    db.triggerEventDispatch.findUnique.mockResolvedValue(null);

    await map();

    expect(invocation.mapTriggerEvent).not.toHaveBeenCalled();
    expect(processQueue.add).not.toHaveBeenCalled();
  });

  it('marks the raw event failed and offloads it after a final mapping failure', async () => {
    invocation.mapTriggerEvent.mockResolvedValue({
      status: 'error',
      invocation: { oid: 60n },
      error: { code: 'unmappable', message: 'cannot map', retryable: false }
    });
    db.triggerEvent.count.mockResolvedValue(0);

    await map();

    expect(events.resolveFinalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ eventOid: 12n, errorCode: 'unmappable' })
    );
    expect(db.triggerRawEvent.update).toHaveBeenCalledWith({
      where: { oid: 10n },
      data: { processingStatus: 'failed' }
    });
    expect(rawEventOffloadQueue.add).toHaveBeenCalledWith({ rawEventId: 'raw' });
    expect(processQueue.add).not.toHaveBeenCalled();
  });
});

describe('failed raw event payload offload', () => {
  let failedRawEvent = {
    id: 'raw',
    oid: 10n,
    processingStatus: 'failed',
    pendingTriggerMapCount: 1
  };

  it('offloads a failed raw event when the trigger that was still pending maps', async () => {
    events.resolveMapped.mockResolvedValue({ accepted: true, rawEvent: failedRawEvent });
    db.triggerEvent.count.mockResolvedValue(0);

    await map();

    expect(db.triggerEvent.count).toHaveBeenCalledWith({
      where: { rawEventOid: 10n, status: { in: ['pending', 'mapping_failed'] } }
    });
    expect(rawEventOffloadQueue.add).toHaveBeenCalledWith({ rawEventId: 'raw' });
    expect(processQueue.add).toHaveBeenCalledWith({ eventId: 'event' }, { id: 'event' });
  });

  it('keeps the payload while another trigger of the failed raw event is pending', async () => {
    events.resolveMapped.mockResolvedValue({ accepted: true, rawEvent: failedRawEvent });
    db.triggerEvent.count.mockResolvedValue(1);

    await map();

    expect(rawEventOffloadQueue.add).not.toHaveBeenCalled();
  });

  it('does not offload a raw event that has not failed', async () => {
    await map();

    expect(db.triggerEvent.count).not.toHaveBeenCalled();
    expect(rawEventOffloadQueue.add).not.toHaveBeenCalled();
  });

  it('repeats the offload check when a duplicate map job finds the event mapped', async () => {
    rawEvent.processingStatus = 'failed';
    events.upsertPending.mockResolvedValue({ id: 'event', oid: 12n, status: 'mapped' });
    db.triggerEventDispatch.findUnique.mockResolvedValue(null);
    db.triggerEvent.count.mockResolvedValue(0);

    await map();

    expect(rawEventOffloadQueue.add).toHaveBeenCalledWith({ rawEventId: 'raw' });
  });
});
