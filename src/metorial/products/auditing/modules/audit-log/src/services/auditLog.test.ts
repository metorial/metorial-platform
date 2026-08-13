import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  findOrganization,
  findAuditLog,
  findAuditLogs,
  findConsumerProfiles,
  getAuditEventsByIds,
  getImageUrl
} = vi.hoisted(() => ({
  findOrganization: vi.fn(),
  findAuditLog: vi.fn(),
  findAuditLogs: vi.fn(),
  findConsumerProfiles: vi.fn(),
  getAuditEventsByIds: vi.fn(),
  getImageUrl: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    organization: {
      findFirst: findOrganization
    },
    auditLog: {
      findFirst: findAuditLog,
      findMany: findAuditLogs
    },
    consumerProfile: {
      findMany: findConsumerProfiles
    }
  },
  getImageUrl
}));

vi.mock('@metorial/audit-models', () => ({
  getAuditEventsByIds
}));

import { auditLogService } from './auditLog';

let recordedAt = new Date('2026-08-13T10:00:00.000Z');
let baseAuditLog = {
  oid: 1n,
  id: 'aud_1',
  resource: 'organization',
  action: 'update',
  ua: 'test',
  ip: '127.0.0.1',
  organizationOid: 2n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actorType: 'org_actor',
  actorId: 'oac_1',
  actorMetadata: { source: 'dashboard' },
  eventOid: 5n,
  event: {
    oid: 5n,
    id: 'evt_1'
  },
  organization: {
    id: 'org_1'
  },
  instance: {
    id: 'ins_1'
  },
  organizationActor: {
    id: 'oac_1',
    type: 'member',
    name: 'Alex Chen',
    email: 'alex@example.com',
    image: {},
    member: {
      id: 'mem_1',
      status: 'active',
      role: 'admin'
    }
  },
  recordedAt
};

