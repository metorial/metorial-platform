import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/delay', () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

vi.mock('../env', () => ({
  env: {
    db: {
      USAGE_MONGO_URL: 'mongodb://localhost:27017/test'
    }
  }
}));

let { mockUpdateOne, mockConnect } = vi.hoisted(() => ({
  mockUpdateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  mockConnect: vi.fn().mockResolvedValue({})
}));

vi.mock('mongoose', () => {
  let mockSchema = vi.fn(function (this: any) {
    this.index = vi.fn();
    return this;
  });
  (mockSchema as any).Types = { Mixed: 'Mixed' };

  return {
    default: {
      Schema: mockSchema,
      model: vi.fn(() => ({
        updateOne: mockUpdateOne
      })),
      connect: mockConnect
    }
  };
});

import { AuditEventSchema, ingestAuditEvent } from './auditEvent';

describe('audit models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateOne.mockResolvedValue({ acknowledged: true });
  });

  it('defines an AuditEvent schema', () => {
    expect(AuditEventSchema).toBeDefined();
  });

  it('upserts an audit event with bigint fields converted to strings', async () => {
    await ingestAuditEvent({
      id: 'event-1',
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

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'event-1' },
      {
        $setOnInsert: {
          _id: 'event-1',
          resourceTenantOid: '1',
          resourceGroupOid: '2',
          resourceActorOid: '3',
          context: { ip: '127.0.0.1', ua: 'test' },
          resource: 'organization',
          action: 'create',
          payload: { oid: '4', name: 'Acme' },
          previousAttributes: { name: 'Old' },
          recordedAt: new Date('2026-08-12T10:00:00.000Z')
        }
      },
      { upsert: true }
    );
  });
});
