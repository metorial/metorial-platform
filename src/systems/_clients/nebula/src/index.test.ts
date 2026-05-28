import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockRegister = vi.fn();
let mockRefresh = vi.fn();
let mockSecretUse = vi.fn();

vi.mock('@lowerdeck/rpc-client', () => ({
  createClient: () => ({
    tenant: {},
    consumer: {
      register: mockRegister,
      refresh: mockRefresh
    },
    keyProvider: {},
    keyProviderError: {},
    secret: {
      list: vi.fn(),
      get: vi.fn(),
      listVersions: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      use: mockSecretUse,
      disable: vi.fn()
    }
  })
}));

import { createNebulaClient } from './index';

describe('createNebulaClient', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRegister.mockReset();
    mockRefresh.mockReset();
    mockSecretUse.mockReset();
    mockSecretUse.mockResolvedValue(undefined);
  });

  it('re-registers when refresh fails after the token expires', async () => {
    vi.useFakeTimers();
    let now = new Date('2025-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    let activeToken = {
      token: 'active-token',
      consumerInstanceId: 'consumer-instance-1',
      expiresAt: new Date(now.getTime() + 3_600_000)
    };
    let freshToken = {
      token: 'fresh-token',
      consumerInstanceId: 'consumer-instance-2',
      expiresAt: new Date(now.getTime() + 7_200_000)
    };

    mockRegister.mockResolvedValueOnce(activeToken).mockResolvedValueOnce(freshToken);
    mockRefresh.mockRejectedValueOnce(new Error('Consumer token is invalid'));

    let client = createNebulaClient({
      endpoint: 'http://nebula:52170/metorial-nebula',
      consumerToken: 'consumer-secret',
      identifier: 'worker-a',
      refreshSkewMs: 60_000
    });

    await vi.waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));

    await client.secret.use({
      tenantId: 'tenant-1',
      secretId: 'secret-1',
      proof: {}
    });

    vi.setSystemTime(new Date(now.getTime() + 3_600_001));

    await client.secret.use({
      tenantId: 'tenant-1',
      secretId: 'secret-1',
      proof: {}
    });

    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith({
      secret: 'consumer-secret',
      token: 'active-token'
    });
    expect(mockSecretUse).toHaveBeenLastCalledWith({
      tenantId: 'tenant-1',
      secretId: 'secret-1',
      proof: {},
      consumerToken: 'fresh-token'
    });
  });

  it('refreshes proactively before token expiry', async () => {
    vi.useFakeTimers();
    let now = new Date('2025-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    let activeToken = {
      token: 'active-token',
      consumerInstanceId: 'consumer-instance-1',
      expiresAt: new Date(now.getTime() + 3_600_000)
    };
    let refreshedToken = {
      token: 'refreshed-token',
      consumerInstanceId: 'consumer-instance-1',
      expiresAt: new Date(now.getTime() + 7_200_000)
    };

    mockRegister.mockResolvedValueOnce(activeToken);
    mockRefresh.mockResolvedValueOnce(refreshedToken);

    let client = createNebulaClient({
      endpoint: 'http://nebula:52170/metorial-nebula',
      consumerToken: 'consumer-secret',
      identifier: 'worker-a',
      refreshSkewMs: 60_000
    });

    await vi.waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));

    await client.secret.use({
      tenantId: 'tenant-1',
      secretId: 'secret-1',
      proof: {}
    });

    vi.setSystemTime(new Date(now.getTime() + 3_540_001));

    await client.secret.use({
      tenantId: 'tenant-1',
      secretId: 'secret-1',
      proof: {}
    });

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith({
      secret: 'consumer-secret',
      token: 'active-token'
    });
    expect(mockSecretUse).toHaveBeenLastCalledWith({
      tenantId: 'tenant-1',
      secretId: 'secret-1',
      proof: {},
      consumerToken: 'refreshed-token'
    });
  });

  it('registers immediately when the client is created', async () => {
    mockRegister.mockResolvedValueOnce({
      token: 'active-token',
      consumerInstanceId: 'consumer-instance-1',
      expiresAt: new Date(Date.now() + 3_600_000)
    });

    createNebulaClient({
      endpoint: 'http://nebula:52170/metorial-nebula',
      consumerToken: 'consumer-secret',
      identifier: 'worker-a'
    });

    await vi.waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister).toHaveBeenCalledWith({
      secret: 'consumer-secret',
      identifier: 'worker-a'
    });
  });
});
