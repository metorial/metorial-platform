import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  processAuditEventQueueAddManyWithOps,
  listClaimedAuditEvents,
  claimAuditEvents,
  acknowledgeClaimedAuditEvent,
  decodeStashedAuditEvent,
  ingestAuditEvent,
  ingestAuditEventToPostgres
} = vi.hoisted(() => ({
  processAuditEventQueueAddManyWithOps: vi.fn(),
  listClaimedAuditEvents: vi.fn(),
  claimAuditEvents: vi.fn(),
  acknowledgeClaimedAuditEvent: vi.fn(),
  decodeStashedAuditEvent: vi.fn((encodedEvent: string) => ({
    id: encodedEvent,
    payload: {
      encodedEvent
    }
  })),
  ingestAuditEvent: vi.fn(),
  ingestAuditEventToPostgres: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => ({
    handler
  }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    addManyWithOps: processAuditEventQueueAddManyWithOps,
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

vi.mock('@metorial/audit-models', () => ({
  ingestAuditEvent
}));

vi.mock('../lib/ingestPostgres', () => ({
  ingestAuditEventToPostgres
}));

import { collectAuditEventsCron, processAuditEventQueueProcessor } from './processEvent';

describe('audit event collection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClaimedAuditEvents.mockResolvedValue([]);
    claimAuditEvents.mockResolvedValue([]);
    acknowledgeClaimedAuditEvent.mockResolvedValue(undefined);
    processAuditEventQueueAddManyWithOps.mockResolvedValue(undefined);
    ingestAuditEvent.mockResolvedValue(undefined);
    ingestAuditEventToPostgres.mockResolvedValue(undefined);
  });

  it('requeues claimed events before draining pending events in order', async () => {
    listClaimedAuditEvents.mockResolvedValueOnce(['claimed-event']);
    claimAuditEvents
      .mockResolvedValueOnce(['pending-event-1', 'pending-event-2'])
      .mockResolvedValueOnce([]);

    await (collectAuditEventsCron as any).handler();

    expect(processAuditEventQueueAddManyWithOps).toHaveBeenNthCalledWith(1, [
      {
        data: {
          event: {
            id: 'claimed-event',
            payload: {
              encodedEvent: 'claimed-event'
            }
          },
          encodedEvent: 'claimed-event'
        },
        opts: {
          id: 'claimed-event'
        }
      }
    ]);
    expect(processAuditEventQueueAddManyWithOps).toHaveBeenNthCalledWith(2, [
      {
        data: {
          event: {
            id: 'pending-event-1',
            payload: {
              encodedEvent: 'pending-event-1'
            }
          },
          encodedEvent: 'pending-event-1'
        },
        opts: {
          id: 'pending-event-1'
        }
      },
      {
        data: {
          event: {
            id: 'pending-event-2',
            payload: {
              encodedEvent: 'pending-event-2'
            }
          },
          encodedEvent: 'pending-event-2'
        },
        opts: {
          id: 'pending-event-2'
        }
      }
    ]);
    expect(claimAuditEvents).toHaveBeenCalledWith(10);
    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });

  it('leaves a claimed event recoverable when queueing fails', async () => {
    claimAuditEvents.mockResolvedValueOnce(['pending-event']);
    processAuditEventQueueAddManyWithOps.mockRejectedValueOnce(new Error('Queue unavailable'));

    await expect((collectAuditEventsCron as any).handler()).rejects.toThrow(
      'Queue unavailable'
    );
    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });

  it('ingests the event before acknowledging the claimed stash entry', async () => {
    let data = {
      event: {
        id: 'event-1'
      },
      encodedEvent: 'encoded-event'
    };

    await (processAuditEventQueueProcessor as any).handler(data);

    expect(ingestAuditEvent).toHaveBeenCalledWith(data.event);
    expect(ingestAuditEventToPostgres).toHaveBeenCalledWith(data.event);
    expect(acknowledgeClaimedAuditEvent).toHaveBeenCalledWith('encoded-event');
    expect(ingestAuditEvent.mock.invocationCallOrder[0]).toBeLessThan(
      acknowledgeClaimedAuditEvent.mock.invocationCallOrder[0]!
    );
    expect(ingestAuditEventToPostgres.mock.invocationCallOrder[0]).toBeLessThan(
      acknowledgeClaimedAuditEvent.mock.invocationCallOrder[0]!
    );
  });

  it('leaves a claimed event recoverable when ingest fails', async () => {
    ingestAuditEvent.mockRejectedValueOnce(new Error('Mongo unavailable'));

    await expect(
      (processAuditEventQueueProcessor as any).handler({
        event: { id: 'event-1' },
        encodedEvent: 'encoded-event'
      })
    ).rejects.toThrow('Mongo unavailable');

    expect(ingestAuditEventToPostgres).not.toHaveBeenCalled();
    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });

  it('leaves a claimed event recoverable when postgres ingest fails', async () => {
    ingestAuditEventToPostgres.mockRejectedValueOnce(new Error('Postgres unavailable'));

    await expect(
      (processAuditEventQueueProcessor as any).handler({
        event: { id: 'event-1' },
        encodedEvent: 'encoded-event'
      })
    ).rejects.toThrow('Postgres unavailable');

    expect(acknowledgeClaimedAuditEvent).not.toHaveBeenCalled();
  });
});
