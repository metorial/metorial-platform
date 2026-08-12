import { beforeEach, describe, expect, it, vi } from 'vitest';

let { withTransaction, generateId } = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  generateId: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  ID: {
    generateId
  },
  withTransaction
}));

import { ingestAuditEventToPostgres } from './ingestPostgres';

describe('ingestAuditEventToPostgres', () => {
  let eventCreate = vi.fn();
  let auditLogCreate = vi.fn();
  let eventFindUnique = vi.fn();
  let dirtyTrackerUpsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    generateId.mockResolvedValue('aud_test');
    eventCreate.mockResolvedValue({});
    auditLogCreate.mockResolvedValue({});
    dirtyTrackerUpsert.mockResolvedValue({});
    eventFindUnique.mockResolvedValue(null);

    withTransaction.mockImplementation(async (fn: any) =>
      fn({
        event: {
          findUnique: eventFindUnique,
          create: eventCreate
        },
        auditLog: {
          create: auditLogCreate
        },
        auditLogDirtyTracker: {
          upsert: dirtyTrackerUpsert
        }
      })
    );
  });

  it('creates an event and linked audit log in postgres', async () => {
    await ingestAuditEventToPostgres({
      id: 'evt_test',
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: 3n,
      context: { ip: '127.0.0.1', ua: 'test' },
      resource: 'organization',
      action: 'create',
      payload: { oid: 4n, name: 'Acme' },
      previousAttributes: { name: 'Old' },
      recordedAt: new Date('2026-08-12T10:00:00.000Z')
    });

    expect(generateId).toHaveBeenCalledWith('auditLog');
    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        id: 'evt_test',
        resource: 'organization',
        action: 'create',
        ip: '127.0.0.1',
        ua: 'test',
        resourceTenantOid: 1n,
        resourceGroupOid: 2n,
        resourceActorOid: 3n,
        recordedAt: new Date('2026-08-12T10:00:00.000Z'),
        auditLogs: {
          create: {
            id: 'aud_test',
            resource: 'organization',
            action: 'create',
            ip: '127.0.0.1',
            ua: 'test',
            resourceTenantOid: 1n,
            resourceGroupOid: 2n,
            resourceActorOid: 3n,
            recordedAt: new Date('2026-08-12T10:00:00.000Z')
          }
        }
      }
    });
    expect(dirtyTrackerUpsert).toHaveBeenCalledWith({
      where: { resourceTenantOid: 1n },
      create: { resourceTenantOid: 1n },
      update: {}
    });
  });

  it('creates a missing audit log when the event already exists', async () => {
    eventFindUnique.mockResolvedValueOnce({
      oid: 10n,
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: 3n,
      auditLogs: []
    });

    await ingestAuditEventToPostgres({
      id: 'evt_test',
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: 3n,
      context: { ip: '127.0.0.1' },
      resource: 'organization',
      action: 'create',
      payload: { name: 'Acme' },
      recordedAt: new Date('2026-08-12T10:00:00.000Z')
    });

    expect(eventCreate).not.toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'aud_test',
        eventOid: 10n,
        resourceTenantOid: 1n
      })
    });
    expect(dirtyTrackerUpsert).toHaveBeenCalledWith({
      where: { resourceTenantOid: 1n },
      create: { resourceTenantOid: 1n },
      update: {}
    });
  });

  it('is a no-op when the event and audit log already exist', async () => {
    eventFindUnique.mockResolvedValueOnce({
      oid: 10n,
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: 3n,
      auditLogs: [{ oid: 11n }]
    });

    await ingestAuditEventToPostgres({
      id: 'evt_test',
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: 3n,
      context: { ip: '127.0.0.1' },
      resource: 'organization',
      action: 'create',
      payload: { name: 'Acme' },
      recordedAt: new Date('2026-08-12T10:00:00.000Z')
    });

    expect(eventCreate).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });
});
