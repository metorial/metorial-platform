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
  let dirtyTrackerCreateMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    generateId.mockResolvedValue('aud_test');
    eventCreate.mockResolvedValue({});
    dirtyTrackerCreateMany.mockResolvedValue({});

    withTransaction.mockImplementation(async (fn: any) =>
      fn({
        event: {
          create: eventCreate
        },
        auditLogDirtyTracker: {
          createMany: dirtyTrackerCreateMany
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
      actor: {
        type: 'org_actor',
        id: 'oac_1'
      },
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
        actorType: 'org_actor',
        actorId: 'oac_1',
        actorMetadata: undefined,
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
            actorType: 'org_actor',
            actorId: 'oac_1',
            actorMetadata: undefined,
            recordedAt: new Date('2026-08-12T10:00:00.000Z')
          }
        }
      }
    });
    expect(dirtyTrackerCreateMany).toHaveBeenCalledWith({
      data: { resourceTenantOid: 1n },
      skipDuplicates: true
    });
  });

  it('stores a fine-grained actor without a resource actor oid', async () => {
    await ingestAuditEventToPostgres({
      id: 'evt_fine_grained',
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      actor: {
        type: 'fine_grained_token',
        id: 'fgk_1',
        metadata: {
          sessionIds: ['ses_1']
        }
      },
      context: { ip: '127.0.0.1' },
      resource: 'organization',
      action: 'create',
      payload: {},
      recordedAt: new Date('2026-08-12T10:00:00.000Z')
    });

    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resourceActorOid: null,
        actorType: 'fine_grained_token',
        actorId: 'fgk_1',
        actorMetadata: {
          sessionIds: ['ses_1']
        }
      })
    });
  });

  it('ignores duplicate events', async () => {
    eventCreate.mockRejectedValueOnce({ code: 'P2002' });

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

    expect(dirtyTrackerCreateMany).not.toHaveBeenCalled();
  });

  it('propagates non-duplicate database errors', async () => {
    eventCreate.mockRejectedValueOnce({ code: 'P2003' });

    await expect(
      ingestAuditEventToPostgres({
        id: 'evt_test',
        resourceTenantOid: 1n,
        resourceGroupOid: 2n,
        resourceActorOid: 3n,
        context: { ip: '127.0.0.1' },
        resource: 'organization',
        action: 'create',
        payload: { name: 'Acme' },
        recordedAt: new Date('2026-08-12T10:00:00.000Z')
      })
    ).rejects.toEqual({ code: 'P2003' });
  });
});
