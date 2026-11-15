import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  processAuditEventQueueAdd,
  listClaimedAuditEvents,
  claimAuditEvents,
  acknowledgeClaimedAuditEvent,
  decodeStashedAuditEvent,
  presentStashedAuditEvent,
  ingestAuditEvents,
  ingestAuditEventsToPostgres
} = vi.hoisted(() => ({
  processAuditEventQueueAdd: vi.fn(),
  listClaimedAuditEvents: vi.fn(),
  claimAuditEvents: vi.fn(),
  acknowledgeClaimedAuditEvent: vi.fn(),
  decodeStashedAuditEvent: vi.fn((encodedEvent: string) => ({
    id: encodedEvent,
    payload: {
      encodedEvent
    }
  })),
  presentStashedAuditEvent: vi.fn(async (event: unknown) => ({
    ...(event as object),
    presented: true
  })),
  ingestAuditEvents: vi.fn(),
  ingestAuditEventsToPostgres: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => ({
    handler
  }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    add: processAuditEventQueueAdd,
    process: vi.fn(handler => ({
      handler
    }))
  }))
}));

vi.mock('../lib/stash', () => ({
  listClaimedAuditEvents,
  claimAuditEvents,
  acknowledgeClaimedAuditEvent,
  decodeStashedAuditEvent
}));

vi.mock('../lib/present', () => ({
  presentStashedAuditEvent
}));

vi.mock('@metorial/audit-models', () => ({
  ingestAuditEvents
}));

vi.mock('../lib/ingestPostgres', () => ({
  ingestAuditEventsToPostgres
}));

import { collectAuditEventsCron, processAuditEventQueueProcessor } from './processEvent';

let decoded = (encodedEvent: string) => ({
  id: encodedEvent,
  payload: {
    encodedEvent
  }
});

let item = (encodedEvent: string) => ({
  event: decoded(encodedEvent),
  encodedEvent
});

