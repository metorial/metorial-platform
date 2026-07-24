import { describe, expect, it } from 'vitest';
import {
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
