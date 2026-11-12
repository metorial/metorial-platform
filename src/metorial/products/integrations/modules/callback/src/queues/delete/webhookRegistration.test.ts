import { subDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, deleteWebhookRegistration, processor } = vi.hoisted(() => ({
  db: { webhookRegistration: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() } },
  deleteWebhookRegistration: vi.fn(),
  processor: {
    fn: null as ((data: { webhookRegistrationId: string }) => Promise<void>) | null
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial-subspace/provider', () => ({
  getBackend: async () => ({ callbacks: { deleteWebhookRegistration } })
}));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost' } } }));
vi.mock('@lowerdeck/cron', () => ({ createCron: vi.fn(() => ({})) }));
vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn(() => ({})),
  dailyPacedDelay: vi.fn(),
  createQueue: vi.fn((opts: { name: string }) => ({
    add: vi.fn(),
    addMany: vi.fn(),
    process: (fn: (data: { webhookRegistrationId: string }) => Promise<void>) => {
      if (opts.name === 'sub/cb/delete/webhookRegistration') processor.fn = fn;
      return {};
    }
  }))
}));

await import('./webhookRegistration');

let run = () => processor.fn!({ webhookRegistrationId: 'whr_1' });

let registration = (overrides: Record<string, unknown> = {}) => ({
  oid: BigInt(100),
  id: 'whr_1',
  status: 'archived',
  archivedAt: new Date(),
  tenant: { oid: BigInt(1) },
  providerVariant: { oid: BigInt(8), backendOid: BigInt(9) },
  ...overrides
});

describe('webhookRegistrationDeleteQueueProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteWebhookRegistration.mockResolvedValue({});
  });

  it('removes the backend registration of a just archived record and keeps the record', async () => {
    let archived = registration();
    db.webhookRegistration.findUnique.mockResolvedValue(archived);

    await run();

    expect(deleteWebhookRegistration).toHaveBeenCalledWith({
      tenant: archived.tenant,
      webhookRegistration: archived
    });
    expect(db.webhookRegistration.update).not.toHaveBeenCalled();
  });

  it('marks the record deleted once the retention period is over', async () => {
    db.webhookRegistration.findUnique.mockResolvedValue(
      registration({ archivedAt: subDays(new Date(), 15) })
    );

    await run();

    expect(deleteWebhookRegistration).toHaveBeenCalledTimes(1);
    expect(db.webhookRegistration.update).toHaveBeenCalledWith({
      where: { oid: BigInt(100) },
      data: { status: 'deleted' }
    });
  });

  it('fails the job so the queue retries when the backend call fails', async () => {
    db.webhookRegistration.findUnique.mockResolvedValue(
      registration({ archivedAt: subDays(new Date(), 15) })
    );
    deleteWebhookRegistration.mockRejectedValue(new Error('hub unavailable'));

    await expect(run()).rejects.toThrow('hub unavailable');

    expect(db.webhookRegistration.update).not.toHaveBeenCalled();
  });

  it('does nothing for a record that is gone or already deleted', async () => {
    db.webhookRegistration.findUnique.mockResolvedValue(null);
    await run();

    db.webhookRegistration.findUnique.mockResolvedValue(registration({ status: 'deleted' }));
    await run();

    expect(deleteWebhookRegistration).not.toHaveBeenCalled();
    expect(db.webhookRegistration.update).not.toHaveBeenCalled();
  });
});
