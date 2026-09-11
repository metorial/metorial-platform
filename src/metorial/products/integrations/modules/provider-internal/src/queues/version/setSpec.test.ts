import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues: Record<string, any> = {};

let providerVersionFindFirst = vi.fn();
let providerVersionUpdate = vi.fn();
let providerAuthConfigUpdateMany = vi.fn();
let providerAuthCredentialsUpdateMany = vi.fn();

let db = {
  providerVersion: {
    findFirst: providerVersionFindFirst,
    update: providerVersionUpdate
  },
  providerAuthConfig: {
    updateMany: providerAuthConfigUpdateMany
  },
  providerAuthCredentials: {
    updateMany: providerAuthCredentialsUpdateMany
  },
  providerVersionSpecificationChange: {
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
  getId: (model: string) => ({ oid: 100n, id: `${model}_id` })
}));

vi.mock('@metorial-subspace/module-monitor/src/queues/schemaChange', () => ({
  schemaChangeNotificationAlertIngestQueue: { add: vi.fn() }
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

describe('providerVersionSetSpecificationQueue', () => {
  beforeEach(() => {
    vi.resetModules();
    queues = {};
    providerVersionFindFirst.mockReset();
    providerVersionUpdate.mockReset();
    providerAuthConfigUpdateMany.mockReset();
    providerAuthCredentialsUpdateMany.mockReset();
  });

  for (let status of ['not_discoverable', 'waiting_for_pair'] as const) {
    it(`preserves the existing specification when status becomes ${status}`, async () => {
      await import('./setSpec');

      let version = {
        oid: 1n,
        id: 'provider_version_1',
        providerOid: 2n,
        specificationOid: 3n,
        previousVersionOid: null
      };
      providerVersionFindFirst.mockResolvedValue(version);
      providerVersionUpdate.mockImplementation(async ({ data }) => ({ ...version, ...data }));

      await queues['sub/pint/pver/spec/set'].processor({
        versionOid: version.oid,
        result: { status }
      });

      expect(providerVersionUpdate).toHaveBeenCalledWith({
        where: { oid: version.oid },
        data: {
          specificationDiscoveryStatus: status,
          specificationOid: version.specificationOid
        }
      });
      expect(providerAuthConfigUpdateMany).not.toHaveBeenCalled();
      expect(providerAuthCredentialsUpdateMany).not.toHaveBeenCalled();
    });
  }
});
