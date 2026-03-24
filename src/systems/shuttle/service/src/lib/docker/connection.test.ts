import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBearerToken } from './connection';

vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('fetchBearerToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to anonymous token request when credentialed request is denied', async () => {
    let axiosGet = vi.mocked(axios.get);

    axiosGet.mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          errors: [{ message: 'requested access to the resource is denied' }]
        }
      }
    });

    axiosGet.mockResolvedValueOnce({
      data: { token: 'anon-token' }
    } as any);

    let token = await fetchBearerToken(
      {
        realm: 'https://ghcr.io/token',
        service: 'ghcr.io',
        scope: 'repository:metorial/object-storage:pull'
      },
      {
        username: 'bad-user',
        password: 'bad-password'
      }
    );

    expect(token).toBe('anon-token');
    expect(axiosGet).toHaveBeenCalledTimes(2);

    let firstCallConfig = axiosGet.mock.calls[0]?.[1] as any;
    let secondCallConfig = axiosGet.mock.calls[1]?.[1] as any;

    expect(firstCallConfig.auth).toEqual({ username: 'bad-user', password: 'bad-password' });
    expect(secondCallConfig.auth).toBeUndefined();
  });

  it('does not retry anonymously for non-auth failures', async () => {
    let axiosGet = vi.mocked(axios.get);

    axiosGet.mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          errors: [{ message: 'internal error' }]
        }
      }
    });

    await expect(
      fetchBearerToken(
        {
          realm: 'https://ghcr.io/token',
          service: 'ghcr.io',
          scope: 'repository:metorial/forge:pull'
        },
        {
          username: 'user',
          password: 'pass'
        }
      )
    ).rejects.toThrow('Failed to fetch bearer token: internal error');

    expect(axiosGet).toHaveBeenCalledTimes(1);
  });
});
