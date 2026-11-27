import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/queue', () => {
  class QueueRetryError extends Error {}

  return {
    QueueRetryError,
    createQueue: vi.fn(config => ({
      name: config.name,
      add: vi.fn(),
      process: vi.fn(handler => ({ handler }))
    }))
  };
});

vi.mock('@metorial-subspace/db', () => ({
  db: { publicMcpServer: { findUnique: vi.fn() } }
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { index: vi.fn(), delete: vi.fn() } },
  voyagerSource: Promise.resolve({ id: 'source-1' }),
  voyagerIndex: { publicMcpServer: { id: 'index-1' } }
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));

import { QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager } from '@metorial-subspace/module-search';
import { indexPublicMcpServerQueueProcessor } from './publicMcpServer';

let run = (publicMcpServerId: string) =>
  (indexPublicMcpServerQueueProcessor as any).handler({ publicMcpServerId });

let server = (status: string) => ({
  id: 'pmsv_1',
  status,
  slug: 'acme-crm',
  name: 'Acme CRM',
  description: 'Customer records',
  tenant: { id: 'ten_1' },
  provider: { id: 'pro_1', name: 'Salesforce' }
});

describe('indexPublicMcpServerQueueProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indexes name, slug, description, and provider name under the tenant', async () => {
    vi.mocked(db.publicMcpServer.findUnique).mockResolvedValue(server('active') as any);

    await run('pmsv_1');

    expect(voyager.record.index).toHaveBeenCalledWith({
      sourceId: 'source-1',
      indexId: 'index-1',
      documentId: 'pmsv_1',
      tenantIds: ['ten_1'],
      fields: { publicMcpServerId: 'pmsv_1', providerId: 'pro_1' },
      body: {
        name: 'Acme CRM',
        slug: 'acme-crm',
        description: 'Customer records',
        providerName: 'Salesforce'
      }
    });
  });

  it.each(['disabled', 'archived'])('keeps %s servers searchable', async status => {
    vi.mocked(db.publicMcpServer.findUnique).mockResolvedValue(server(status) as any);

    await run('pmsv_1');

    expect(voyager.record.index).toHaveBeenCalledTimes(1);
    expect(voyager.record.delete).not.toHaveBeenCalled();
  });

  it('removes deleted servers from the index', async () => {
    vi.mocked(db.publicMcpServer.findUnique).mockResolvedValue(server('deleted') as any);

    await run('pmsv_1');

    expect(voyager.record.delete).toHaveBeenCalledWith({
      sourceId: 'source-1',
      indexId: 'index-1',
      documentIds: ['pmsv_1']
    });
    expect(voyager.record.index).not.toHaveBeenCalled();
  });

  it('retries when the server is not visible yet', async () => {
    vi.mocked(db.publicMcpServer.findUnique).mockResolvedValue(null);

    await expect(run('pmsv_missing')).rejects.toBeInstanceOf(QueueRetryError);
    expect(voyager.record.index).not.toHaveBeenCalled();
  });
});
