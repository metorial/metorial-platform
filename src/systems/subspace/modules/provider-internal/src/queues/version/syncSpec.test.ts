import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues: Record<string, any> = {};

let providerVersionFindFirst = vi.fn();
let providerToolCount = vi.fn();
let getBackend = vi.fn();
let ensureProviderSpecification = vi.fn();
let providerVersionSetSpecificationAdd = vi.fn();

let db = {
  providerVersion: {
    findFirst: providerVersionFindFirst
  },
  providerTool: {
    count: providerToolCount
  }
};

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: (opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      process: vi.fn((processor: unknown) => {
        queue.processor = processor;
        return { name: opts.name };
      }),
      processor: undefined as unknown
    };
    queues[opts.name] = queue;
    return queue;
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend
}));

vi.mock('../../services/providerSpecification', () => ({
  providerSpecificationInternalService: {
    ensureProviderSpecification
  }
}));

vi.mock('./setSpec', () => ({
  providerVersionSetSpecificationQueue: {
    add: providerVersionSetSpecificationAdd
  }
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

describe('providerVersionSyncSpecificationQueue', () => {
  beforeEach(() => {
    vi.resetModules();
    queues = {};
    providerVersionFindFirst.mockReset();
    providerToolCount.mockReset();
    getBackend.mockReset();
    ensureProviderSpecification.mockReset();
    providerVersionSetSpecificationAdd.mockReset();
  });

  it('does not replace an existing full spec with a preliminary version spec', async () => {
    await import('./syncSpec');

    let version = {
      oid: 1n,
      id: 'provider_version_1',
      specificationOid: 2n,
      specification: { oid: 2n, type: 'full' },
      provider: {
        id: 'provider_1',
        ownerTenant: null
      },
      providerVariant: { id: 'provider_variant_1' },
      shuttleServer: { type: 'remote' }
    };
    let backend = {
      capabilities: {
        getSpecificationBehavior: vi.fn().mockResolvedValue({
          supportsVersionSpecification: true,
          supportsDeploymentSpecification: true
        }),
        getSpecificationForProviderVersion: vi.fn().mockResolvedValue({
          status: 'success',
          type: 'preliminary',
          specification: { specId: 'preliminary', key: 'remote', name: 'Remote' },
          authMethods: [],
          features: { supportsAuthMethod: false, configContainsAuth: true },
          tools: [],
          triggers: []
        })
      }
    };

    providerVersionFindFirst.mockResolvedValue(version);
    getBackend.mockResolvedValue(backend);

    await queues['sub/pint/pver/spec/sync'].processor({
      providerVersionId: version.id
    });

    expect(ensureProviderSpecification).not.toHaveBeenCalled();
    expect(providerVersionSetSpecificationAdd).not.toHaveBeenCalled();
  });
});
