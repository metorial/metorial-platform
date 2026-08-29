import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/audit-models', () => ({
  deleteAuditEventsBefore: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => ({ handler }))
}));

vi.mock('@metorial/db', () => {
  let db = {
    organization: { findMany: vi.fn(), findUnique: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    event: { deleteMany: vi.fn() }
  };
  return {
    db,
    withTransaction: vi.fn(async callback => callback(db))
  };
});

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  QueueRetryError: class QueueRetryError extends Error {}
}));

import { deleteAuditEventsBefore } from '@metorial/audit-models';
import { db } from '@metorial/db';
import {
  cleanupAuditLogOrganizationsQueue,
  cleanupAuditLogOrganizationsQueueProcessor,
  cleanupOrganizationAuditLogsQueue,
  cleanupOrganizationAuditLogsQueueProcessor
} from './cleanup';

describe('audit log cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T00:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('fans out only initialized organizations', async () => {
    vi.mocked(db.organization.findMany).mockResolvedValue([
      { id: 'org-1' },
      { id: 'org-2' }
    ] as any);

    await (cleanupAuditLogOrganizationsQueueProcessor as any).handler({});

    expect(db.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ auditLogRetentionInDays: { not: null } })
      })
    );
    expect(cleanupOrganizationAuditLogsQueue.addMany).toHaveBeenCalledWith([
      { organizationId: 'org-1' },
      { organizationId: 'org-2' }
    ]);
    expect(cleanupAuditLogOrganizationsQueue.add).toHaveBeenCalledWith({
      cursor: 'org-2'
    });
  });

  it('deletes expired Postgres indexes and Mongo payloads for one organization', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      oid: 10n,
      auditLogRetentionInDays: 30
    } as any);

    await (cleanupOrganizationAuditLogsQueueProcessor as any).handler({
      organizationId: 'org-1'
    });

    let recordedAt = new Date('2026-07-29T00:00:00.000Z');
    let where = { organizationOid: 10n, recordedAt: { lt: recordedAt } };
    expect(db.auditLog.deleteMany).toHaveBeenCalledWith({ where });
    expect(db.event.deleteMany).toHaveBeenCalledWith({ where });
    expect(deleteAuditEventsBefore).toHaveBeenCalledWith({
      organizationOid: 10n,
      recordedAt
    });
  });

  it('skips organizations awaiting reconciliation', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      oid: 10n,
      auditLogRetentionInDays: null
    } as any);

    await (cleanupOrganizationAuditLogsQueueProcessor as any).handler({
      organizationId: 'org-1'
    });

    expect(db.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(deleteAuditEventsBefore).not.toHaveBeenCalled();
  });
});
