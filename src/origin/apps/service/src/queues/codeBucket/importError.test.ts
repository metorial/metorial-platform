import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  updateMany: vi.fn(),
  delay: vi.fn(async () => undefined)
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: mocks.captureException })
}));

vi.mock('@lowerdeck/delay', () => ({
  delay: mocks.delay
}));

vi.mock('../../db', () => ({
  db: {
    codeBucket: {
      updateMany: mocks.updateMany
    }
  }
}));

import {
  getCodeBucketImportFailureMessage,
  runCodeBucketImport
} from './importError';

describe('code bucket import errors', () => {
  beforeEach(() => {
    mocks.captureException.mockClear();
    mocks.updateMany.mockClear();
    mocks.delay.mockClear();
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('maps repository download 404s to a clear failure message', () => {
    let error = Object.assign(
      new Error(
        '/rpc.rpc.CodeBucket/CreateBucketFromGithub INTERNAL: failed to download GitHub repository: failed to download zip: bad status: 404 Not Found'
      ),
      {
        code: 13,
        details:
          'failed to download GitHub repository: failed to download zip: bad status: 404 Not Found'
      }
    );

    expect(getCodeBucketImportFailureMessage('github', error)).toBe(
      'GitHub repository was not found. It may have been deleted, renamed, or the installation may lack access.'
    );
  });

  it('maps gRPC NotFound import failures without reporting to Sentry', async () => {
    let error = Object.assign(
      new Error(
        '/rpc.rpc.CodeBucket/CreateBucketFromGithub NOT_FOUND: failed to download GitHub repository: failed to download zip: bad status: 404 Not Found'
      ),
      {
        code: 5,
        details:
          'failed to download GitHub repository: failed to download zip: bad status: 404 Not Found'
      }
    );

    await runCodeBucketImport({
      provider: 'github',
      bucketId: 'bucket_123',
      context: { owner: 'acme', repo: 'missing' },
      importFn: async () => {
        throw error;
      }
    });

    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'bucket_123' },
      data: {
        status: 'failed',
        errorMessage:
          'GitHub repository was not found. It may have been deleted, renamed, or the installation may lack access.'
      }
    });
  });

  it('handles legacy INTERNAL 404 download failures without reporting to Sentry', async () => {
    let error = Object.assign(
      new Error(
        '/rpc.rpc.CodeBucket/CreateBucketFromGithub INTERNAL: failed to download GitHub repository: failed to download zip: bad status: 404 Not Found'
      ),
      {
        code: 13,
        details:
          'failed to download GitHub repository: failed to download zip: bad status: 404 Not Found'
      }
    );

    await runCodeBucketImport({
      provider: 'github',
      bucketId: 'bucket_456',
      importFn: async () => {
        throw error;
      }
    });

    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'bucket_456' },
      data: {
        status: 'failed',
        errorMessage:
          'GitHub repository was not found. It may have been deleted, renamed, or the installation may lack access.'
      }
    });
  });

  it('rethrows retryable provider failures so the queue can retry', async () => {
    let error = Object.assign(new Error('provider unavailable'), {
      response: { status: 503 }
    });

    await expect(
      runCodeBucketImport({
        provider: 'github',
        bucketId: 'bucket_123',
        importFn: async () => {
          throw error;
        }
      })
    ).rejects.toMatchObject({
      data: {
        status: 500
      }
    });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('marks the bucket ready after a successful import', async () => {
    await runCodeBucketImport({
      provider: 'github',
      bucketId: 'bucket_123',
      importFn: async () => undefined
    });

    expect(mocks.delay).toHaveBeenCalledWith(2000);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'bucket_123' },
      data: { status: 'ready', errorMessage: null }
    });
  });
});
