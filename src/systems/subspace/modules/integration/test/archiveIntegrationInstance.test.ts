import { db } from '@metorial-subspace/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveIntegrationInstanceQueueProcessor } from '../src/queues/lifecycle/archiveIntegrationInstance';
import { runIntegrationInstanceArchivedEffects } from '../src/queues/lifecycle/integrationInstance';

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    process: (handler: unknown) => handler
  }))
}));

vi.mock('../src/env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://example'
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    integrationInstance: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('../src/queues/lifecycle/integrationInstance', () => ({
  runIntegrationInstanceArchivedEffects: vi.fn()
}));

let mockedDb = db as unknown as {
  integrationInstance: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

let mockedRunIntegrationInstanceArchivedEffects =
  runIntegrationInstanceArchivedEffects as ReturnType<typeof vi.fn>;

describe('archive integration instance queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives draft instances so parent cleanup can finish', async () => {
    mockedDb.integrationInstance.findUnique.mockResolvedValue({
      id: 'ii_1',
      oid: 1n,
      status: 'draft'
    });
    mockedDb.integrationInstance.update.mockResolvedValue({
      id: 'ii_1',
      oid: 1n,
      status: 'archived'
    });

    await archiveIntegrationInstanceQueueProcessor({
      integrationInstanceId: 'ii_1'
    });

    expect(mockedDb.integrationInstance.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        status: 'archived',
        archivedAt: expect.any(Date)
      }
    });
    expect(mockedRunIntegrationInstanceArchivedEffects).toHaveBeenCalledWith({
      integrationInstanceId: 'ii_1',
      integrationInstanceOid: 1n,
      archivedAt: expect.any(Date)
    });
  });
});
