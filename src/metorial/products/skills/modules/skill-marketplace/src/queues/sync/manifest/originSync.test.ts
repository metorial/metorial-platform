import { describe, expect, it } from 'vitest';
import {
  getManifestErrorMessage,
  isRetryableManifestErrorCode,
  resolveManifestPropagationOutcome,
  summarizeResultStats,
  type ManifestOriginSync
} from './originSync';

let now = new Date('2026-11-08T12:00:00Z');
let hour = 60 * 60 * 1000;

let resolve = (
  originSync: Partial<ManifestOriginSync>,
  d: { repositoryAccessMode?: 'pull_request' | 'default_branch'; startedAt?: Date } = {}
) =>
  resolveManifestPropagationOutcome({
    originSync: { id: 'origin_1', status: 'syncing_contents', ...originSync },
    repositoryAccessMode: d.repositoryAccessMode ?? 'pull_request',
    startedAt: d.startedAt ?? new Date(now.getTime() - hour),
    now,
    maxLifetimeMs: 48 * hour
  });

describe('manifest propagation outcome', () => {
  it.each([
    ['merged', true],
    ['complete_direct_push', true],
    ['complete_no_changes', true],
    ['complete_unmerged', false]
  ])('completes on %s and marks base-branch outcomes', (status, onBaseBranch) => {
    expect(resolve({ status })).toEqual({ type: 'completed', onBaseBranch });
  });

  it.each([
    [
      'deletion_guard_tripped',
      { unexpectedDeletes: 412 },
      "Sync would delete 412 files Metorial didn't expect; review and force the sync to continue."
    ],
    ['destination_too_large', null, expect.stringContaining('too large to sync')],
    [
      'file_too_large',
      { path: 'skills/a/big.bin' },
      expect.stringContaining('skills/a/big.bin is too large')
    ],
    ['lfs_quota_exceeded', null, expect.stringContaining('Git LFS storage quota')],
    ['manifest_invalid', null, expect.stringContaining('will not be retried')],
    ['source_not_found', { keys: ['k'] }, expect.stringContaining('rebuilds them')],
    ['rate_limited', null, expect.stringContaining('rate limiting')],
    ['no_progress', null, 'Sync stopped making progress; Metorial will retry.']
  ])('maps %s to a failure with an actionable message', (errorCode, errorDetails, message) => {
    expect(
      resolve({
        status: 'failed',
        errorCode,
        errorDetails,
        errorMessage: 'raw origin message'
      })
    ).toEqual({ type: 'failed', errorCode, errorMessage: message });
  });

  it('falls back to the Origin message when Origin does not report a code', () => {
    expect(resolve({ status: 'failed', errorMessage: 'Something broke' })).toEqual({
      type: 'failed',
      errorCode: 'origin_failed',
      errorMessage: 'Something broke'
    });
  });

  it.each(['pull_request_closed', 'pull_request_deleted', 'branch_deleted'])(
    'treats %s as a dismissal',
    endReason => {
      expect(resolve({ status: 'cancelled', endReason })).toEqual({
        type: 'canceled',
        endReason,
        dismissed: true
      });
    }
  );

  it('cancels superseded syncs without treating them as a failure or dismissal', () => {
    expect(resolve({ status: 'cancelled', endReason: 'superseded' })).toEqual({
      type: 'canceled',
      endReason: 'superseded',
      dismissed: false
    });
  });

  it('maps a rate-limited Origin sync to processing with a waiting time', () => {
    let nextPollAt = new Date(now.getTime() + 10 * 60 * 1000);

    expect(
      resolve({
        status: 'syncing_contents',
        errorCode: 'rate_limited',
        nextPollAt: nextPollAt.toISOString()
      })
    ).toEqual({
      type: 'active',
      status: 'processing',
      waitingUntil: nextPollAt,
      waitingReason: 'rate_limited'
    });
    expect(
      resolve({
        status: 'syncing_contents',
        errorMessage: 'GitHub rate limit hit',
        nextPollAt
      })
    ).toMatchObject({ waitingReason: 'rate_limited' });
    expect(
      resolve({ status: 'syncing_contents', errorMessage: 'Provider unavailable', nextPollAt })
    ).toMatchObject({ waitingReason: 'provider_unavailable' });
    expect(
      resolve({
        status: 'syncing_contents',
        waitingReason: 'provider_capacity',
        waitingUntil: nextPollAt,
        nextPollAt: now
      })
    ).toMatchObject({ waitingReason: 'provider_capacity', waitingUntil: nextPollAt });
  });

  it('does not report waiting for a healthy in-flight sync', () => {
    expect(resolve({ status: 'syncing_contents', nextPollAt: now })).toEqual({
      type: 'active',
      status: 'processing',
      waitingUntil: null,
      waitingReason: null
    });
  });

  it('only reports waiting for review in pull request mode', () => {
    expect(resolve({ status: 'waiting_for_review' })).toMatchObject({
      status: 'waiting_for_review'
    });
    expect(
      resolve({ status: 'waiting_for_review' }, { repositoryAccessMode: 'default_branch' })
    ).toMatchObject({ status: 'processing' });
  });

  it('fails a processing sync that outlived the maximum sync lifetime', () => {
    let startedAt = new Date(now.getTime() - 49 * hour);

    expect(resolve({ status: 'syncing_contents' }, { startedAt })).toMatchObject({
      type: 'failed',
      errorCode: 'sync_timeout'
    });
    expect(
      resolve(
        { status: 'syncing_contents', errorCode: 'rate_limited', nextPollAt: now },
        { startedAt }
      )
    ).toMatchObject({ type: 'failed', errorCode: 'rate_limited' });
    expect(resolve({ status: 'waiting_for_review' }, { startedAt })).toMatchObject({
      type: 'active',
      status: 'waiting_for_review'
    });
  });
});

