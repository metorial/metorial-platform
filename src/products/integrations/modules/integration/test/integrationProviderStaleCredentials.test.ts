import { beforeEach, describe, expect, it, vi } from 'vitest';

let { processors, queues, db, resolveUsableMaterialMock } = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();
  let queues = new Map<string, { add: any; addManyWithOps: any }>();

  return {
    processors,
    queues,
    db: {
      integrationProvider: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      }
    },
    resolveUsableMaterialMock: vi.fn()
  };
});

vi.mock('@lowerdeck/cron', () => ({
  createCron: vi.fn(() => ({ name: 'cron' }))
}));

vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn((items: unknown[]) => items),
  hourlyPacedDelay: vi.fn(() => ({ delay: 1000 })),
  createQueue: vi.fn((config: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: vi.fn((handler: (data: any) => Promise<void>) => {
        processors.set(config.name, handler);
        return { name: config.name };
      })
    };
    queues.set(config.name, queue);
    return queue;
  })
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

vi.mock('../src/env', () => ({
  env: { service: { REDIS_URL: 'redis://test' } }
}));

vi.mock('../src/services/integrationProvider', () => ({
  integrationProviderService: {
    resolveUsableIntegrationProviderMaterialInternal: resolveUsableMaterialMock
  }
}));

import { ServiceError, preconditionFailedError } from '@lowerdeck/error';
import '../src/queues/lifecycle/integrationProviderStaleCredentials';

let MANY = 'sub/int/lc/integrationProvider/staleCredentials/many';
let SINGLE = 'sub/int/lc/integrationProvider/staleCredentials/single';

describe('integration provider stale credentials sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans out active providers whose current credentials were archived', async () => {
    db.integrationProvider.findMany.mockResolvedValue([{ id: 'ipr_1' }, { id: 'ipr_2' }]);

    await processors.get(MANY)!({});

    expect(db.integrationProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          currentVersion: {
            authCredentials: { status: { in: ['archived', 'deleted'] } }
          }
        }),
        select: { id: true }
      })
    );
    expect(queues.get(SINGLE)!.addManyWithOps).toHaveBeenCalledWith([
      { data: { integrationProviderId: 'ipr_1' }, opts: { id: 'stale-credentials-ipr_1' } },
      { data: { integrationProviderId: 'ipr_2' }, opts: { id: 'stale-credentials-ipr_2' } }
    ]);
    expect(queues.get(MANY)!.add).not.toHaveBeenCalled();
  });

  it('continues from the cursor when a full page was returned', async () => {
    db.integrationProvider.findMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({ id: `ipr_${String(i).padStart(3, '0')}` }))
    );

    await processors.get(MANY)!({});

    expect(queues.get(MANY)!.add).toHaveBeenCalledWith(
      { cursor: 'ipr_499' },
      expect.anything()
    );
  });

  it('repoints a single provider through the healing service', async () => {
    let provider = {
      id: 'ipr_1',
      status: 'active',
      tenant: { oid: 1n },
      environment: { oid: 2n }
    };
    db.integrationProvider.findUnique.mockResolvedValue(provider);
    resolveUsableMaterialMock.mockResolvedValue({ isHealed: true });

    await processors.get(SINGLE)!({ integrationProviderId: 'ipr_1' });

    expect(resolveUsableMaterialMock).toHaveBeenCalledWith({
      tenant: provider.tenant,
      environment: provider.environment,
      integrationProvider: provider
    });
  });

  it('does not retry providers that have no replacement credentials', async () => {
    db.integrationProvider.findUnique.mockResolvedValue({
      id: 'ipr_1',
      status: 'active',
      tenant: { oid: 1n },
      environment: { oid: 2n }
    });
    resolveUsableMaterialMock.mockRejectedValue(
      new ServiceError(
        preconditionFailedError({
          code: 'integration_provider_credentials_unavailable',
          message: 'unavailable'
        })
      )
    );

    await expect(
      processors.get(SINGLE)!({ integrationProviderId: 'ipr_1' })
    ).resolves.toBeUndefined();
  });

  it('skips providers that are no longer active', async () => {
    db.integrationProvider.findUnique.mockResolvedValue({ id: 'ipr_1', status: 'archived' });

    await processors.get(SINGLE)!({ integrationProviderId: 'ipr_1' });

    expect(resolveUsableMaterialMock).not.toHaveBeenCalled();
  });
});
