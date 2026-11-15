import { describe, expect, it } from 'vitest';
import {
  classifyRepositorySyncSnapshot,
  getRepositorySyncMaterialSnapshotHash,
  isTerminalRepositorySyncStatus,
  type RepositorySyncStatusSnapshot
} from './repositorySyncState';

let snapshot = (
  overrides: Partial<RepositorySyncStatusSnapshot> = {}
): RepositorySyncStatusSnapshot => ({
  version: 1,
  provider: 'github',
  pullRequest: { id: '1', url: 'https://example.test/pr/1', state: 'open' },
  checks: {
    state: 'success',
    total: 1,
    successful: 1,
    pending: 0,
    failed: 0,
    items: []
  },
  review: { state: 'not_required', approvals: 0, changesRequested: 0 },
  mergeability: { state: 'mergeable' },
  observedAt: new Date(0).toISOString(),
  ...overrides
});

let policy = (
  overrides: Partial<{
    enableAutoMerge: boolean;
    forceMergeOrPush: boolean;
    mergeBeforeChecksPass: boolean;
  }> = {}
) => ({
  enableAutoMerge: true,
  forceMergeOrPush: false,
  mergeBeforeChecksPass: false,
  ...overrides
});

describe('repository sync snapshot classification', () => {
  it('treats completed direct pushes as terminal', () => {
    expect(isTerminalRepositorySyncStatus('complete_direct_push')).toBe(true);
  });

  it('keys merge attempts by material snapshot changes, not observation time', () => {
    let initial = snapshot();
    let observedLater = { ...initial, observedAt: new Date(1).toISOString() };
    let checksChanged = {
      ...observedLater,
      checks: { ...observedLater.checks, state: 'pending' as const }
    };

    expect(getRepositorySyncMaterialSnapshotHash(observedLater)).toBe(
      getRepositorySyncMaterialSnapshotHash(initial)
    );
    expect(getRepositorySyncMaterialSnapshotHash(checksChanged)).not.toBe(
      getRepositorySyncMaterialSnapshotHash(initial)
    );
  });

  it('waits for review after checks pass when approval blocks merging', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          review: { state: 'pending', approvals: 0, changesRequested: 0 },
          mergeability: { state: 'blocked', reason: 'approval_required' }
        }),
        policy()
      )
    ).toBe('waiting_for_review');
  });

  it('does not merge while provider mergeability is unknown', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ mergeability: { state: 'unknown' } }),
        policy()
      )
    ).toBe('waiting_for_ci');
  });

  it('lets Bitbucket make the definitive merge decision after checks pass', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          provider: 'bitbucket',
          review: { state: 'unknown', approvals: 0, changesRequested: 0 },
          mergeability: { state: 'unknown' }
        }),
        policy()
      )
    ).toBe('merging');
  });

  it('only enters merging for a mergeable auto-merge sync', () => {
    expect(classifyRepositorySyncSnapshot(snapshot(), policy())).toBe('merging');
    expect(
      classifyRepositorySyncSnapshot(snapshot(), policy({ enableAutoMerge: false }))
    ).toBe('waiting_for_review');
  });

  it('normalizes closed and merged provider states to terminal statuses', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ pullRequest: { id: '1', url: 'x', state: 'merged' } }),
        policy()
      )
    ).toBe('merged');
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ pullRequest: { id: '1', url: 'x', state: 'closed' } }),
        policy()
      )
    ).toBe('cancelled');
  });

  it('keeps failed checks and conflicts recoverable', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          checks: {
            state: 'failed',
            total: 1,
            successful: 0,
            pending: 0,
            failed: 1,
            items: []
          }
        }),
        policy()
      )
    ).toBe('waiting_for_review');
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ mergeability: { state: 'conflicting', reason: 'conflict' } }),
        policy()
      )
    ).toBe('waiting_for_review');
  });

  it('can attempt a merge before checks pass without bypassing approvals', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          checks: {
            state: 'pending',
            total: 1,
            successful: 0,
            pending: 1,
            failed: 0,
            items: []
          }
        }),
        policy({ mergeBeforeChecksPass: true })
      )
    ).toBe('merging');
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          checks: {
            state: 'pending',
            total: 1,
            successful: 0,
            pending: 1,
            failed: 0,
            items: []
          },
          mergeability: { state: 'blocked', reason: 'ci_must_pass' }
        }),
        policy({ mergeBeforeChecksPass: true })
      )
    ).toBe('merging');
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          checks: {
            state: 'pending',
            total: 1,
            successful: 0,
            pending: 1,
            failed: 0,
            items: []
          },
          review: { state: 'pending', approvals: 0, changesRequested: 0 },
          mergeability: { state: 'blocked', reason: 'not_approved' }
        }),
        policy({ mergeBeforeChecksPass: true })
      )
    ).toBe('waiting_for_review');
  });

  it('does not let early merge bypass failed checks', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          checks: {
            state: 'failed',
            total: 1,
            successful: 0,
            pending: 0,
            failed: 1,
            items: []
          }
        }),
        policy({ mergeBeforeChecksPass: true })
      )
    ).toBe('waiting_for_review');
  });

  it('does not let force policy bypass checks that are still pending', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          checks: {
            state: 'pending',
            total: 1,
            successful: 0,
            pending: 1,
            failed: 0,
            items: []
          },
          review: { state: 'pending', approvals: 0, changesRequested: 0 },
          mergeability: { state: 'blocked', reason: 'not_approved' }
        }),
        policy({ forceMergeOrPush: true })
      )
    ).toBe('waiting_for_ci');
  });

  it('lets force policy attempt provider-authoritative merges but never conflicts', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          checks: {
            state: 'failed',
            total: 1,
            successful: 0,
            pending: 0,
            failed: 1,
            items: []
          },
          review: { state: 'changes_requested', approvals: 0, changesRequested: 1 },
          mergeability: { state: 'blocked', reason: 'repository_policy' }
        }),
        policy({ forceMergeOrPush: true })
      )
    ).toBe('merging');
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ mergeability: { state: 'conflicting' } }),
        policy({ forceMergeOrPush: true })
      )
    ).toBe('waiting_for_review');
  });
});