describe('auditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrganization.mockResolvedValue({
      oid: 2n,
      id: 'org_1',
      slug: 'acme',
      status: 'active'
    });
    findAuditLogs.mockResolvedValue([baseAuditLog]);
    findAuditLog.mockResolvedValue(baseAuditLog);
    findConsumerProfiles.mockResolvedValue([]);
    getImageUrl.mockResolvedValue('https://images.example.com/alex');
    getAuditEventsByIds.mockResolvedValue([
      {
        _id: 'evt_1',
        payload: { id: 'org_1', name: 'Acme' },
        previousAttributes: { name: 'Old Acme' }
      }
    ]);
  });

  it('lists Postgres audit logs and batch-hydrates their Mongo events', async () => {
    let paginator = await auditLogService.listAuditLogs({ organizationId: 'org_1' });
    let result = await paginator.run({ limit: 20 });

    expect(findOrganization).toHaveBeenCalledWith({
      where: {
        OR: [{ id: 'org_1' }, { slug: 'org_1' }, { previousSlugs: { has: 'org_1' } }],
        status: 'active'
      }
    });
    expect(findAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationOid: 2n },
        include: {
          event: true,
          organization: true,
          instance: true,
          organizationActor: {
            include: {
              member: true
            }
          }
        },
        orderBy: [{ id: 'desc' }]
      })
    );
    expect(getAuditEventsByIds).toHaveBeenCalledWith(['evt_1']);
    expect(result.items).toEqual([
      {
        id: 'aud_1',
        eventId: 'evt_1',
        resource: 'organization',
        action: 'update',
        organizationId: 'org_1',
        instanceId: 'ins_1',
        organizationActorId: 'oac_1',
        actor: {
          type: 'org_actor',
          id: 'oac_1',
          metadata: { source: 'dashboard' },
          record: {
            object: 'organization_actor',
            id: 'oac_1',
            type: 'member',
            name: 'Alex Chen',
            email: 'alex@example.com',
            imageUrl: 'https://images.example.com/alex',
            member: {
              id: 'mem_1',
              status: 'active',
              role: 'admin'
            }
          }
        },
        context: {
          ip: '127.0.0.1',
          ua: 'test'
        },
        payload: { id: 'org_1', name: 'Acme' },
        previousAttributes: { name: 'Old Acme' },
        recordedAt
      }
    ]);
    expect(result.items[0]).not.toHaveProperty('organizationOid');
    expect(result.items[0]).not.toHaveProperty('instanceOid');
    expect(result.items[0]).not.toHaveProperty('organizationActorOid');
  });

  it('enriches consumer profile actors with their public records', async () => {
    findAuditLogs.mockResolvedValue([
      {
        ...baseAuditLog,
        actorType: 'consumer_profile',
        actorId: 'cop_1',
        organizationActorOid: null,
        organizationActor: null
      }
    ]);
    findConsumerProfiles.mockResolvedValue([
      {
        id: 'cop_1',
        status: 'active',
        name: 'Taylor',
        email: 'taylor@example.com',
        instance: { id: 'ins_1' },
        organizationActor: { id: 'oac_2' }
      }
    ]);

    let paginator = await auditLogService.listAuditLogs({ organizationId: 'org_1' });
    let result = await paginator.run({});

    expect(findConsumerProfiles).toHaveBeenCalledWith({
      where: {
        id: { in: ['cop_1'] },
        organizationOid: 2n
      },
      select: expect.any(Object)
    });
    expect(result.items[0]?.actor).toEqual({
      type: 'consumer_profile',
      id: 'cop_1',
      metadata: { source: 'dashboard' },
      record: {
        object: 'consumer_profile',
        id: 'cop_1',
        status: 'active',
        name: 'Taylor',
        email: 'taylor@example.com',
        instanceId: 'ins_1',
        organizationActorId: 'oac_2'
      }
    });
  });

  it('gets and hydrates an audit log scoped to its organization', async () => {
    await expect(
      auditLogService.getAuditLog({
        organizationId: 'org_1',
        auditLogId: 'aud_1'
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'aud_1',
        eventId: 'evt_1',
        organizationId: 'org_1',
        payload: { id: 'org_1', name: 'Acme' }
      })
    );

    expect(findAuditLog).toHaveBeenCalledWith({
      where: {
        id: 'aud_1',
        organizationOid: 2n
      },
      include: expect.any(Object)
    });
    expect(getAuditEventsByIds).toHaveBeenCalledWith(['evt_1']);
  });

  it('rejects an audit log outside the organization scope', async () => {
    findAuditLog.mockResolvedValue(null);

    await expect(
      auditLogService.getAuditLog({
        organizationId: 'org_1',
        auditLogId: 'aud_other'
      })
    ).rejects.toBeDefined();
    expect(getAuditEventsByIds).not.toHaveBeenCalled();
  });

  it('keeps metadata-only rows when the Mongo event is missing', async () => {
    getAuditEventsByIds.mockResolvedValue([]);

    let paginator = await auditLogService.listAuditLogs({ organizationId: 'org_1' });
    let result = await paginator.run({});

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'aud_1',
        eventId: 'evt_1',
        payload: undefined,
        previousAttributes: undefined
      })
    );
  });

  it('does not query Mongo for an empty page', async () => {
    findAuditLogs.mockResolvedValue([]);

    let paginator = await auditLogService.listAuditLogs({ organizationId: 'org_1' });
    await expect(paginator.run({})).resolves.toEqual({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false
      }
    });
    expect(getAuditEventsByIds).toHaveBeenCalledWith([]);
  });

  it('forwards cursor pagination to Postgres', async () => {
    findAuditLogs.mockResolvedValue([{ ...baseAuditLog, id: 'aud_0' }, baseAuditLog]);

    let paginator = await auditLogService.listAuditLogs({ organizationId: 'org_1' });
    await paginator.run({ before: 'aud_1', limit: 1, order: 'asc' });

    expect(findAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'aud_1' },
        orderBy: [{ id: 'asc' }],
        take: -3
      })
    );
  });
});
