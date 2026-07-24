import { badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it } from 'vitest';

let mocks = vi.hoisted(() => ({
  captureException: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: mocks.captureException })
}));

import {
  formatScmProviderError,
  getScmProviderErrorDetails,
  getScmProviderLogDetails,
  isRetryableScmProviderError,
  withScmProviderError,
  wrapScmProviderError
} from './scmProviderError';

describe('SCM provider errors', () => {
  beforeEach(() => {
    mocks.captureException.mockClear();
  });

  it.each([
    [{ status: 401 }, 401, 'unauthorized'],
    [{ cause: { response: { status: 401 } } }, 401, 'unauthorized'],
    [{ response: { status: 403 } }, 403, 'forbidden'],
    [{ cause: { response: { statusCode: 404 } } }, 404, 'not_found'],
    [{ status: 409 }, 409, 'conflict'],
    [{ response: { status: 422 } }, 400, 'bad_request'],
    [{ status: 429 }, 429, 'too_many_requests'],
    [new Error('network failure'), 500, 'internal_server_error']
  ])('maps provider failures to structured errors', (error, status, code) => {
    let mapped = wrapScmProviderError('gitlab', error, 'list repositories');

    expect(mapped.data.status).toBe(status);
    expect(mapped.data.code).toBe(code);
    expect(mapped.message).toContain('GitLab could not list repositories');
  });

  it('preserves existing ServiceErrors', async () => {
    let serviceError = new ServiceError(
      badRequestError({ message: 'Known validation error' })
    );

    await expect(
      withScmProviderError('github', 'create repository', async () => {
        throw serviceError;
      })
    ).rejects.toBe(serviceError);
  });

  it('retains the provider failure for observability', () => {
    let providerError = new Error('provider request failed');
    let mapped = wrapScmProviderError('github', providerError, 'load repositories');

    expect(mapped.parent).toBe(providerError);
  });

  it('keeps the public error short while retaining full structured log details', () => {
    let mapped = wrapScmProviderError(
      'gitlab',
      {
        cause: {
          description: 'The branch name must match ^[a-z0-9-]{1,63}$',
          request: {
            method: 'POST',
            url: 'https://gitlab.com/api/v4/projects/123/repository/branches'
          },
          response: { statusCode: 400 }
        }
      },
      'create the update branch',
      {
        context: {
          projectId: 123,
          targetBranch: 'metorial/sync-1'
        },
        remediation: 'Use a branch name accepted by the project push rules.'
      }
    );

    expect(mapped.data.message).toBe(
      'GitLab could not create the update branch: the request was rejected.'
    );
    expect(mapped.data.message).not.toContain('projectId');
    expect(mapped.data.message).not.toContain('regular expression');
    expect(getScmProviderLogDetails(mapped)).toMatchObject({
      status: 400,
      classification: 'invalid_request',
      context: {
        projectId: 123,
        targetBranch: 'metorial/sync-1'
      },
      diagnostic: expect.stringContaining('The branch name must match')
    });
  });

  it('does not report expected provider 4xx responses to Sentry', () => {
    wrapScmProviderError('gitlab', { response: { status: 400 } }, 'refresh the OAuth token');

    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('reports unexpected provider failures to Sentry as Errors', () => {
    wrapScmProviderError('gitlab', { response: { status: 500 } }, 'refresh the OAuth token');

    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('extracts GitBeaker request details without query parameters or headers', () => {
    let details = getScmProviderErrorDetails({
      cause: {
        description: 'Cannot create branch',
        request: {
          method: 'POST',
          url: 'https://gitlab.com/api/v4/projects/123/repository/branches?private_token=secret',
          headers: { authorization: 'Bearer secret' }
        },
        response: {
          statusCode: 400,
          headers: new Headers({ 'x-request-id': 'request-123' })
        }
      }
    });

    expect(details).toEqual({
      status: 400,
      description: 'Cannot create branch',
      method: 'POST',
      endpoint: 'https://gitlab.com/api/v4/projects/123/repository/branches',
      requestId: 'request-123',
      classification: 'invalid_request'
    });
  });

  it.each([
    [
      'gitlab',
      `failed to upload to GitLab: failed to create commit (status 403): {"message":"403 Forbidden - You are not allowed to push into this branch"}`,
      'protected_branch'
    ],
    [
      'github',
      `failed to upload to GitHub: update reference failed (status 403): {"message":"Resource not accessible by integration"}`,
      'permission_denied'
    ],
    [
      'bitbucket',
      `failed to upload to Bitbucket Cloud: source upload failed (status 403): branch restriction rejected the push`,
      'protected_branch'
    ]
  ])('classifies %s code-bucket 403 details', (_provider, details, classification) => {
    let error = Object.assign(new Error(`/rpc.CodeBucket/Export INTERNAL: ${details}`), {
      code: 13,
      details
    });

    expect(getScmProviderErrorDetails(error)).toMatchObject({
      status: 403,
      description: details,
      classification
    });
    expect(isRetryableScmProviderError(error)).toBe(false);
  });

  it('uses semantic gRPC codes when no HTTP status is available', () => {
    expect(
      getScmProviderErrorDetails({
        code: 7,
        details: 'The integration cannot write to this repository.'
      }).classification
    ).toBe('permission_denied');
    expect(
      isRetryableScmProviderError({
        code: 14,
        details: 'The repository provider is unavailable.'
      })
    ).toBe(true);
  });

  it('formats detailed diagnostics without JavaScript stacks or credentials', () => {
    let message = formatScmProviderError({
      provider: 'gitlab',
      operation: 'create the update branch',
      error: {
        stack: 'GitbeakerRequestError: 400\n at internal.js:10:2',
        cause: {
          description: 'authorization=secret Bearer abc.def',
          request: {
            method: 'POST',
            url: 'https://gitlab.com/api/v4/projects/123/repository/branches?access_token=secret'
          },
          response: { statusCode: 400 }
        }
      },
      context: {
        projectId: 123,
        baseBranch: 'main',
        targetBranch: 'metorial/sync-1'
      },
      remediation: 'Check protected branch rules.'
    });

    expect(message).toContain('HTTP status: 400');
    expect(message).toContain('authorization=[redacted]');
    expect(message).toContain('projectId=123');
    expect(message).toContain('Check protected branch rules');
    expect(message).not.toContain('internal.js');
    expect(message).not.toContain('abc.def');
    expect(message).not.toContain('access_token=secret');
  });
});
