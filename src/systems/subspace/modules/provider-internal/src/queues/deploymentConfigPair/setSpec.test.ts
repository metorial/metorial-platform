import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues: Record<string, any> = {};

let pairFindFirst = vi.fn();
let providerVersionFindFirst = vi.fn();
let pairVersionFindUnique = vi.fn();
let pairVersionUpsert = vi.fn();
let providerSpecificationFindFirst = vi.fn();
let providerVersionUpdate = vi.fn();

let db = {
  providerDeploymentConfigPair: {
    findFirst: pairFindFirst
  },
  providerVersion: {
    findFirst: providerVersionFindFirst,
    update: providerVersionUpdate
  },
  providerDeploymentConfigPairProviderVersion: {
    findUnique: pairVersionFindUnique,
    upsert: pairVersionUpsert,
    update: vi.fn()
  },
  providerSpecification: {
    findFirst: providerSpecificationFindFirst
  },
  providerDeploymentConfigPairSpecificationChange: {
    create: vi.fn()
  },
  providerSpecificationChangeNotification: {
    create: vi.fn()
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
  getId: (model: string) => ({ oid: 100n, id: `${model}_id` }),
  withTransaction: async (fn: (tx: typeof db) => Promise<unknown>) => await fn(db)
}));

vi.mock('@metorial-subspace/module-monitor/src/queues/schemaChange', () => ({
  schemaChangeNotificationAlertIngestQueue: { add: vi.fn() }
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

describe('providerDeploymentConfigPairSetSpecificationQueue', () => {
  beforeEach(() => {
    vi.resetModules();
    queues = {};
    pairFindFirst.mockReset();
    providerVersionFindFirst.mockReset();
    pairVersionFindUnique.mockReset();
    pairVersionUpsert.mockReset();
    providerSpecificationFindFirst.mockReset();
    providerVersionUpdate.mockReset();
  });

  it('preserves an existing pair specification when a refresh fails', async () => {
    await import('./setSpec');

    let pair = {
      oid: 1n,
      providerDeploymentVersion: {
        deployment: {
          providerVariantOid: 2n,
          tenantOid: 3n,
          environmentOid: 4n,
          solutionOid: 5
        }
      }
    };
    let version = {
      oid: 6n,
      providerVariantOid: 2n,
      previousVersionOid: null,
      specificationOid: 7n
    };
    let existingPairVersion = {
      oid: 8n,
      specificationOid: 9n,
      previousPairVersion: null
    };

    pairFindFirst.mockResolvedValue(pair);
    providerVersionFindFirst.mockResolvedValue(version);
    pairVersionFindUnique.mockResolvedValue(existingPairVersion);
    providerSpecificationFindFirst.mockResolvedValue({ oid: 7n, type: 'full' });
    pairVersionUpsert.mockImplementation(async ({ update }) => ({
      ...existingPairVersion,
      ...update,
      specification: { oid: existingPairVersion.specificationOid, type: 'full' }
    }));

    await queues['sub/pint/pdep/spec/set'].processor({
      providerDeploymentConfigPairOid: pair.oid,
      versionOid: version.oid,
      result: { status: 'failure', discoveryRecordOid: 10n }
    });

    expect(pairVersionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          specificationDiscoveryStatus: 'failed',
          specificationOid: existingPairVersion.specificationOid,
          latestDiscoveryRecordOid: 10n
        })
      })
    );
    expect(providerVersionUpdate).not.toHaveBeenCalled();
  });
});
