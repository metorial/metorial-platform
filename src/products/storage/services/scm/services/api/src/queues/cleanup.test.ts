import { subDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => ({
  rows: [] as Record<string, any>[],
  webhookEvents: { deleteMany: vi.fn() }
}));

let matches = (row: Record<string, any>, where: Record<string, any>): boolean =>
  Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some((branch: any) => matches(row, branch));
    if (key === 'supersededBySync') {
      let target = h.rows.find(other => other.oid === row.supersededBySyncOid);
      return !!target && matches(target, condition.is);
    }

    let value = row[key];
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
      return value === condition;
    }
    if ('lt' in condition && !(value < condition.lt)) return false;
    if ('lte' in condition && !(value <= condition.lte)) return false;
    if ('gt' in condition && !(value > condition.gt)) return false;
    if ('in' in condition && !condition.in.includes(value)) return false;
    if ('notIn' in condition && condition.notIn.includes(value)) return false;
    if ('not' in condition && value === condition.not) return false;
    return true;
  });

let find = (where: Record<string, any>, orderBy: any = { oid: 'desc' }) => {
  let order = ([] as Record<string, string>[])
    .concat(orderBy)
    .flatMap(entry => Object.entries(entry));
  return h.rows
    .filter(row => matches(row, where))
    .sort((a, b) => {
      for (let [key, direction] of order) {
        let sign = direction === 'asc' ? 1 : -1;
        if (a[key] < b[key]) return -sign;
        if (a[key] > b[key]) return sign;
      }
      return 0;
    });
};

vi.mock('../db', () => ({
  db: {
    scmRepositoryWebhookReceivedEvent: h.webhookEvents,
    scmRepositorySync: {
      findMany: vi.fn(async ({ where, orderBy, take }: any) =>
        find(where, orderBy).slice(0, take ?? Infinity)
      ),
      findFirst: vi.fn(async ({ where, orderBy }: any) => find(where, orderBy)[0] ?? null),
      groupBy: vi.fn(async ({ by, where }: any) => {
        let groups = new Map<string, any>();
        for (let row of find(where)) {
          let key = by.map((field: string) => String(row[field])).join(':');
          let group = groups.get(key);
          if (!group) {
            groups.set(key, {
              ...Object.fromEntries(by.map((field: string) => [field, row[field]])),
              _max: { oid: row.oid }
            });
          } else if (row.oid > group._max.oid) {
            group._max.oid = row.oid;
          }
        }
        return [...groups.values()];
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        let deleted = h.rows.filter(row => matches(row, where));
        h.rows = h.rows.filter(row => !deleted.includes(row));
        for (let row of h.rows) {
          if (deleted.some(d => d.oid === row.continuedFromSyncOid))
            row.continuedFromSyncOid = null;
          if (deleted.some(d => d.oid === row.supersededBySyncOid))
            row.supersededBySyncOid = null;
        }
        return { count: deleted.length };
      })
    }
  }
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_opts: unknown, run: () => Promise<void>) => run
}));

import { db } from '../db';
import { cleanupProcessor, getRetainedRepositorySyncOids } from './cleanup';

let old = subDays(new Date(), 30);
let recent = subDays(new Date(), 1);

let addSync = (oid: number, overrides: Record<string, unknown> = {}) => {
  let row = {
    oid: BigInt(oid),
    sourceType: 'manifest',
    repositoryAccessMode: 'pull_request',
    repoOid: 1n,
    sourceKey: 'listing:1',
    baseBranch: 'main',
    status: 'cancelled',
    baseCommitSha: 'base',
    providerPrId: null,
    continuedFromSyncOid: null,
    supersededBySyncOid: null,
    createdAt: old,
    ...overrides
  } as Record<string, any>;
  h.rows.push(row);
  return row;
};

let runCleanup = () => (cleanupProcessor as unknown as () => Promise<void>)();
let remaining = () => h.rows.map(row => Number(row.oid)).sort((a, b) => a - b);

beforeEach(() => {
  h.rows = [];
  vi.clearAllMocks();
});

