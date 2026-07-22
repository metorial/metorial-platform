import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  updateState: vi.fn()
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

import { logRepositorySyncQueueError, markRepositorySyncFailed } from './_lib';

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
});
