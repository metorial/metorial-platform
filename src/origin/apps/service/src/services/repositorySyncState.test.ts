import { describe, expect, it } from 'vitest';
import {
  classifyRepositorySyncSnapshot,
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

describe('repository sync snapshot classification', () => {
  it('treats completed direct pushes as terminal', () => {
    expect(isTerminalRepositorySyncStatus('complete_direct_push')).toBe(true);
  });

  it('waits for review after checks pass when approval blocks merging', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({
          review: { state: 'pending', approvals: 0, changesRequested: 0 },
          mergeability: { state: 'blocked', reason: 'approval_required' }
        }),
        true
      )
    ).toBe('waiting_for_review');
  });

  it('does not merge while provider mergeability is unknown', () => {
    expect(
      classifyRepositorySyncSnapshot(snapshot({ mergeability: { state: 'unknown' } }), true)
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
        true
      )
    ).toBe('merging');
  });

  it('only enters merging for a mergeable auto-merge sync', () => {
    expect(classifyRepositorySyncSnapshot(snapshot(), true)).toBe('merging');
    expect(classifyRepositorySyncSnapshot(snapshot(), false)).toBe('waiting_for_review');
  });

  it('normalizes closed and merged provider states to terminal statuses', () => {
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ pullRequest: { id: '1', url: 'x', state: 'merged' } }),
        true
      )
    ).toBe('merged');
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ pullRequest: { id: '1', url: 'x', state: 'closed' } }),
        true
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
        true
      )
    ).toBe('waiting_for_review');
    expect(
      classifyRepositorySyncSnapshot(
        snapshot({ mergeability: { state: 'conflicting', reason: 'conflict' } }),
        true
      )
    ).toBe('waiting_for_review');
  });
});
