import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb, mockFunctionBay, mockGetTenantForFunctionBay, mockGetMetorialSolution } =
  vi.hoisted(() => ({
    mockDb: {
      enclave: {
        findMany: vi.fn()
      },
      enclaveIngressNetworkLog: {
        findMany: vi.fn()
      }
    },
    mockFunctionBay: {
      networkLog: {
        list: vi.fn()
      }
    },
    mockGetTenantForFunctionBay: vi.fn(),
    mockGetMetorialSolution: vi.fn()
  }));

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb
}));

vi.mock('../functionBay', () => ({
  functionBay: mockFunctionBay,
  getTenantForFunctionBay: mockGetTenantForFunctionBay
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: mockGetMetorialSolution
}));

import { enclaveNetworkLogService } from './enclaveNetworkLog';

let tenant = {
  oid: BigInt(10),
  id: 'ktn_test',
  functionBayTenantId: 'fb_tenant_1',
  functionBayTenantIdentifier: 'tenant-a'
} as any;
let environment = { oid: BigInt(20), id: 'ken_test' } as any;
let solution = { oid: BigInt(30), id: 'ksn_test' } as any;

let fbLogRecord = {
  bucketStart: '2026-05-29T10:00:00.000Z',
  tenantId: 'fb_tenant_1',
  functionId: 'fn_secret',
  effectiveFunctionId: 'fn_effective_secret',
  enclaveId: 'enc_backed',
  hostname: 'example.com',
  ip: '93.184.216.34',
  port: 443,
  count: 3,
  firstSeenAt: '2026-05-29T10:01:00.000Z',
  lastSeenAt: '2026-05-29T10:05:00.000Z'
};

