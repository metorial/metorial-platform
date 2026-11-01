import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestAuditEventsToPostgres } from './ingestPostgres';

let mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  findMany: vi.fn(),
  dirty: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  Prisma: { DbNull: 'DB_NULL' },
  withTransaction: mocks.transaction
}));

let event = {
  id: 'audit-event',
  organizationOid: 1n,
  resource: 'organization',
  action: 'update',
  context: { ip: '127.0.0.1' },
  payload: { name: 'raw' },
  recordedAt: new Date()
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async run =>
    run({
      auditLog: { findMany: mocks.findMany, createMany: mocks.createMany },
      auditLogDirtyTracker: { upsert: mocks.dirty }
    })
  );
});

describe('on-prem audit payload persistence', () => {
  it('stores presented payloads and diffs alongside metadata in one transaction', async () => {
    await ingestAuditEventsToPostgres(
      [event],
      [
        {
          id: event.id,
          payload: { name: 'presented', value: 12n },
          previousAttributes: { name: 'before' }
        }
      ]
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          id: event.id,
          organizationOid: 1n,
          payload: { name: 'presented', value: '12' },
          previousAttributes: { name: 'before' }
        })
      ]
    });
  });

  it('does not overwrite payloads on replay', async () => {
    mocks.findMany.mockResolvedValue([{ id: event.id }]);
    await ingestAuditEventsToPostgres([event], [{ id: event.id, payload: { name: 'later' } }]);
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.dirty).not.toHaveBeenCalled();
  });

  it('propagates persistence failures so the queue retains its claim', async () => {
    mocks.createMany.mockRejectedValue(new Error('Postgres unavailable'));
    await expect(
      ingestAuditEventsToPostgres([event], [{ id: event.id, payload: {} }])
    ).rejects.toThrow('Postgres unavailable');
    expect(mocks.dirty).not.toHaveBeenCalled();
  });
});
