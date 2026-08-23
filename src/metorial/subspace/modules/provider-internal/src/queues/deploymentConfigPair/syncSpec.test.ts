import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues: Record<string, any> = {};

let pairFindFirst = vi.fn();
let providerVersionFindFirstOrThrow = vi.fn();
let pairVersionFindUnique = vi.fn();
let providerToolCount = vi.fn();
let discoveryCreate = vi.fn();
let getBackend = vi.fn();
let ensureProviderSpecification = vi.fn();
let pairSetSpecificationAdd = vi.fn();

let db = {
  providerDeploymentConfigPair: {
    findFirst: pairFindFirst
  },
  providerVersion: {
    findFirstOrThrow: providerVersionFindFirstOrThrow
  },
  providerDeploymentConfigPairProviderVersion: {
    findUnique: pairVersionFindUnique
  },
  providerTool: {
    count: providerToolCount
  },
  providerDeploymentConfigPairDiscovery: {
    create: discoveryCreate
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
  db,
  getId: (model: string) => ({ oid: 100n, id: `${model}_id` })
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
  providerDeploymentConfigPairSetSpecificationQueue: {
    add: pairSetSpecificationAdd
  }
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

describe('providerDeploymentConfigPairSyncSpecificationQueue', () => {
  beforeEach(() => {
    vi.resetModules();
    queues = {};
    pairFindFirst.mockReset();
    providerVersionFindFirstOrThrow.mockReset();
    pairVersionFindUnique.mockReset();
    providerToolCount.mockReset();
    discoveryCreate.mockReset();
    getBackend.mockReset();
    ensureProviderSpecification.mockReset();
    pairSetSpecificationAdd.mockReset();
  });

  it('does not promote an empty remote discovery over an existing non-empty pair spec', async () => {
    await import('./syncSpec');

    let pair = {
      oid: 1n,
      id: 'pair_1',
      tenant: { oid: 2n },
      providerConfigVersion: { oid: 3n },
      providerAuthConfigVersion: null,
      providerDeploymentVersion: {
        oid: 4n,
        deployment: {
          provider: { id: 'provider_1' },
          providerVariant: { id: 'provider_variant_1' }
        }
      }
    };
    let version = {
      oid: 5n,
      id: 'provider_version_1',
      specification: { oid: 6n, type: 'full' },
      shuttleServer: { type: 'remote' }
    };
    let existingPairVersion = {
      oid: 7n,
      specificationOid: 8n
    };
    let backend = {
      capabilities: {
        getConnectionSpecificationBehavior: vi.fn().mockResolvedValue({
          discoverPerConnection: true,
          mergeDiscoveredToolsIntoVersionSpecification: true,
          preserveExistingSpecificationOnEmptyDiscovery: true
        }),
        getSpecificationForProviderPair: vi.fn().mockResolvedValue({
          status: 'success',
          type: 'full',
          specification: { specId: 'empty', key: 'remote', name: 'Remote' },
          authMethods: [],
          features: { supportsAuthMethod: false, configContainsAuth: true },
          tools: [],
          triggers: []
        })
      }
    };

    pairFindFirst.mockResolvedValue(pair);
    providerVersionFindFirstOrThrow.mockResolvedValue(version);
    pairVersionFindUnique.mockResolvedValue(existingPairVersion);
    providerToolCount.mockResolvedValue(1);
    discoveryCreate.mockResolvedValue({ oid: 9n });
    getBackend.mockResolvedValue(backend);

    await queues['sub/pint/pdep/spec/sync'].processor({
      providerDeploymentConfigPairId: pair.id,
      versionId: version.id
    });

    expect(ensureProviderSpecification).not.toHaveBeenCalled();
    expect(discoveryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'succeeded_with_warnings',
        warnings: [
          expect.objectContaining({
            code: 'empty_tools_discovery_result'
          })
        ]
      })
    });
    expect(pairSetSpecificationAdd).toHaveBeenCalledWith({
      providerDeploymentConfigPairOid: pair.oid,
      versionOid: version.oid,
      result: { status: 'failure', discoveryRecordOid: 9n }
    });
  });
});
