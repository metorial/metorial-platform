import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  queryRaw: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: { $queryRaw: mocks.queryRaw }
}));

import { v1SkillSyncPresenter } from './skillSync';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let createdAt = new Date('2026-11-01T10:00:00Z');

let propagation = (overrides: Record<string, unknown> = {}) => ({
  oid: 10n,
  id: 'sksrp_1',
  status: 'processing',
  skillRepositoryOid: 5n,
  skillRepository: { repoId: 'ogr_1' },
  repositoryAccessMode: 'pull_request',
  branchName: 'metorial/sync-1',
  prName: 'Sync skills',
  prDescription: null,
  commitMessage: null,
  errorCode: null,
  errorMessage: null,
  waitingUntil: null,
  waitingReason: null,
  endReason: null,
  createdAt,
  updatedAt: createdAt,
  startedAt: createdAt,
  completedAt: null,
  ...overrides
});

let present = async (propagations: ReturnType<typeof propagation>[], destinationOid = 3n) => {
  let result = await v1SkillSyncPresenter
    .present(
      {
        skillSync: {
          id: 'skds_1',
          status: 'processing',
          destinationOid,
          logs: [],
          destination: { skillMarketplace: { id: 'skmk_1' }, skillPlugin: null },
          repositoryPropagations: propagations,
          createdAt,
          startedAt: createdAt,
          completedAt: null
        } as any
      },
      context
    )
    .run();

  return result.repository_propagations;
};

describe('v1SkillSyncPresenter repository propagations', () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it('presents waiting and end fields as null when they are empty', async () => {
    let [presented] = await present([propagation()]);

    expect(presented).toMatchObject({
      waiting_until: null,
      waiting_reason: null,
      end_reason: null,
      continued_in_sync_id: null
    });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('exposes the wait while the propagation is in progress', async () => {
    let waitingUntil = new Date('2026-11-01T14:32:00Z');

    let [presented] = await present([
      propagation({ waitingUntil, waitingReason: 'rate_limited' })
    ]);

    expect(presented).toMatchObject({
      status: 'processing',
      waiting_until: waitingUntil,
      waiting_reason: 'rate_limited'
    });
  });

  it('hides a stale wait once the propagation has ended', async () => {
    let [presented] = await present([
      propagation({
        status: 'completed',
        waitingUntil: new Date('2026-11-01T14:32:00Z'),
        waitingReason: 'rate_limited'
      })
    ]);

    expect(presented).toMatchObject({ waiting_until: null, waiting_reason: null });
  });

  it.each(['pull_request_closed', 'pull_request_deleted', 'branch_deleted'])(
    'exposes end reason %s without looking up a successor',
    async endReason => {
      let [presented] = await present([propagation({ status: 'canceled', endReason })]);

      expect(presented).toMatchObject({
        status: 'canceled',
        end_reason: endReason,
        continued_in_sync_id: null
      });
      expect(mocks.queryRaw).not.toHaveBeenCalled();
    }
  );

  it('links a superseded propagation to the next sync of the same destination and repository', async () => {
    mocks.queryRaw.mockResolvedValue([{ propagationOid: 10n, syncId: 'skds_2' }]);

    let [presented] = await present([
      propagation({ status: 'canceled', endReason: 'superseded' })
    ]);

    expect(presented).toMatchObject({
      end_reason: 'superseded',
      continued_in_sync_id: 'skds_2'
    });
    let [sql, propagationOids, repositoryOids, destinationOids] =
      mocks.queryRaw.mock.calls[0]!;
    expect(sql.join('?')).toContain('"oid" > lookup."propagationOid"');
    expect(sql.join('?')).toContain('sync."destinationOid" = lookup."destinationOid"');
    expect([propagationOids, repositoryOids, destinationOids]).toEqual([['10'], ['5'], ['3']]);
  });

  it('looks up the successors of every sync presented together in one query', async () => {
    mocks.queryRaw.mockResolvedValue([
      { propagationOid: 10n, syncId: 'skds_2' },
      { propagationOid: 21n, syncId: 'skds_9' }
    ]);

    let [first, second] = await Promise.all([
      present([
        propagation({ status: 'canceled', endReason: 'superseded' }),
        propagation({ oid: 11n, status: 'canceled', endReason: 'superseded' })
      ]),
      present(
        [
          propagation({
            oid: 21n,
            skillRepositoryOid: 6n,
            status: 'canceled',
            endReason: 'superseded'
          })
        ],
        4n
      )
    ]);

    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    expect(mocks.queryRaw.mock.calls[0]!.slice(1)).toEqual([
      ['10', '11', '21'],
      ['5', '5', '6'],
      ['3', '3', '4']
    ]);
    expect(first.map(presented => presented.continued_in_sync_id)).toEqual(['skds_2', null]);
    expect(second[0]!.continued_in_sync_id).toBe('skds_9');
  });

  it('reports how many unexpected deletes tripped the deletion guard', async () => {
    let [tripped, other] = await present([
      propagation({
        status: 'failed',
        errorCode: 'deletion_guard_tripped',
        errorDetails: { unexpectedDeletes: 300, paths: ['a.md'] }
      }),
      propagation({ status: 'failed', errorCode: 'rate_limited', errorDetails: { total: 4 } })
    ]);

    expect(tripped!.unexpected_delete_count).toBe(300);
    expect(other!.unexpected_delete_count).toBeNull();
  });

  it('omits the successor when none exists yet', async () => {
    mocks.queryRaw.mockResolvedValue([]);

    let [presented] = await present([
      propagation({ status: 'canceled', endReason: 'superseded' })
    ]);

    expect(presented).toMatchObject({ end_reason: 'superseded', continued_in_sync_id: null });
  });

  it('exposes the error code of a failed propagation', async () => {
    let [presented] = await present([
      propagation({
        status: 'failed',
        errorCode: 'path_conflict',
        errorMessage: "plugins/a can't be written"
      })
    ]);

    expect(presented).toMatchObject({
      error_code: 'path_conflict',
      error_message: "plugins/a can't be written"
    });
  });

  it('drops end reasons it does not know', async () => {
    let [presented] = await present([
      propagation({ status: 'canceled', endReason: 'something_new' })
    ]);

    expect(presented).toMatchObject({ end_reason: null });
  });

  it('declares the new fields in the schema', () => {
    let properties = (v1SkillSyncPresenter.schema as any).properties.repository_propagations
      .items.properties;

    for (let field of [
      'error_code',
      'waiting_until',
      'waiting_reason',
      'end_reason',
      'continued_in_sync_id',
      'unexpected_delete_count'
    ]) {
      expect(properties).toHaveProperty(field);
    }
  });
});
