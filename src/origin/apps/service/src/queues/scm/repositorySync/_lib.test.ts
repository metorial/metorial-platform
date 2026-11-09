import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  updateState: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({
    captureException: mocks.captureException,
    captureMessage: mocks.captureMessage
  })
}));
vi.mock('../../../db', () => ({
  db: {
    scmRepositorySync: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique
    }
  }
}));
vi.mock('../../../services/repositorySyncState', () => ({
  isTerminalRepositorySyncStatus: () => false,
  transitionRepositorySyncState: mocks.updateState
}));

import {
  getRepositorySyncFailureLevel,
  logRepositorySyncQueueError,
  markRepositorySyncFailed,
  getRepositorySyncContentsRetryDelayMs,
  reportRepositorySyncFailure,
  shouldRetryRepositorySyncContents
} from './_lib';

describe('repository sync failure reporting', () => {
  let sync = {
    id: 'sync_report',
    status: 'syncing_contents' as const,
    sourceType: 'manifest' as const,
    sourceKey: 'skd_123',
    requestKey: 'skdp_123',
    repositoryAccessMode: 'pull_request' as const
  };

  beforeEach(() => {
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
    mocks.updateState.mockReset();
    mocks.updateState.mockResolvedValue({});
    mocks.findUnique.mockReset();
    mocks.findUnique.mockResolvedValue(sync);
  });

  it.each([
    ['protected_branch', null],
    ['permission_denied', null],
    ['deletion_guard_tripped', null],
    ['destination_too_large', null],
    ['rate_limited', 'warning'],
    ['no_progress', 'warning'],
    ['manifest_invalid', 'error'],
    ['source_not_found', 'error'],
    ['network_failure', 'error'],
    ['something_new', 'error']
  ])('reports %s at level %s', (errorCode, level) => {
    expect(getRepositorySyncFailureLevel(errorCode)).toBe(level);
  });

  it('captures unexpected failures with grouping tags and the original error', async () => {
    let error = new TypeError("Cannot read properties of undefined (reading 'sha')");

    await markRepositorySyncFailed(sync.id, error);

    expect(mocks.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        level: 'error',
        fingerprint: ['repository-sync', 'network_failure'],
        tags: expect.objectContaining({
          area: 'repository_sync',
          'repository_sync.error_code': 'network_failure',
          'repository_sync.stage': 'syncing_contents',
          'repository_sync.source_type': 'manifest'
        }),
        extra: expect.objectContaining({ syncId: sync.id, requestKey: 'skdp_123' })
      })
    );
  });

  it('does not report failures the repository owner has to fix', async () => {
    await markRepositorySyncFailed(
      sync.id,
      Object.assign(new Error('Protected branch update rejected'), { status: 403 })
    );

    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it('does not report when another worker already ended the sync', async () => {
    mocks.updateState.mockResolvedValue(null);

    await markRepositorySyncFailed(sync.id, new TypeError('boom'));

    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('reports failures without an error object as messages', () => {
    reportRepositorySyncFailure({
      sync,
      errorCode: 'sync_lifetime_exceeded',
      errorMessage: 'The repository update took too long.'
    });

    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Repository sync failed (sync_lifetime_exceeded): The repository update took too long.',
      expect.objectContaining({
        level: 'warning',
        fingerprint: ['repository-sync', 'sync_lifetime_exceeded']
      })
    );
  });
});

describe('repository sync failure diagnostics', () => {
  beforeEach(() => {
    mocks.updateMany.mockReset();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUnique.mockReset();
    mocks.findUnique.mockResolvedValue({ status: 'waiting_for_ci' });
    mocks.updateState.mockReset();
    mocks.updateState.mockResolvedValue({});
    vi.restoreAllMocks();
  });

  it('stores the short classified provider message without lowerdeck decoration', async () => {
    let error = Object.assign(
      new Error(
        '[@lowerdeck/error]: GitLab could not create the update branch: the request was rejected. ({"status":400,"code":"bad_request"})'
      ),
      {
        stack: 'Error: provider failure\n at internal.js:10:2',
        data: {
          message: 'GitLab could not create the update branch: the request was rejected.'
        }
      }
    );

    await markRepositorySyncFailed('sync_123', error);

    expect(mocks.updateState).toHaveBeenCalledWith(
      'sync_123',
      'waiting_for_ci',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'GitLab could not create the update branch: the request was rejected.'
      })
    );
    expect(JSON.stringify(mocks.updateState.mock.calls)).not.toContain('internal.js');
  });

  it('strips gRPC rpc prefixes from stored export errors', async () => {
    mocks.findUnique.mockResolvedValue({
      status: 'syncing_contents',
      repositoryAccessMode: 'pull_request'
    });

    let error = Object.assign(
      new Error(
        '/rpc.rpc.CodeBucket/ExportBucketToGitlab FAILED_PRECONDITION: failed to upload to GitLab: file exceeds the per-file size limit: plugins/code-review/skills/code-review/1/test_100.bin is 100.0 MiB, over the 64.0 MiB per-file limit for GitLab export'
      ),
      {
        code: 9,
        details:
          'failed to upload to GitLab: file exceeds the per-file size limit: plugins/code-review/skills/code-review/1/test_100.bin is 100.0 MiB, over the 64.0 MiB per-file limit for GitLab export'
      }
    );

    await markRepositorySyncFailed('sync_too_large', error);

    expect(mocks.updateState).toHaveBeenCalledWith(
      'sync_too_large',
      'syncing_contents',
      expect.objectContaining({
        status: 'failed',
        errorMessage:
          'Failed to upload to GitLab: file exceeds the per-file size limit: plugins/code-review/skills/code-review/1/test_100.bin is 100.0 MiB, over the 64.0 MiB per-file limit for GitLab export'
      })
    );
  });

  it('logs structured provider details without serializing the stack', () => {
    let consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let error = Object.assign(new Error('403 Forbidden'), {
      stack: 'Error: 403 Forbidden\n at internal.js:10:2',
      cause: {
        description: '403 Forbidden',
        request: {
          method: 'POST',
          url: 'https://gitlab.com/api/v4/projects/123/repository/branches'
        },
        response: { statusCode: 403 }
      }
    });

    logRepositorySyncQueueError('createBranch', 'failed', error, {
      syncId: 'sync_123'
    });

    let output = String(consoleError.mock.calls[0]?.[0]);
    expect(output).toContain('"status":403');
    expect(output).toContain('"syncId":"sync_123"');
    expect(output).not.toContain('internal.js');
  });

  it('stores actionable protected-branch guidance for direct pushes', async () => {
    mocks.findUnique.mockResolvedValue({
      status: 'syncing_contents',
      repositoryAccessMode: 'default_branch'
    });
    let error = Object.assign(new Error('Protected branch update rejected'), {
      status: 403
    });

    await markRepositorySyncFailed('sync_direct', error);

    expect(mocks.updateState).toHaveBeenCalledWith(
      'sync_direct',
      'syncing_contents',
      expect.objectContaining({
        status: 'failed',
        errorMessage:
          'Direct push was blocked by repository rules. Use pull requests or allow writes to the default branch.'
      })
    );
  });

  it('stores protected-branch guidance for code-bucket gRPC failures', async () => {
    mocks.findUnique.mockResolvedValue({
      status: 'syncing_contents',
      repositoryAccessMode: 'default_branch'
    });
    let details =
      'failed to upload to GitLab: failed to create commit (status 403): {"message":"403 Forbidden - You are not allowed to push into this branch"}';
    let error = Object.assign(
      new Error(`/rpc.rpc.CodeBucket/ExportBucketToGitlab INTERNAL: ${details}`),
      {
        code: 13,
        details
      }
    );

    await markRepositorySyncFailed('sync_direct_grpc', error);

    expect(mocks.updateState).toHaveBeenCalledWith(
      'sync_direct_grpc',
      'syncing_contents',
      expect.objectContaining({
        status: 'failed',
        errorMessage:
          'Direct push was blocked by repository rules. Use pull requests or allow writes to the default branch.'
      })
    );
  });

  // Readers tell "retrying" from "failed" by whether nextPollAt is still set
  // next to errorMessage, so a terminal failure has to clear it.
  it('clears the next poll when a sync fails terminally', async () => {
    mocks.findUnique.mockResolvedValue({
      status: 'syncing_contents',
      repositoryAccessMode: 'pull_request'
    });

    await markRepositorySyncFailed('sync_terminal', new Error('file is too large'));

    expect(mocks.updateState).toHaveBeenCalledWith(
      'sync_terminal',
      'syncing_contents',
      expect.objectContaining({ status: 'failed', nextPollAt: null })
    );
  });

  it('does not retry permanent code-bucket failures', () => {
    let permanentError = {
      code: 7,
      details:
        'failed to upload to GitLab: failed to create commit (status 403): not allowed to push'
    };

    expect(
      shouldRetryRepositorySyncContents({
        repositoryAccessMode: 'default_branch',
        status: 'syncing_contents',
        attemptCount: 0,
        error: permanentError
      })
    ).toBe(false);
  });

  it('retries a GitHub secondary rate limit with a long delay', () => {
    let rateLimited = {
      code: 9,
      details:
        'failed to upload to GitHub: POST https://api.github.com/repos/o/r/git/blobs failed (status 403): {"message":"You have exceeded a secondary rate limit."}'
    };

    expect(
      shouldRetryRepositorySyncContents({
        repositoryAccessMode: 'default_branch',
        status: 'syncing_contents',
        attemptCount: 4,
        error: rateLimited
      })
    ).toBe(true);
    expect(
      getRepositorySyncContentsRetryDelayMs({ attemptCount: 1, error: rateLimited })
    ).toBe(120_000);
  });

  it('does not retry a file that is too large to export', () => {
    let oversized = {
      code: 9,
      details:
        'failed to upload to GitHub: file exceeds the per-file size limit: big.bin is 4.0 GiB, over the 2.0 GiB per-file limit for GitHub export'
    };

    expect(
      shouldRetryRepositorySyncContents({
        repositoryAccessMode: 'default_branch',
        status: 'syncing_contents',
        attemptCount: 0,
        error: oversized
      })
    ).toBe(false);
  });

  it.each([
    { code: 14, details: 'provider unavailable' },
    { status: 409, description: 'branch changed' }
  ])('retries transient and conflict failures', error => {
    expect(
      shouldRetryRepositorySyncContents({
        repositoryAccessMode: 'default_branch',
        status: 'syncing_contents',
        attemptCount: 0,
        error
      })
    ).toBe(true);
  });

  it('retries transient code-bucket failures for pull-request syncs', () => {
    let error = Object.assign(
      new Error(
        '/rpc.rpc.CodeBucket/ExportBucketToGitlab INTERNAL: failed to get file info: http2: server sent GOAWAY and closed the connection; ErrCode=ENHANCE_YOUR_CALM'
      ),
      { code: 13 }
    );

    expect(
      shouldRetryRepositorySyncContents({
        repositoryAccessMode: 'pull_request',
        status: 'syncing_contents',
        attemptCount: 0,
        error
      })
    ).toBe(true);
  });

  it('does not retry branch conflicts for pull-request syncs', () => {
    expect(
      shouldRetryRepositorySyncContents({
        repositoryAccessMode: 'pull_request',
        status: 'syncing_contents',
        attemptCount: 0,
        error: { status: 409, description: 'branch changed' }
      })
    ).toBe(false);
  });
});
