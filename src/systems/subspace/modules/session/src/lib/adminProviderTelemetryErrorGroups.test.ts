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

describe('createAdminProviderTelemetryErrorGroupsPaginator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.provider.findFirstOrThrow.mockResolvedValue({ oid: 10n });
    db.tenant.findMany.mockResolvedValue([{ id: 'ten_1', oid: 20n }]);
    db.environment.findMany.mockResolvedValue([{ id: 'ken_1', oid: 30n }]);
  });

  it('preserves admin Error Groups query filters, ordering, and pagination input', async () => {
    let { createAdminProviderTelemetryErrorGroupsPaginator } =
      await import('./adminProviderTelemetryErrorGroups');
    db.sessionErrorGroup.findMany.mockResolvedValue([{ id: 'serg_2' }, { id: 'serg_1' }]);

    let input = {
      providerId: 'slack',
      tenantId: 'ten_1',
      environmentIds: ['ken_1'],
      types: ['message_processing_provider_error' as const],
      range: { from, to },
      limit: 1,
      order: 'desc' as const,
      after: 'serg_cursor'
    };
    let paginator = await createAdminProviderTelemetryErrorGroupsPaginator(input);
    let result = await paginator.run(input);

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
    expect(result.pagination).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: false
    });
  });

  it('returns an empty paginator when filter normalization resolves to no scope', async () => {
    let { createAdminProviderTelemetryErrorGroupsPaginator } =
      await import('./adminProviderTelemetryErrorGroups');

    let paginator = await createAdminProviderTelemetryErrorGroupsPaginator({
      tenantIds: [],
      range: { from, to },
      limit: 25,
      order: 'desc'
    });
    let result = await paginator.run({ limit: 25, order: 'desc' });

    expect(db.sessionErrorGroup.findMany).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.pagination).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: false
    });
  });
});
