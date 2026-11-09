import { describe, expect, it } from 'vitest';
import {
  formatResumeTime,
  getForceSyncLabel,
  getPropagationDismissalMessage,
  getPropagationErrorMessage,
  getPropagationWaitingMessage,
  getRepositoryActionMessage,
  type RepositoryActionMessageInput
} from './skillSyncMessages';

let check = (
  overrides: Partial<RepositoryActionMessageInput> = {}
): RepositoryActionMessageInput => ({
  provider: 'gitlab',
  repositoryAccessMode: 'pull_request',
  overrideAttemptStatus: 'waiting',
  mergeBeforeChecksPass: false,
  blockers: [],
  targetBranch: 'main',
  errorMessage: null,
  reviewStatus: 'not_required',
  requiredReviewCount: 0,
  approvedReviewCount: 0,
  ...overrides
});

describe('skill sync repository messages', () => {
  it('keeps failed-check and review guidance concise', () => {
    expect(getRepositoryActionMessage(check({ blockers: ['checks_failed'] }))).toBe(
      'Checks failed. Fix or rerun them to continue.'
    );
    expect(
      getRepositoryActionMessage(
        check({
          blockers: ['reviews_required'],
          reviewStatus: 'pending',
          requiredReviewCount: 1,
          approvedReviewCount: 0
        })
      )
    ).toBe('Review required (0/1 approvals).');
    expect(
      getRepositoryActionMessage(
        check({
          blockers: ['checks_failed', 'reviews_required'],
          reviewStatus: 'pending',
          requiredReviewCount: 1,
          approvedReviewCount: 0
        })
      )
    ).toBe('Checks failed and review is required (0/1 approvals).');
  });

  it('distinguishes early, override, and refused attempts', () => {
    expect(
      getRepositoryActionMessage(
        check({
          overrideAttemptStatus: 'attempting',
          mergeBeforeChecksPass: true,
          blockers: ['checks_pending']
        })
      )
    ).toBe('Trying to merge before checks finish.');
    expect(
      getRepositoryActionMessage(
        check({ overrideAttemptStatus: 'attempting', blockers: ['checks_failed'] })
      )
    ).toBe('Trying an override merge.');
    expect(getRepositoryActionMessage(check({ overrideAttemptStatus: 'refused' }))).toBe(
      'GitLab blocked the merge. Review repository rules.'
    );
  });
});

describe('skill sync propagation notices', () => {
  let now = new Date(2026, 10, 8, 9, 0);
  let resumesAt = new Date(2026, 10, 8, 14, 32);

  it('describes a rate-limit wait with the provider and resume time', () => {
    expect(
      getPropagationWaitingMessage(
        { provider: 'github', waitingUntil: resumesAt, waitingReason: 'rate_limited' },
        now
      )
    ).toBe(`Waiting for GitHub rate limit, resumes at ${formatResumeTime(resumesAt, now)}`);
    expect(
      getPropagationWaitingMessage(
        { provider: 'gitlab', waitingUntil: resumesAt, waitingReason: 'something_else' },
        now
      )
    ).toBe(`Waiting to continue, resumes at ${formatResumeTime(resumesAt, now)}`);
    expect(getPropagationWaitingMessage({ provider: 'github', waitingUntil: null }, now)).toBe(
      null
    );
  });

  it('adds the day when the wait ends on another day', () => {
    let tomorrow = new Date(2026, 10, 9, 1, 5);

    expect(formatResumeTime(resumesAt, now)).not.toMatch(/Nov/);
    expect(formatResumeTime(tomorrow, now)).toMatch(/Nov/);
  });

  it('explains pull requests and branches dismissed in the repository', () => {
    expect(
      getPropagationDismissalMessage({ provider: 'github', endReason: 'pull_request_closed' })
    ).toBe(
      "Pull request was closed in GitHub. Metorial won't reopen it. The next change opens a new pull request."
    );
    expect(
      getPropagationDismissalMessage({ provider: 'gitlab', endReason: 'pull_request_deleted' })
    ).toBe(
      "Merge request was deleted in GitLab. Metorial won't reopen it. The next change opens a new merge request."
    );
    expect(
      getPropagationDismissalMessage({ provider: 'bitbucket', endReason: 'branch_deleted' })
    ).toBe(
      "Branch was deleted in Bitbucket. Metorial won't reopen it. The next change opens a new pull request."
    );
    expect(
      getPropagationDismissalMessage({ provider: 'github', endReason: 'superseded' })
    ).toBe(null);
  });

  it('names the provider while it is temporarily unavailable', () => {
    let now = new Date(2026, 10, 8, 9, 0);
    let waitingUntil = new Date(2026, 10, 8, 9, 30);

    expect(
      getPropagationWaitingMessage(
        { provider: 'gitlab', waitingUntil, waitingReason: 'provider_unavailable' },
        now
      )
    ).toBe(
      `GitLab is temporarily unavailable, retrying at ${formatResumeTime(waitingUntil, now)}`
    );
    expect(
      getPropagationWaitingMessage(
        { provider: null, waitingUntil, waitingReason: 'provider_unavailable' },
        now
      )
    ).toBe(
      `Repository provider is temporarily unavailable, retrying at ${formatResumeTime(waitingUntil, now)}`
    );
  });

  it.each([
    ['path_conflict', 'A path in the GitHub repository is in the way'],
    ['destination_too_large', 'This marketplace is too large to sync to a repository'],
    ['file_too_large', 'A synced file is too large for GitHub'],
    ['lfs_quota_exceeded', 'GitHub Git LFS quota is used up'],
    ['deletion_guard_tripped', "This sync would delete files Metorial didn't expect"],
    ['tree_too_large', 'The GitHub repository has too many folders for Metorial to compare'],
    ['content_mismatch', 'Metorial rebuilds them and retries automatically'],
    ['recovery_exhausted', 'Edit or re-save the affected skills, then sync again'],
    ['no_progress', 'Sync stopped making progress; Metorial will retry.']
  ])('explains the %s propagation error', (errorCode, expected) => {
    expect(
      getPropagationErrorMessage({ provider: 'github', errorCode, errorMessage: 'raw' })
    ).toContain(expected);
  });

  it('counts the files a tripped deletion guard would delete', () => {
    expect(
      getPropagationErrorMessage({
        provider: 'github',
        errorCode: 'deletion_guard_tripped',
        unexpectedDeleteCount: 300
      })
    ).toContain('would delete 300 files');
    expect(
      getPropagationErrorMessage({
        provider: 'github',
        errorCode: 'deletion_guard_tripped',
        unexpectedDeleteCount: 1
      })
    ).toContain('would delete 1 file ');
    expect(getForceSyncLabel(300)).toBe('Sync anyway and delete 300 files');
    expect(getForceSyncLabel(1)).toBe('Sync anyway and delete 1 file');
    expect(getForceSyncLabel(null)).toBe('Sync anyway and delete files');
  });

  it('falls back to the stored message for other propagation errors', () => {
    expect(
      getPropagationErrorMessage({
        provider: 'github',
        errorCode: 'other',
        errorMessage: 'raw'
      })
    ).toBe('raw');
    expect(getPropagationErrorMessage({ provider: 'github', errorCode: null })).toBeNull();
  });
});
