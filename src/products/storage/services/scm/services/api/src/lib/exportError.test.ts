import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));

import { EXPORT_ERROR_PREFIX, parseExportError } from './exportError';
import {
  getFileTooLargeDetail,
  getScmProviderErrorDetails,
  isRetryableScmProviderError
} from './scmProviderError';

let stats = {
  filesTotal: 10,
  filesUploaded: 4,
  filesSkipped: 6,
  blobsCreated: 0,
  blobsReused: 0,
  lfsUploaded: 0,
  bytesUploaded: 2048,
  deleted: 0,
  unexpectedDeletes: 0,
  githubRequests: 7,
  rateLimitWaitMs: 0,
  commitsCreated: 2,
  batchSizeReductions: 0
};

let grpcError = (grpcCode: number, payload: Record<string, unknown>) => {
  let details = `${EXPORT_ERROR_PREFIX}${JSON.stringify(payload)}`;
  return Object.assign(
    new Error(`/rpc.CodeBucket/ExportBucketToGithub FAILED_PRECONDITION: ${details}`),
    { code: grpcCode, details }
  );
};

describe('structured export errors', () => {
  it('parses the Go status payload from ClientError.details', () => {
    let error = grpcError(8, {
      code: 'rate_limited',
      message: 'rate limited by provider until 2030-03-17T17:46:40Z: secondary rate limit',
      details: {},
      commitsCreated: 2,
      retryAfterUnix: 1_900_000_000,
      stats
    });

    expect(parseExportError(error)).toEqual({
      code: 'rate_limited',
      message: 'rate limited by provider until 2030-03-17T17:46:40Z: secondary rate limit',
      details: {},
      commitsCreated: 2,
      writeRequests: null,
      lineage: { startHeadSha: null, lastCommitSha: null, foreignCommits: false },
      retryAfter: new Date(1_900_000_000_000),
      stats,
      newRemoteState: null
    });
  });

  it('reads the commits a failed run wrote and the writes it spent', () => {
    let error = grpcError(8, {
      code: 'rate_limited',
      message: 'rate limited',
      commitsCreated: 1,
      writeRequests: 3,
      startHeadSha: 'a'.repeat(40),
      lastCommitSha: 'b'.repeat(40),
      foreignCommits: true,
      stats
    });

    expect(parseExportError(error)).toMatchObject({
      writeRequests: 3,
      lineage: {
        startHeadSha: 'a'.repeat(40),
        lastCommitSha: 'b'.repeat(40),
        foreignCommits: true
      }
    });
  });

  it('falls back to the message when details are missing', () => {
    let error = grpcError(9, {
      code: 'deletion_guard_tripped',
      message: 'refusing to delete',
      details: { paths: ['a.md'], total: 300, unexpectedDeletes: 300, scopeEntries: 1000 },
      commitsCreated: 0,
      stats
    });
    delete (error as any).details;

    expect(parseExportError(error)).toMatchObject({
      code: 'deletion_guard_tripped',
      details: { paths: ['a.md'], total: 300, unexpectedDeletes: 300, scopeEntries: 1000 },
      retryAfter: null
    });
  });

  it('keeps the remote state reported with a failure', () => {
    let newRemoteState = {
      commitSha: 'c'.repeat(40),
      treeSha: 't'.repeat(40),
      listingBucket: 'origin',
      listingKey: 'remote-state/osr_1/t.bin',
      entryCount: 12
    };
    let parsed = parseExportError(
      grpcError(8, { code: 'rate_limited', message: 'x', commitsCreated: 1, newRemoteState })
    );

    expect(parsed?.newRemoteState).toEqual(newRemoteState);
  });

  it('ignores fields it does not know', () => {
    let parsed = parseExportError(
      grpcError(9, { code: 'tree_too_large', message: 'x', futureField: { a: 1 } })
    );
    expect(parsed?.code).toBe('tree_too_large');
  });

  it.each([
    ['a plain provider error', new Error('failed to upload to GitHub: status 502')],
    [
      'malformed JSON',
      Object.assign(new Error('x'), { details: `${EXPORT_ERROR_PREFIX}{oops` })
    ],
    [
      'an unknown code',
      Object.assign(new Error('x'), {
        details: `${EXPORT_ERROR_PREFIX}${JSON.stringify({ code: 'brand_new', message: 'x' })}`
      })
    ],
    ['a non-error value', 42]
  ])('returns undefined for %s', (_name, error) => {
    expect(parseExportError(error)).toBeUndefined();
  });

  it.each([
    ['rate_limited', 'rate_limited', true],
    ['file_too_large', 'file_too_large', false],
    ['branch_missing', 'missing_branch', false],
    ['source_not_found', 'resource_not_found', false],
    ['manifest_invalid', 'invalid_request', false],
    ['content_mismatch', 'invalid_request', false],
    ['deletion_guard_tripped', 'invalid_request', false],
    ['tree_too_large', 'invalid_request', false],
    ['lfs_quota_exceeded', 'invalid_request', false],
    ['destination_too_large', 'invalid_request', false],
    ['path_conflict', 'invalid_request', false],
    ['unimplemented', 'invalid_request', false]
  ])('classifies %s as %s', (code, classification, retryable) => {
    let error = grpcError(9, { code, message: `${code} happened`, stats });

    expect(getScmProviderErrorDetails(error)).toMatchObject({
      classification,
      exportErrorCode: code,
      description: `${code} happened`
    });
    expect(isRetryableScmProviderError(error)).toBe(retryable);
  });

  it('keeps the legacy file-too-large detail working', () => {
    let error = grpcError(9, {
      code: 'file_too_large',
      message:
        'file exceeds the per-file size limit: assets/big.bin is 3221225472 bytes, limit is 2147483648 bytes',
      details: { path: 'assets/big.bin', size: 3221225472, limit: 2147483648 }
    });

    expect(getFileTooLargeDetail(error)).toBe(
      'assets/big.bin is 3221225472 bytes, limit is 2147483648 bytes'
    );
  });
});
