import { badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it } from 'vitest';

let mocks = vi.hoisted(() => ({
  captureException: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: mocks.captureException })
}));

import { withScmProviderError, wrapScmProviderError } from './scmProviderError';

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
    expect(mapped.message).not.toContain('network failure');
  });

  it('preserves existing ServiceErrors', async () => {
    let serviceError = new ServiceError(badRequestError({ message: 'Known validation error' }));

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

  it('does not report expected provider 4xx responses to Sentry', () => {
    wrapScmProviderError('gitlab', { response: { status: 400 } }, 'refresh the OAuth token');

    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('reports unexpected provider failures to Sentry as Errors', () => {
    wrapScmProviderError('gitlab', { response: { status: 500 } }, 'refresh the OAuth token');

    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error));
  });
});