describe('manifest error codes', () => {
  it.each([
    ['rate_limited', true],
    ['source_not_found', true],
    ['sync_timeout', true],
    ['sync_lifetime_exceeded', true],
    ['no_progress', true],
    ['upstream_failure', true],
    ['network_failure', true],
    ['authentication_failed', false],
    ['protected_branch', false],
    ['content_mismatch', true],
    ['tree_too_large', false],
    ['recovery_exhausted', false],
    ['deletion_guard_tripped', false],
    ['manifest_invalid', false],
    ['destination_too_large', false],
    ['file_too_large', false],
    ['lfs_quota_exceeded', false],
    ['permission_denied', false],
    ['origin_failed', false],
    [null, false]
  ])('retries %s automatically: %s', (code, retryable) => {
    expect(isRetryableManifestErrorCode(code)).toBe(retryable);
  });

  it('uses the singular form for one unexpected delete', () => {
    expect(
      getManifestErrorMessage({
        errorCode: 'deletion_guard_tripped',
        details: { paths: ['a.md'] }
      })
    ).toBe(
      "Sync would delete 1 file Metorial didn't expect; review and force the sync to continue."
    );
  });

  it('tells the user how to fix a repository tree too large to compare', () => {
    expect(getManifestErrorMessage({ errorCode: 'tree_too_large' })).toBe(
      'The repository has too many folders for Metorial to compare. Sync into a smaller repository or remove unrelated folders from it, then sync again.'
    );
    expect(
      getManifestErrorMessage({
        errorCode: 'tree_too_large',
        originMessage: 'internal detail'
      })
    ).not.toContain('internal detail');
  });

  it('summarizes Origin result stats for the sync log', () => {
    expect(
      summarizeResultStats({
        filesUploaded: 3,
        filesSkipped: 10,
        deleted: 1,
        commitsCreated: 1
      })
    ).toBe('3 uploaded, 10 unchanged, 1 deleted, 1 commit');
    expect(summarizeResultStats({})).toBeNull();
    expect(summarizeResultStats(null)).toBeNull();
  });
});
