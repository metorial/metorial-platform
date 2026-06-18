import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    provider: {
      findFirstOrThrow: vi.fn()
    },
    tenant: {
      findMany: vi.fn()
    },
    environment: {
      findMany: vi.fn()
    },
    sessionErrorGroup: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

let from = new Date('2026-06-11T00:00:00.000Z');
let to = new Date('2026-06-18T00:00:00.000Z');

let createGroup = (id: string, createdAt: Date) => ({
  id,
  type: 'message_processing_provider_error',
  code: 'provider_error',
  message: `Message ${id}`,
  hash: `hash-${id}`,
  occurrenceCount: 3,
  provider: {
    id: 'prv_1',
    name: 'Slack',
    slug: 'slack'
  },
  tenant: {
    id: 'ten_1'
  },
  environment: {
    id: 'ken_1'
  },
  firstOccurrence: {
    id: 'serr_1',
    session: { id: 'ses_1' },
    providerRun: { id: 'prun_1' }
  },
  sessionErrorGroupOccurrencePeriods: [
    {
      startsAt: from,
      endsAt: to,
      occurrenceCount: 2
    }
  ],
  createdAt
});

describe('listAdminProviderTelemetryErrorGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.provider.findFirstOrThrow.mockResolvedValue({ oid: 10n });
    db.tenant.findMany.mockResolvedValue([{ id: 'ten_1', oid: 20n }]);
    db.environment.findMany.mockResolvedValue([{ id: 'ken_1', oid: 30n }]);
  });

  it('preserves the admin Error Groups query filters and ordering', async () => {
    let { listAdminProviderTelemetryErrorGroups } =
      await import('./adminProviderTelemetryErrorGroup');
    let newer = createGroup('serg_2', new Date('2026-06-18T00:00:00.000Z'));
    let older = createGroup('serg_1', new Date('2026-06-17T00:00:00.000Z'));
    db.sessionErrorGroup.findMany.mockResolvedValue([newer, older]);

    let result = await listAdminProviderTelemetryErrorGroups({
      providerId: 'slack',
      tenantId: 'ten_1',
      environmentIds: ['ken_1'],
      types: ['message_processing_provider_error'],
      range: { from, to },
      limit: 1,
      order: 'desc',
      after: 'serg_cursor'
    });

    expect(db.provider.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: 'slack' },
          { slug: 'slack' },
          { globalIdentifier: 'slack' },
          { listing: { id: 'slack' } },
          { listing: { slug: 'slack' } }
        ]
      }
    });

    expect(db.sessionErrorGroup.findMany).toHaveBeenCalledTimes(1);
    let query = db.sessionErrorGroup.findMany.mock.calls[0]![0];
    expect(query.take).toBe(3);
    expect(query.cursor).toEqual({ id: 'serg_cursor' });
    expect(query.skip).toBe(0);
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(query.where).toEqual({
      providerOid: 10n,
      tenantOid: { in: [20n] },
      environmentOid: { in: [30n] },
      type: { in: ['message_processing_provider_error'] },
      instances: {
        some: {
          createdAt: { gte: from, lte: to }
        }
      }
    });
    expect(query.include.sessionErrorGroupOccurrencePeriods).toEqual({
      where: { startsAt: { lte: to }, endsAt: { gte: from } },
      orderBy: { startsAt: 'asc' }
    });

    expect(result.pagination).toEqual({
      has_more_after: true,
      has_more_before: false
    });
  });

  it('returns the admin table row shape', async () => {
    let { listAdminProviderTelemetryErrorGroups } =
      await import('./adminProviderTelemetryErrorGroup');
    let createdAt = new Date('2026-06-18T00:00:00.000Z');
    db.sessionErrorGroup.findMany.mockResolvedValue([createGroup('serg_1', createdAt)]);

    let result = await listAdminProviderTelemetryErrorGroups({
      range: { from, to },
      limit: 25,
      order: 'desc'
    });

    expect(result).toEqual({
      object: 'list',
      items: [
        {
          object: 'admin.provider_error_group',
          id: 'serg_1',
          type: 'message_processing_provider_error',
          code: 'provider_error',
          message: 'Message serg_1',
          hash: 'hash-serg_1',
          occurrence_count: 3,
          provider: {
            id: 'prv_1',
            name: 'Slack',
            slug: 'slack'
          },
          first_occurrence_id: 'serr_1',
          first_session_id: 'ses_1',
          first_provider_run_id: 'prun_1',
          tenant_id: 'ten_1',
          environment_id: 'ken_1',
          periods: [
            {
              starts_at: from,
              ends_at: to,
              occurrence_count: 2
            }
          ],
          created_at: createdAt
        }
      ],
      pagination: {
        has_more_after: false,
        has_more_before: false
      }
    });
  });
});
