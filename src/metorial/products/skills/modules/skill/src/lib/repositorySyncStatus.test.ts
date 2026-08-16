import { describe, expect, it } from 'vitest';
import {
  getRepositorySyncRetryMessage,
  isRepositorySyncRetrying
} from './repositorySyncStatus';

describe('repository sync status', () => {
  it('only treats scheduled provider failures as active retries', () => {
    expect(
      isRepositorySyncRetrying({
        errorMessage: 'Provider unavailable',
        nextPollAt: new Date()
      })
    ).toBe(true);
    expect(
      isRepositorySyncRetrying({ errorMessage: 'Terminal failure', nextPollAt: null })
    ).toBe(false);
    expect(isRepositorySyncRetrying({ errorMessage: null, nextPollAt: new Date() })).toBe(
      false
    );
  });

  it('uses mode-specific canonical retry messages', () => {
    expect(getRepositorySyncRetryMessage('default_branch')).toBe(
      `We couldn't update the default branch. We'll retry automatically.`
    );
    expect(getRepositorySyncRetryMessage('pull_request')).toBe(
      `We couldn't update the pull request. We'll retry automatically.`
    );
  });
});
