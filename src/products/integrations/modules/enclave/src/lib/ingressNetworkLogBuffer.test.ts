import { beforeEach, describe, expect, it, vi } from 'vitest';

let { hashes } = vi.hoisted(() => ({
  hashes: new Map<string, Map<string, string>>()
}));

vi.mock('bun', () => {
  let getHash = (key: string) => {
    let hash = hashes.get(key);
    if (!hash) {
      hash = new Map<string, string>();
      hashes.set(key, hash);
    }

    return hash;
  };

  return {
    RedisClient: class {
      async hget(key: string, field: string) {
        return hashes.get(key)?.get(field) ?? null;
      }

      async hset(key: string, field: string, value: string) {
        getHash(key).set(field, value);
        return 1;
      }

      async hincrby(key: string, field: string, amount: number) {
        let next = Number(hashes.get(key)?.get(field) ?? 0) + amount;
        getHash(key).set(field, `${next}`);
        return next;
      }

      async hkeys(key: string) {
        return [...(hashes.get(key)?.keys() ?? [])];
      }

      async hdel(key: string, field: string) {
        hashes.get(key)?.delete(field);
        return 1;
      }

      async exists(key: string) {
        return (hashes.get(key)?.size ?? 0) > 0;
      }

      async rename(from: string, to: string) {
        let hash = hashes.get(from);
        if (hash) {
          hashes.set(to, hash);
          hashes.delete(from);
        }

        return 'OK';
      }

      async expire() {
        return 1;
      }
    }
  };
});

import {
  flushBufferedIngressNetworkLogsToRedis,
  getIngressNetworkLogSnapshotEntry,
  recordIngressNetworkLog,
  snapshotPendingIngressNetworkLogs
} from './ingressNetworkLogBuffer';

process.env.REDIS_URL = 'redis://localhost:6379';

let seenAt = new Date('2026-01-01T00:10:00.000Z');

type RecordParams = Parameters<typeof recordIngressNetworkLog>[0];

let record = (overrides: Partial<RecordParams> = {}) =>
  recordIngressNetworkLog({
    tenantOid: BigInt(10),
    projectOid: BigInt(11),
    environmentOid: BigInt(20),
    instanceOid: BigInt(21),
    solutionOid: 30,
    enclaveOid: BigInt(40),
    sessionId: 'ses_test',
    sourceIp: '203.0.113.10',
    hostname: 'mcp.example.com',
    port: 443,
    result: 'denied',
    at: seenAt,
    ...overrides
  });

let drainSnapshot = async () => {
  await flushBufferedIngressNetworkLogsToRedis();

  let snapshot = await snapshotPendingIngressNetworkLogs();
  if (!snapshot) return [];

  return Promise.all(
    snapshot.fields.map(field =>
      getIngressNetworkLogSnapshotEntry({ snapshotId: snapshot.snapshotId, field })
    )
  );
};

describe('ingressNetworkLogBuffer', () => {
  beforeEach(() => {
    hashes.clear();
  });

  it('carries the mirrored project and instance oids through to the snapshot entry', async () => {
    record();

    let entries = await drainSnapshot();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      tenantOid: BigInt(10),
      projectOid: BigInt(11),
      environmentOid: BigInt(20),
      instanceOid: BigInt(21),
      count: 1
    });
  });

  it('keeps the mirrored oids null for an unlinked tenant and environment', async () => {
    record({ projectOid: null, instanceOid: null });

    let entries = await drainSnapshot();

    expect(entries[0]).toMatchObject({
      tenantOid: BigInt(10),
      projectOid: null,
      environmentOid: BigInt(20),
      instanceOid: null
    });
  });

  it('preserves the mirrored oids when rows merge into the same bucket', async () => {
    record();
    record({ at: new Date('2026-01-01T00:20:00.000Z') });

    let entries = await drainSnapshot();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      projectOid: BigInt(11),
      instanceOid: BigInt(21),
      count: 2
    });
  });
});
