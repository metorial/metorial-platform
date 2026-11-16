import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));
vi.mock('../../../db', () => ({ db: {} }));
vi.mock('../../../services/repositorySyncState', () => ({
  isTerminalRepositorySyncStatus: () => false,
  transitionRepositorySyncState: vi.fn()
}));

import { EXPORT_ERROR_PREFIX, parseExportError } from '../../../lib/exportError';
import {
  getManifestSyncContentsRetry,
  getManifestSyncRetryDelayMs,
  MANIFEST_SYNC_LIFETIME_MS
} from './_lib';

let exportError = (payload: Record<string, unknown>) => {
  let details = `${EXPORT_ERROR_PREFIX}${JSON.stringify({ message: 'failed', ...payload })}`;
  return Object.assign(
    new Error(`/rpc.CodeBucket/ExportBucketToGithub UNAVAILABLE: ${details}`),
    {
      code: 14,
      details
    }
  );
};

let rateLimited = (retryAfterUnix?: number) =>
  exportError({ code: 'rate_limited', retryAfterUnix });
let upstream = Object.assign(new Error('Bad gateway'), { status: 502 });

let now = Date.UTC(2026, 10, 8, 12);
let createdAt = new Date(now - 60_000);

let retry = (d: {
  error: unknown;
  attemptCount?: number;
  madeProgress?: boolean;
  createdAt?: Date;
}) =>
  getManifestSyncContentsRetry({
    attemptCount: d.attemptCount ?? 0,
    madeProgress: d.madeProgress ?? false,
    createdAt: d.createdAt ?? createdAt,
    retryAfter: parseExportError(d.error)?.retryAfter ?? null,
    error: d.error,
    now
  });

describe('manifest sync retry policy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never fails a long sync that keeps making progress', () => {
    let attemptCount = 0;
    for (let slice = 0; slice < 20; slice++) {
      let decision = retry({ error: rateLimited(), attemptCount, madeProgress: true });
      expect(decision).toMatchObject({ retry: true, attemptCount: 0 });
      attemptCount = decision.retry ? decision.attemptCount : attemptCount;
    }
  });

  it('fails after six consecutive rate-limited slices without progress', () => {
    let attemptCount = 0;
    let decisions = [];
    for (let slice = 0; slice < 6; slice++) {
      let decision = retry({ error: rateLimited(), attemptCount });
      decisions.push(decision);
      if (decision.retry) attemptCount = decision.attemptCount;
    }

    expect(decisions.slice(0, 5).every(decision => decision.retry)).toBe(true);
    expect(decisions[5]).toEqual({ retry: false, reason: 'attempts' });
  });

  it('allows three consecutive unproductive retries for other transient errors', () => {
    expect(retry({ error: upstream, attemptCount: 0 })).toMatchObject({
      retry: true,
      attemptCount: 1
    });
    expect(retry({ error: upstream, attemptCount: 1 })).toMatchObject({
      retry: true,
      attemptCount: 2
    });
    expect(retry({ error: upstream, attemptCount: 2 })).toEqual({
      retry: false,
      reason: 'attempts'
    });
  });

  it('resets the unproductive count when the failing slice still made progress', () => {
    expect(retry({ error: rateLimited(), attemptCount: 5, madeProgress: true })).toMatchObject(
      {
        retry: true,
        attemptCount: 0
      }
    );
  });

  it('does not retry permanent export errors', () => {
    for (let code of ['manifest_invalid', 'deletion_guard_tripped', 'tree_too_large']) {
      expect(retry({ error: exportError({ code }) })).toEqual({
        retry: false,
        reason: 'not_retryable'
      });
    }
  });

  it('stops retrying once the next attempt would pass the 48 h lifetime', () => {
    let old = new Date(now - MANIFEST_SYNC_LIFETIME_MS + 30_000);
    expect(retry({ error: rateLimited(), createdAt: old })).toEqual({
      retry: false,
      reason: 'lifetime'
    });
  });

  it('waits until retry_after plus jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    let retryAfter = Math.floor(now / 1000) + 600;
    let decision = retry({ error: rateLimited(retryAfter) });

    expect(decision).toEqual({ retry: true, attemptCount: 1, delayMs: 600_000 + 15_000 });
  });

  it('caps the retry_after wait at one hour', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(
      getManifestSyncRetryDelayMs({
        retryAfter: new Date(now + 5 * 60 * 60_000),
        attemptCount: 0,
        error: rateLimited(),
        now
      })
    ).toBe(60 * 60_000);
  });

  it('falls back to exponential backoff without retry_after', () => {
    expect(
      getManifestSyncRetryDelayMs({
        retryAfter: null,
        attemptCount: 2,
        error: rateLimited(),
        now
      })
    ).toBe(4 * 60_000);
    expect(
      getManifestSyncRetryDelayMs({
        retryAfter: new Date(now - 1_000),
        attemptCount: 1,
        error: upstream,
        now
      })
    ).toBe(4_000);
  });
});
