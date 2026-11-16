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

  it('describes readiness and throttling without claiming an outage', () => {
    expect(getRepositorySyncRetryMessage('pull_request', 'merge_not_ready')).toContain(
      "isn't ready to merge yet"
    );
    expect(getRepositorySyncRetryMessage('pull_request', 'rate_limited')).toContain(
      'limiting requests'
    );
    expect(getRepositorySyncRetryMessage('pull_request', 'unknown')).not.toContain(
      'unavailable'
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
