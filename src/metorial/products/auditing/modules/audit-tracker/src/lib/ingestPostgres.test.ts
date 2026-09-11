import { beforeEach, describe, expect, it, vi } from 'vitest';

let { withTransaction } = vi.hoisted(() => ({
  withTransaction: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  withTransaction
}));

import { ingestAuditEventsToPostgres, ingestAuditEventToPostgres } from './ingestPostgres';

let baseEvent = {
  id: 'aud_test',
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: {
    type: 'org_actor' as const,
    id: 'oac_1'
  },
  context: { ip: '127.0.0.1', ua: 'test' },
  resource: 'organization',
  action: 'create',
  payload: { oid: 5n, name: 'Acme' },
  previousPayload: { name: 'Old' },
  recordedAt: new Date('2026-08-12T10:00:00.000Z')
};

let expectedRow = {
  resource: 'organization',
  action: 'create',
  ip: '127.0.0.1',
  ua: 'test',
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actorType: 'org_actor',
  actorId: 'oac_1',
  actorMetadata: undefined,
  recordedAt: new Date('2026-08-12T10:00:00.000Z')
};

describe('ingestAuditEventsToPostgres', () => {
  let auditLogCreateMany = vi.fn();
  let auditLogFindMany = vi.fn();
  let dirtyTrackerUpsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogCreateMany.mockResolvedValue({ count: 1 });
    auditLogFindMany.mockResolvedValue([]);
    dirtyTrackerUpsert.mockResolvedValue({});

    withTransaction.mockImplementation(async (fn: any) =>
      fn({
        auditLog: {
          createMany: auditLogCreateMany,
          findMany: auditLogFindMany
        },
        auditLogDirtyTracker: {
          upsert: dirtyTrackerUpsert
        }
      })
    );
  });

  it('creates a self-keyed audit log in postgres', async () => {
    await ingestAuditEventToPostgres(baseEvent);

    expect(auditLogFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['aud_test'] } },
      select: { id: true }
    });
    expect(auditLogCreateMany).toHaveBeenCalledWith({
      data: [{ id: 'aud_test', ...expectedRow }],
      skipDuplicates: true
    });
    expect(dirtyTrackerUpsert).toHaveBeenCalledWith({
      where: { organizationOid: 1n },
      create: { organizationOid: 1n },
      update: { revision: { increment: 1 } }
    });
  });

  it('writes a whole batch with a fixed number of queries', async () => {
    await ingestAuditEventsToPostgres([
      { ...baseEvent, id: 'aud_1' },
      { ...baseEvent, id: 'aud_2' },
      { ...baseEvent, id: 'aud_3', organizationOid: 2n }
    ]);

    expect(auditLogFindMany).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMany).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMany.mock.calls[0]![0].data).toEqual([
      { id: 'aud_1', ...expectedRow },
      { id: 'aud_2', ...expectedRow },
      { id: 'aud_3', ...expectedRow, organizationOid: 2n }
    ]);
    expect(withTransaction).toHaveBeenCalledTimes(1);
  });

  it('bumps the dirty tracker once per organization, not once per event', async () => {
    await ingestAuditEventsToPostgres([
      { ...baseEvent, id: 'aud_1' },
      { ...baseEvent, id: 'aud_2' },
      { ...baseEvent, id: 'aud_3', organizationOid: 2n }
    ]);

    expect(dirtyTrackerUpsert).toHaveBeenCalledTimes(2);
    expect(dirtyTrackerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationOid: 1n } })
    );
    expect(dirtyTrackerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationOid: 2n } })
    );
  });

  it('stores a fine-grained actor without an organization actor oid', async () => {
    await ingestAuditEventsToPostgres([
      {
        ...baseEvent,
        id: 'aud_fine_grained',
        organizationActorOid: undefined,
        actor: {
          type: 'fine_grained_token',
          id: 'fgk_1',
          metadata: {
            sessionIds: ['ses_1']
          }
        }
      }
    ]);

    expect(auditLogCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          organizationActorOid: null,
          actorType: 'fine_grained_token',
          actorId: 'fgk_1',
          actorMetadata: {
            sessionIds: ['ses_1']
          }
        })
      ],
      skipDuplicates: true
    });
  });

  it('does not create a second audit log for an already ingested event', async () => {
    auditLogFindMany.mockResolvedValueOnce([{ id: 'aud_test' }]);

    await ingestAuditEventToPostgres(baseEvent);

    expect(auditLogCreateMany).not.toHaveBeenCalled();
    expect(dirtyTrackerUpsert).not.toHaveBeenCalled();
  });

  it('creates a single audit log when an event repeats within one batch', async () => {
    await ingestAuditEventsToPostgres([baseEvent, baseEvent]);

    expect(auditLogCreateMany.mock.calls[0]![0].data).toHaveLength(1);
  });

  it('does nothing for an empty batch', async () => {
    await ingestAuditEventsToPostgres([]);

    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('propagates database errors', async () => {
    auditLogFindMany.mockRejectedValueOnce({ code: 'P2003' });

    await expect(ingestAuditEventToPostgres(baseEvent)).rejects.toEqual({ code: 'P2003' });
  });
});
