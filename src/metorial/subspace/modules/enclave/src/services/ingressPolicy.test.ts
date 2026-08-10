import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb, mockEnclaveService, mockRecordIngressNetworkLog } = vi.hoisted(() => ({
  mockDb: {
    session: {
      findMany: vi.fn()
    },
    ephemeralManagedSession: {
      findMany: vi.fn()
    }
  },
  mockEnclaveService: {
    getCompiledNetworkRules: vi.fn()
  },
  mockRecordIngressNetworkLog: vi.fn()
}));

vi.mock('@metorial-subspace/db', async () => ({
  db: mockDb
}));

vi.mock('./enclave', () => ({
  enclaveService: mockEnclaveService
}));

vi.mock('../lib/ingressNetworkLogBuffer', () => ({
  recordIngressNetworkLog: mockRecordIngressNetworkLog
}));

import { enclaveIngressPolicyService } from './ingressPolicy';

let tenant = { oid: BigInt(10), id: 'ktn_test' } as any;
let environment = { oid: BigInt(20), id: 'ken_test' } as any;
let solution = { oid: 30, id: 'ksn_test' } as any;
let enclave = {
  oid: BigInt(40),
  id: 'enc_test',
  compiledNetworkRules: null
} as any;

describe('enclaveIngressPolicyService.checkSessionIngressAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.ephemeralManagedSession.findMany.mockResolvedValue([]);
  });

  it('allows sessions when all linked enclave ingress policies allow the source IP', async () => {
    mockDb.session.findMany.mockResolvedValueOnce([
      {
        id: 'ses_test',
        providers: [{ deployment: { enclave } }]
      }
    ]);
    mockEnclaveService.getCompiledNetworkRules.mockResolvedValueOnce({
      ingress: { direction: 'ingress', entries: [{ cidr: '203.0.113.0/24' }] },
      egress: { direction: 'egress', entries: [] }
    });

    let result = await enclaveIngressPolicyService.checkSessionIngressAccess({
      tenant,
      environment,
      solution,
      sessionIds: ['ses_test'],
      sourceIp: '203.0.113.10'
    });

    expect(result.results).toEqual([
      {
        sessionId: 'ses_test',
        resolvedSessionId: 'ses_test',
        allowed: true,
        enclaveIds: ['enc_test'],
        deniedEnclaveIds: []
      }
    ]);
  });

  it('denies sessions when any linked enclave ingress policy denies the source IP', async () => {
    mockDb.session.findMany.mockResolvedValueOnce([
      {
        id: 'ses_test',
        providers: [{ deployment: { enclave } }]
      }
    ]);
    mockEnclaveService.getCompiledNetworkRules.mockResolvedValueOnce({
      ingress: { direction: 'ingress', entries: [{ cidr: '198.51.100.0/24' }] },
      egress: { direction: 'egress', entries: [] }
    });

    let result = await enclaveIngressPolicyService.checkSessionIngressAccess({
      tenant,
      environment,
      solution,
      sessionIds: ['ses_test'],
      sourceIp: '203.0.113.10',
      hostname: 'mcp.example.com',
      port: 443,
      recordLog: true
    });

    expect(result.results[0]).toMatchObject({
      sessionId: 'ses_test',
      allowed: false,
      enclaveIds: ['enc_test'],
      deniedEnclaveIds: ['enc_test']
    });
    expect(mockRecordIngressNetworkLog).toHaveBeenCalledWith({
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      solutionOid: solution.oid,
      enclaveOid: enclave.oid,
      sessionId: 'ses_test',
      sourceIp: '203.0.113.10',
      hostname: 'mcp.example.com',
      port: 443,
      result: 'denied'
    });
  });

  it('allows sessions without linked enclaves', async () => {
    mockDb.session.findMany.mockResolvedValueOnce([
      {
        id: 'ses_plain',
        providers: [{ deployment: { enclave: null } }]
      }
    ]);

    let result = await enclaveIngressPolicyService.checkSessionIngressAccess({
      tenant,
      environment,
      solution,
      sessionIds: ['ses_plain'],
      sourceIp: '203.0.113.10',
      recordLog: true
    });

    expect(result.results[0]).toMatchObject({
      sessionId: 'ses_plain',
      allowed: true,
      enclaveIds: [],
      deniedEnclaveIds: []
    });
    expect(mockRecordIngressNetworkLog).not.toHaveBeenCalled();
  });
});