describe('repository sync retention', () => {
  it('keeps the head of a lane whose PR is still open and drops its superseded chain', async () => {
    addSync(1, { status: 'cancelled', providerPrId: '10', supersededBySyncOid: 2n });
    addSync(2, {
      status: 'cancelled',
      providerPrId: '10',
      continuedFromSyncOid: 1n,
      supersededBySyncOid: 3n
    });
    let head = addSync(3, {
      status: 'complete_unmerged',
      providerPrId: '10',
      continuedFromSyncOid: 2n
    });

    await runCleanup();

    expect(remaining()).toEqual([3]);
    expect(head.continuedFromSyncOid).toBeNull();
  });

  it('keeps a lane head that holds a branch without a PR', async () => {
    addSync(1, { status: 'cancelled' });

    await expect(getRetainedRepositorySyncOids(h.rows as any)).resolves.toEqual(new Set([1n]));
  });

  it('keeps old syncs that are still in flight', async () => {
    addSync(1, { status: 'waiting_for_review', providerPrId: '10' });
    addSync(2, { status: 'pending', baseCommitSha: null, sourceKey: 'listing:2' });
    addSync(3, {
      status: 'syncing_contents',
      sourceType: 'code_bucket',
      repositoryAccessMode: 'direct_push'
    });

    await runCleanup();

    expect(remaining()).toEqual([1, 2]);
  });

  it('keeps a superseded PR until its successor has replaced it', async () => {
    addSync(1, { status: 'cancelled', providerPrId: '10', supersededBySyncOid: 2n });
    addSync(2, { status: 'creating_pr', createdAt: recent, continuedFromSyncOid: 1n });

    await runCleanup();
    expect(remaining()).toEqual([1, 2]);

    h.rows[1]!.status = 'waiting_for_review';
    h.rows[1]!.providerPrId = '11';
    await runCleanup();
    expect(remaining()).toEqual([1, 2]);

    h.rows[1]!.status = 'merged';
    await runCleanup();
    expect(remaining()).toEqual([2]);
  });

  it('drops an old head once a newer sync has adopted the lane', async () => {
    addSync(1, { status: 'cancelled', providerPrId: '10', supersededBySyncOid: 2n });
    addSync(2, { status: 'complete_unmerged', createdAt: recent, continuedFromSyncOid: 1n });

    await runCleanup();

    expect(remaining()).toEqual([2]);
  });

  it('keeps an old head while the newer sync has not claimed its branch yet', async () => {
    addSync(1, { status: 'cancelled', providerPrId: '10' });
    addSync(2, { status: 'pending', baseCommitSha: null, createdAt: recent });

    await runCleanup();

    expect(remaining()).toEqual([1, 2]);
  });

  it('drops lanes that already ended on a fresh base and keeps lanes apart', async () => {
    addSync(1, { status: 'merged', providerPrId: '10' });
    addSync(2, { status: 'complete_no_changes', baseBranch: 'release' });
    addSync(3, { status: 'cancelled', sourceKey: 'listing:2' });

    await runCleanup();

    expect(remaining()).toEqual([3]);
  });

  it('still deletes old code bucket and direct push syncs', async () => {
    addSync(1, { status: 'failed', sourceType: 'code_bucket', baseCommitSha: null });
    addSync(2, { status: 'complete_direct_push', repositoryAccessMode: 'direct_push' });
    addSync(3, { status: 'failed', createdAt: recent });

    await runCleanup();

    expect(remaining()).toEqual([3]);
  });

  it('walks expired syncs in pages with one lane lookup per page', async () => {
    for (let oid = 1; oid <= 1_200; oid++) {
      addSync(oid, { status: 'cancelled', sourceKey: `listing:${oid % 3}` });
    }
    addSync(1_201, { status: 'failed', createdAt: recent, sourceKey: 'listing:new' });

    await runCleanup();

    expect(remaining()).toEqual([1_198, 1_199, 1_200, 1_201]);
    expect(db.scmRepositorySync.findMany).toHaveBeenCalledTimes(3);
    expect(db.scmRepositorySync.groupBy).toHaveBeenCalledTimes(3);
    expect(db.scmRepositorySync.findFirst).toHaveBeenCalledTimes(1);
    for (let [args] of vi.mocked(db.scmRepositorySync.deleteMany).mock.calls) {
      expect(Object.keys(args!.where!)).toEqual(['oid']);
    }
  });
});
