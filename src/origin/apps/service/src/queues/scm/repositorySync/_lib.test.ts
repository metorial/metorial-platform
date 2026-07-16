import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  updateMany: vi.fn()
}));

vi.mock('../../../db', () => ({
  db: {
    scmRepositorySync: {
      updateMany: mocks.updateMany
    }
  }
}));

import { logRepositorySyncQueueError, markRepositorySyncFailed } from './_lib';

describe('repository sync failure diagnostics', () => {
  beforeEach(() => {
    mocks.updateMany.mockReset();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    vi.restoreAllMocks();
  });

  it('stores the classified provider message without a JavaScript stack trace', async () => {
    let error = Object.assign(
      new Error(
        'GitLab could not create the update branch. HTTP status: 400. Provider response: Cannot create protected branch.'
      ),
      {
        stack: 'Error: provider failure\n at internal.js:10:2'
      }
    );

    await markRepositorySyncFailed('sync_123', error);

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage:
            'GitLab could not create the update branch. HTTP status: 400. Provider response: Cannot create protected branch.'
        })
      })
    );
    expect(JSON.stringify(mocks.updateMany.mock.calls)).not.toContain('internal.js');
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
});
