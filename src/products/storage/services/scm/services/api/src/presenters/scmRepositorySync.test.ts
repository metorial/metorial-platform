import { describe, expect, it } from 'vitest';
import { scmRepositorySyncPresenter } from './scmRepositorySync';

let sync = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'sync_2',
    status: 'syncing_contents',
    repositoryAccessMode: 'pull_request',
    sourceType: 'manifest',
    mergeAttemptSnapshotHashes: [],
    statusSnapshot: null,
    waitingReason: null,
    nextPollAt: null,
    errorCode: null,
    errorDetails: null,
    endReason: null,
    continuedFromSync: null,
    supersededBySync: null,
    ...overrides
  }) as any;

describe('repository sync presenter', () => {
  it('links continued and superseded syncs by public id', () => {
    expect(
      scmRepositorySyncPresenter(
        sync({
          status: 'cancelled',
          endReason: 'superseded',
          continuedFromSync: { id: 'sync_1' },
          supersededBySync: { id: 'sync_3' }
        })
      )
    ).toMatchObject({
      endReason: 'superseded',
      continuedFromSyncId: 'sync_1',
      supersededBySyncId: 'sync_3'
    });
  });

  it('reports why and until when a slice is waiting', () => {
    let nextPollAt = new Date('2026-11-08T13:00:00Z');
    expect(
      scmRepositorySyncPresenter(sync({ waitingReason: 'rate_limited', nextPollAt }))
    ).toMatchObject({ waitingReason: 'rate_limited', waitingUntil: nextPollAt, nextPollAt });
  });

  it('does not report a stale wait once the sync moved on', () => {
    expect(
      scmRepositorySyncPresenter(
        sync({
          status: 'waiting_for_ci',
          waitingReason: 'rate_limited',
          nextPollAt: new Date()
        })
      )
    ).toMatchObject({ waitingReason: null, waitingUntil: null });
  });

  it('exposes structured failure details', () => {
    expect(
      scmRepositorySyncPresenter(
        sync({
          status: 'failed',
          errorCode: 'deletion_guard_tripped',
          errorDetails: { unexpectedDeletes: 120, maxUnexpectedDeletes: 50 }
        })
      )
    ).toMatchObject({
      errorCode: 'deletion_guard_tripped',
      errorDetails: { unexpectedDeletes: 120, maxUnexpectedDeletes: 50 }
    });
  });
});