describe('audit event collection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClaimedAuditEvents.mockResolvedValue([]);
    claimAuditEvents.mockResolvedValue([]);
    acknowledgeClaimedAuditEvent.mockResolvedValue(undefined);
    processAuditEventQueueAdd.mockResolvedValue(undefined);
    presentStashedAuditEvent.mockImplementation(async (event: unknown) => ({
      ...(event as object),
      presented: true
    }));
    ingestAuditEvents.mockResolvedValue(undefined);
    ingestAuditEventsToPostgres.mockResolvedValue(undefined);
  });

  it('requeues claimed events before draining pending events in order', async () => {
    listClaimedAuditEvents.mockResolvedValueOnce(['claimed-event']);
    claimAuditEvents
      .mockResolvedValueOnce(['pending-event-1', 'pending-event-2'])
      .mockResolvedValueOnce([]);

    await (collectAuditEventsCron as any).handler();

    expect(processAuditEventQueueAdd).toHaveBeenNthCalledWith(
      1,
      { events: [item('claimed-event')] },
      { id: expect.stringMatching(/^audit-batch-[0-9a-f]{40}$/) }
    );
    expect(processAuditEventQueueAdd).toHaveBeenNthCalledWith(
      2,
      { events: [item('pending-event-1'), item('pending-event-2')] },
      { id: expect.stringMatching(/^audit-batch-[0-9a-f]{40}$/) }
    );
    expect(claimAuditEvents).toHaveBeenCalledWith(100);
    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });

  it('gives the same batch a stable job id so a requeue does not duplicate it', async () => {
    listClaimedAuditEvents.mockResolvedValue(['event-a', 'event-b']);

    await (collectAuditEventsCron as any).handler();
    await (collectAuditEventsCron as any).handler();

    let [, firstOpts] = processAuditEventQueueAdd.mock.calls[0]!;
    let [, secondOpts] = processAuditEventQueueAdd.mock.calls[1]!;
    expect(firstOpts.id).toBe(secondOpts.id);
  });

  it('gives different batches different job ids', async () => {
    listClaimedAuditEvents.mockResolvedValueOnce(['event-a']);
    await (collectAuditEventsCron as any).handler();

    listClaimedAuditEvents.mockResolvedValueOnce(['event-b']);
    await (collectAuditEventsCron as any).handler();

    let [, firstOpts] = processAuditEventQueueAdd.mock.calls[0]!;
    let [, secondOpts] = processAuditEventQueueAdd.mock.calls[1]!;
    expect(firstOpts.id).not.toBe(secondOpts.id);
  });

  it('leaves a claimed event recoverable when queueing fails', async () => {
    claimAuditEvents.mockResolvedValueOnce(['pending-event']);
    processAuditEventQueueAdd.mockRejectedValueOnce(new Error('Queue unavailable'));

    await expect((collectAuditEventsCron as any).handler()).rejects.toThrow(
      'Queue unavailable'
    );
    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });

  it('presents for mongodb, keeps raw for postgres, then acknowledges each event', async () => {
    let events = [item('encoded-1'), item('encoded-2')];

    await (processAuditEventQueueProcessor as any).handler({ events });

    expect(presentStashedAuditEvent).toHaveBeenCalledWith(events[0]!.event);
    expect(presentStashedAuditEvent).toHaveBeenCalledWith(events[1]!.event);
    expect(ingestAuditEvents).toHaveBeenCalledTimes(1);
    expect(ingestAuditEvents).toHaveBeenCalledWith([
      { ...events[0]!.event, presented: true },
      { ...events[1]!.event, presented: true }
    ]);
    expect(ingestAuditEventsToPostgres).toHaveBeenCalledTimes(1);
    expect(ingestAuditEventsToPostgres).toHaveBeenCalledWith([
      events[0]!.event,
      events[1]!.event
    ]);
    expect(acknowledgeClaimedAuditEvent).toHaveBeenCalledWith('encoded-1');
    expect(acknowledgeClaimedAuditEvent).toHaveBeenCalledWith('encoded-2');
    expect(ingestAuditEvents.mock.invocationCallOrder[0]).toBeLessThan(
      acknowledgeClaimedAuditEvent.mock.invocationCallOrder[0]!
    );
    expect(ingestAuditEventsToPostgres.mock.invocationCallOrder[0]).toBeLessThan(
      acknowledgeClaimedAuditEvent.mock.invocationCallOrder[0]!
    );
  });

  it('still processes a job queued in the pre-batch shape', async () => {
    let legacyJob = item('encoded-legacy');

    await (processAuditEventQueueProcessor as any).handler(legacyJob);

    expect(ingestAuditEvents).toHaveBeenCalledWith([
      { ...legacyJob.event, presented: true }
    ]);
    expect(ingestAuditEventsToPostgres).toHaveBeenCalledWith([legacyJob.event]);
    expect(acknowledgeClaimedAuditEvent).toHaveBeenCalledWith('encoded-legacy');
  });

  it('leaves the batch recoverable when presentation fails', async () => {
    presentStashedAuditEvent.mockRejectedValueOnce(new Error('Presenter failed'));

    await expect(
      (processAuditEventQueueProcessor as any).handler({ events: [item('encoded-1')] })
    ).rejects.toThrow('Presenter failed');

    expect(ingestAuditEvents).not.toHaveBeenCalled();
    expect(ingestAuditEventsToPostgres).not.toHaveBeenCalled();
    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });

  it('leaves the batch recoverable when ingest fails', async () => {
    ingestAuditEvents.mockRejectedValueOnce(new Error('Mongo unavailable'));

    await expect(
      (processAuditEventQueueProcessor as any).handler({ events: [item('encoded-1')] })
    ).rejects.toThrow('Mongo unavailable');

    expect(ingestAuditEventsToPostgres).not.toHaveBeenCalled();
    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });

  it('leaves the batch recoverable when postgres ingest fails', async () => {
    ingestAuditEventsToPostgres.mockRejectedValueOnce(new Error('Postgres unavailable'));

    await expect(
      (processAuditEventQueueProcessor as any).handler({ events: [item('encoded-1')] })
    ).rejects.toThrow('Postgres unavailable');

    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });
});
