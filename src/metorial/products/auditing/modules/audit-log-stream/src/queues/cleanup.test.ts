import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { deleteRuns } = vi.hoisted(() => ({
  deleteRuns: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => ({ handler }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    auditLogStreamRun: {
      deleteMany: deleteRuns
    }
  }
}));

import { cleanupAuditLogStreamRunsCron } from './cleanup';

describe('audit log stream run cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));
    deleteRuns.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retains errors for fourteen days and other runs for one day', async () => {
    await (cleanupAuditLogStreamRunsCron as any).handler();

    expect(deleteRuns).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            status: { not: 'error' },
            createdAt: { lt: new Date('2026-08-14T00:00:00.000Z') }
          },
          {
            status: 'error',
            createdAt: { lt: new Date('2026-08-01T00:00:00.000Z') }
          }
        ]
      }
    });
  });
});