describe('enclaveNetworkLogService.listNetworkLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantForFunctionBay.mockResolvedValue({ id: 'fb_tenant_1', identifier: 'tenant-a' });
    mockGetMetorialSolution.mockResolvedValue(solution);
  });

  it('returns empty records when no enclaves have Function Bay backing', async () => {
    mockDb.enclave.findMany.mockResolvedValueOnce([
      { oid: BigInt(1), id: 'enc_a', hasFunctionBayBacking: false },
      { oid: BigInt(2), id: 'enc_b', hasFunctionBayBacking: false }
    ]);

    let result = await enclaveNetworkLogService.listNetworkLogs({
      tenant,
      environment,
      direction: 'egress',
      filters: {}
    });

    expect(result).toEqual({
      object: 'enclave.network_logs',
      direction: 'egress',
      enclaveIds: [],
      records: []
    });
    expect(mockFunctionBay.networkLog.list).not.toHaveBeenCalled();
  });

  it('queries only backed enclaves when explicit enclaveIds are provided', async () => {
    mockDb.enclave.findMany.mockResolvedValueOnce([
      { oid: BigInt(1), id: 'enc_backed', hasFunctionBayBacking: true },
      { oid: BigInt(2), id: 'enc_unbacked', hasFunctionBayBacking: false }
    ]);
    mockFunctionBay.networkLog.list.mockResolvedValueOnce([fbLogRecord]);

    let result = await enclaveNetworkLogService.listNetworkLogs({
      tenant,
      environment,
      direction: 'egress',
      enclaveIds: ['enc_backed', 'enc_unbacked'],
      filters: { hostnames: ['example.com'] }
    });

    expect(mockFunctionBay.networkLog.list).toHaveBeenCalledWith({
      tenantId: 'fb_tenant_1',
      enclaveIds: ['enc_backed'],
      hostnames: ['example.com'],
      ips: undefined,
      from: undefined,
      to: undefined,
      intervalMinutes: undefined
    });
    expect(result.enclaveIds).toEqual(['enc_backed']);
    expect(result.records).toHaveLength(1);
  });

  it('loads all environment enclaves when enclaveIds are omitted', async () => {
    mockDb.enclave.findMany.mockResolvedValueOnce([
      { oid: BigInt(1), id: 'enc_backed', hasFunctionBayBacking: true },
      { oid: BigInt(2), id: 'enc_other', hasFunctionBayBacking: true }
    ]);
    mockFunctionBay.networkLog.list.mockResolvedValueOnce([]);

    await enclaveNetworkLogService.listNetworkLogs({
      tenant,
      environment,
      direction: 'egress',
      filters: {}
    });

    expect(mockDb.enclave.findMany).toHaveBeenCalledWith({
      where: {
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      },
      select: { oid: true, id: true, hasFunctionBayBacking: true },
      take: 500
    });
    expect(mockFunctionBay.networkLog.list).toHaveBeenCalledWith(
      expect.objectContaining({
        enclaveIds: ['enc_backed', 'enc_other']
      })
    );
  });

  it('throws not found when an explicit enclave id is missing', async () => {
    mockDb.enclave.findMany.mockResolvedValueOnce([
      { oid: BigInt(1), id: 'enc_backed', hasFunctionBayBacking: true }
    ]);

    await expect(
      enclaveNetworkLogService.listNetworkLogs({
        tenant,
        environment,
        direction: 'egress',
        enclaveIds: ['enc_backed', 'enc_missing'],
        filters: {}
      })
    ).rejects.toThrow(/enc_missing/);
  });

  it('strips Function Bay-only fields from records', async () => {
    mockDb.enclave.findMany.mockResolvedValueOnce([
      { oid: BigInt(1), id: 'enc_backed', hasFunctionBayBacking: true }
    ]);
    mockFunctionBay.networkLog.list.mockResolvedValueOnce([fbLogRecord]);

    let result = await enclaveNetworkLogService.listNetworkLogs({
      tenant,
      environment,
      direction: 'egress',
      enclaveIds: ['enc_backed'],
      filters: {}
    });

    expect(result.records[0]).toEqual({
      object: 'enclave.network_log',
      direction: 'egress',
      enclaveId: 'enc_backed',
      bucketStart: fbLogRecord.bucketStart,
      hostname: fbLogRecord.hostname,
      ip: fbLogRecord.ip,
      port: fbLogRecord.port,
      count: fbLogRecord.count,
      firstSeenAt: fbLogRecord.firstSeenAt,
      lastSeenAt: fbLogRecord.lastSeenAt
    });
    expect(result.records[0]).not.toHaveProperty('functionId');
    expect(result.records[0]).not.toHaveProperty('effectiveFunctionId');
    expect(result.records[0]).not.toHaveProperty('tenantId');
  });

  it('returns ingress logs from subspace-owned records', async () => {
    mockDb.enclave.findMany.mockResolvedValueOnce([
      { oid: BigInt(1), id: 'enc_backed', hasFunctionBayBacking: true }
    ]);
    mockDb.enclaveIngressNetworkLog.findMany.mockResolvedValueOnce([
      {
        enclaveOid: BigInt(1),
        sourceIp: '203.0.113.10',
        hostname: 'mcp.example.com',
        port: 443,
        result: 'denied',
        bucketStart: new Date('2026-05-29T10:00:00.000Z'),
        count: 2,
        firstSeenAt: new Date('2026-05-29T10:01:00.000Z'),
        lastSeenAt: new Date('2026-05-29T10:03:00.000Z')
      },
      {
        enclaveOid: BigInt(1),
        sourceIp: '203.0.113.10',
        hostname: 'mcp.example.com',
        port: 443,
        result: 'denied',
        bucketStart: new Date('2026-05-29T10:30:00.000Z'),
        count: 3,
        firstSeenAt: new Date('2026-05-29T10:31:00.000Z'),
        lastSeenAt: new Date('2026-05-29T10:35:00.000Z')
      }
    ]);

    let result = await enclaveNetworkLogService.listNetworkLogs({
      tenant,
      environment,
      direction: 'ingress',
      enclaveIds: ['enc_backed'],
      filters: { intervalMinutes: 60 }
    });

    expect(mockFunctionBay.networkLog.list).not.toHaveBeenCalled();
    expect(result).toEqual({
      object: 'enclave.network_logs',
      direction: 'ingress',
      enclaveIds: ['enc_backed'],
      records: [
        {
          object: 'enclave.network_log',
          direction: 'ingress',
          enclaveId: 'enc_backed',
          bucketStart: '2026-05-29T10:00:00.000Z',
          hostname: 'mcp.example.com',
          ip: '203.0.113.10',
          port: 443,
          count: 5,
          result: 'denied',
          firstSeenAt: '2026-05-29T10:01:00.000Z',
          lastSeenAt: '2026-05-29T10:35:00.000Z'
        }
      ]
    });
  });
});
