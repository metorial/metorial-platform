import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  list: vi.fn(),
  createNetworkLogsClient: vi.fn(),
  fetch: vi.fn(),
  env: {
    observer: { OBSERVER_QUERY_URL: undefined as string | undefined },
    networkLogs: {
      NETWORK_LOGS_URL: undefined as string | undefined,
      NETWORK_LOGS_TOKEN_FILE: undefined as string | undefined,
      NETWORK_LOGS_RPC_SECRET: undefined as string | undefined
    }
  }
}));

vi.mock('@metorial-platform-systems/network-logs-client', () => ({
  createNetworkLogsClient: mocks.createNetworkLogsClient
}));

vi.mock('../env', () => ({ env: mocks.env }));

let loadService = async () => {
  vi.resetModules();
  return (await import('./networkLog')).networkLogService;
};

describe('networkLogService', () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.fetch.mockReset();
    mocks.createNetworkLogsClient.mockReset();
    mocks.createNetworkLogsClient.mockReturnValue({ observation: { list: mocks.list } });
    mocks.env.observer.OBSERVER_QUERY_URL = undefined;
    mocks.env.networkLogs = {
      NETWORK_LOGS_URL: undefined,
      NETWORK_LOGS_TOKEN_FILE: undefined,
      NETWORK_LOGS_RPC_SECRET: undefined
    };
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('queries the log store and maps observations to network log records', async () => {
    mocks.env.networkLogs.NETWORK_LOGS_URL = 'http://network-logs.local';
    mocks.env.networkLogs.NETWORK_LOGS_TOKEN_FILE = '/var/run/token';
    mocks.list.mockResolvedValue({
      records: [
        {
          bucketStart: new Date('2026-11-13T10:00:00.000Z'),
          tenantId: 'tenant_1',
          functionId: 'function_1',
          effectiveFunctionId: 'function_2',
          enclaveId: 'enclave_1',
          hostname: 'api.example.com',
          ip: '93.184.216.34',
          port: 443,
          decision: 'allowed',
          source: 'knative',
          count: 3,
          firstSeenAt: new Date('2026-11-13T10:01:00.000Z'),
          lastSeenAt: new Date('2026-11-13T10:04:00.000Z')
        }
      ]
    });

    let service = await loadService();
    let records = await service.listNetworkLogs({
      tenantId: 'tenant_1',
      functionIds: ['function_1'],
      enclaveIds: ['enclave_1'],
      from: '2026-11-13T00:00:00.000Z',
      intervalMinutes: 5
    });

    expect(mocks.createNetworkLogsClient).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://network-logs.local',
        tokenFile: '/var/run/token'
      })
    );
    expect(mocks.list).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      functionIds: ['function_1'],
      enclaveIds: ['enclave_1'],
      hostnames: undefined,
      ips: undefined,
      decision: 'allowed',
      from: new Date('2026-11-13T00:00:00.000Z'),
      to: undefined,
      intervalMinutes: 5
    });
    expect(records).toEqual([
      {
        bucketStart: '2026-11-13T10:00:00.000Z',
        tenantId: 'tenant_1',
        functionId: 'function_1',
        effectiveFunctionId: 'function_2',
        enclaveId: 'enclave_1',
        hostname: 'api.example.com',
        ip: '93.184.216.34',
        port: 443,
        count: 3,
        firstSeenAt: '2026-11-13T10:01:00.000Z',
        lastSeenAt: '2026-11-13T10:04:00.000Z'
      }
    ]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('signs requests with the shared secret when one is configured', async () => {
    mocks.env.networkLogs.NETWORK_LOGS_URL = 'http://network-logs.local';
    mocks.env.networkLogs.NETWORK_LOGS_TOKEN_FILE = '/var/run/token';
    mocks.env.networkLogs.NETWORK_LOGS_RPC_SECRET = 'shared-secret';
    mocks.list.mockResolvedValue({ records: [] });

    let service = await loadService();
    await service.listNetworkLogs({ tenantId: 'tenant_1' });

    let opts = mocks.createNetworkLogsClient.mock.calls[0]![0];
    expect(opts.tokenFile).toBeUndefined();
    expect(opts.getSignatureToken()).toBe('shared-secret');
  });

  it('falls back to the legacy observer when only it is configured', async () => {
    mocks.env.observer.OBSERVER_QUERY_URL = 'http://observer.local';
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ records: [{ hostname: 'example.com' }] }))
    );

    let service = await loadService();
    let records = await service.listNetworkLogs({
      tenantId: 'tenant_1',
      functionIds: ['function_1']
    });

    let url = new URL(mocks.fetch.mock.calls[0]![0]);
    expect(url.pathname).toBe('/logs');
    expect(url.searchParams.getAll('functionId[]')).toEqual(['function_1']);
    expect(records).toEqual([{ hostname: 'example.com' }]);
    expect(mocks.createNetworkLogsClient).not.toHaveBeenCalled();
  });

  it('returns no records when nothing is configured', async () => {
    let service = await loadService();

    expect(await service.listNetworkLogs({ tenantId: 'tenant_1' })).toEqual([]);
  });
});
