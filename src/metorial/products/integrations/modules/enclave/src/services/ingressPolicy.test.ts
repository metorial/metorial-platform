import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  mockDb,
  mockIntegrationEnclaveService,
  mockRecordIngressNetworkLog,
  mockGetMetorialSolution
} = vi.hoisted(() => ({
  mockDb: {
    session: {
      findMany: vi.fn()
    },
    sessionProvider: {
      findMany: vi.fn()
    },
    ephemeralManagedSession: {
      findMany: vi.fn()
    }
  },
  mockIntegrationEnclaveService: {
    getCompiledNetworkRulesInternal: vi.fn()
  },
  mockRecordIngressNetworkLog: vi.fn(),
  mockGetMetorialSolution: vi.fn()
}));

vi.mock('@metorial-subspace/db', async () => ({
  db: mockDb
}));

vi.mock('./integrationEnclave', () => ({
  integrationEnclaveService: mockIntegrationEnclaveService
}));

vi.mock('../lib/ingressNetworkLogBuffer', () => ({
  recordIngressNetworkLog: mockRecordIngressNetworkLog
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: mockGetMetorialSolution
}));

import { enclaveIngressPolicyService } from './ingressPolicy';

let tenant = { oid: BigInt(10), id: 'ktn_test', projectOid: BigInt(11) } as any;
let environment = { oid: BigInt(20), id: 'ken_test', instanceOid: BigInt(21) } as any;
let solution = { oid: 30, id: 'ksn_test' } as any;
let enclave = {
  oid: BigInt(40),
  id: 'enc_test',
  compiledNetworkRules: null
} as any;

describe('enclaveIngressPolicyService.checkSessionIngressAccessInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.ephemeralManagedSession.findMany.mockResolvedValue([]);
    mockGetMetorialSolution.mockResolvedValue(solution);
  });

  it('allows sessions when all linked enclave ingress policies allow the source IP', async () => {
    mockDb.session.findMany.mockResolvedValueOnce([
      {
        id: 'ses_test',
        providers: [{ deployment: { enclave } }]
      }
    ]);
    mockIntegrationEnclaveService.getCompiledNetworkRulesInternal.mockResolvedValueOnce({
      ingress: { direction: 'ingress', entries: [{ cidr: '203.0.113.0/24' }] },
      egress: { direction: 'egress', entries: [] }
    });

    let result = await enclaveIngressPolicyService.checkSessionIngressAccessInternal({
      tenant,
      environment,
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
    mockIntegrationEnclaveService.getCompiledNetworkRulesInternal.mockResolvedValueOnce({
      ingress: { direction: 'ingress', entries: [{ cidr: '198.51.100.0/24' }] },
      egress: { direction: 'egress', entries: [] }
    });

    let result = await enclaveIngressPolicyService.checkSessionIngressAccessInternal({
      tenant,
      environment,
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
      projectOid: tenant.projectOid,
      environmentOid: environment.oid,
      instanceOid: environment.instanceOid,
      solutionOid: solution.oid,
      enclaveOid: enclave.oid,
      sessionId: 'ses_test',
      sourceIp: '203.0.113.10',
      hostname: 'mcp.example.com',
      port: 443,
      result: 'denied'
    });
  });

  it('records null mirrored oids for an unlinked tenant and environment', async () => {
    mockDb.session.findMany.mockResolvedValueOnce([
      {
        id: 'ses_test',
        providers: [{ deployment: { enclave } }]
      }
    ]);
    mockIntegrationEnclaveService.getCompiledNetworkRulesInternal.mockResolvedValueOnce({
      ingress: { direction: 'ingress', entries: [{ cidr: '203.0.113.0/24' }] },
      egress: { direction: 'egress', entries: [] }
    });

    await enclaveIngressPolicyService.checkSessionIngressAccessInternal({
      tenant: { oid: BigInt(10), id: 'ktn_test', projectOid: null } as any,
      environment: { oid: BigInt(20), id: 'ken_test', instanceOid: null } as any,
      sessionIds: ['ses_test'],
      sourceIp: '203.0.113.10',
      recordLog: true
    });

    expect(mockRecordIngressNetworkLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantOid: BigInt(10),
        projectOid: null,
        environmentOid: BigInt(20),
        instanceOid: null
      })
    );
  });

  it('allows sessions without linked enclaves', async () => {
    mockDb.session.findMany.mockResolvedValueOnce([
      {
        id: 'ses_plain',
        providers: [{ deployment: { enclave: null } }]
      }
    ]);

    let result = await enclaveIngressPolicyService.checkSessionIngressAccessInternal({
      tenant,
      environment,
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

describe('enclaveIngressPolicyService.assertSessionIngressAccessInternal with a resolved session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMetorialSolution.mockResolvedValue(solution);
  });

  it('loads only the provider enclaves and caches them per session', async () => {
    mockDb.sessionProvider.findMany.mockResolvedValueOnce([
      { deployment: { enclave } },
      { deployment: { enclave } },
      { deployment: { enclave: null } }
    ]);
    mockIntegrationEnclaveService.getCompiledNetworkRulesInternal.mockResolvedValueOnce({
      ingress: { direction: 'ingress', entries: [{ cidr: '203.0.113.0/24' }] },
      egress: { direction: 'egress', entries: [] }
    });

    let session = { oid: BigInt(50), id: 'ses_cached', status: 'active' } as any;
    let params = {
      tenant,
      environment,
      sessionId: 'ses_cached',
      session,
      sourceIp: '203.0.113.10',
      recordLog: true
    };

    let first = await enclaveIngressPolicyService.assertSessionIngressAccessInternal(params);
    let second = await enclaveIngressPolicyService.assertSessionIngressAccessInternal(params);

    expect(first).toMatchObject({
      sessionId: 'ses_cached',
      resolvedSessionId: 'ses_cached',
      allowed: true,
      enclaveIds: ['enc_test']
    });
    expect(second).toEqual(first);
    expect(mockDb.session.findMany).not.toHaveBeenCalled();
    expect(mockDb.sessionProvider.findMany).toHaveBeenCalledTimes(1);
    expect(mockDb.sessionProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionOid: BigInt(50), status: 'active' } })
    );
    expect(
      mockIntegrationEnclaveService.getCompiledNetworkRulesInternal
    ).toHaveBeenCalledTimes(1);
    expect(mockRecordIngressNetworkLog).toHaveBeenCalledTimes(2);
  });

  it('blocks a resolved session whose source IP is outside the enclave policy', async () => {
    mockDb.sessionProvider.findMany.mockResolvedValueOnce([{ deployment: { enclave } }]);
    mockIntegrationEnclaveService.getCompiledNetworkRulesInternal.mockResolvedValueOnce({
      ingress: { direction: 'ingress', entries: [{ cidr: '203.0.113.0/24' }] },
      egress: { direction: 'egress', entries: [] }
    });

    await expect(
      enclaveIngressPolicyService.assertSessionIngressAccessInternal({
        tenant,
        environment,
        sessionId: 'ses_blocked',
        session: { oid: BigInt(51), id: 'ses_blocked', status: 'active' } as any,
        sourceIp: '198.51.100.10'
      })
    ).rejects.toThrow('Ingress network policy blocked this connection');
  });

  it('blocks a resolved session that is no longer active', async () => {
    await expect(
      enclaveIngressPolicyService.assertSessionIngressAccessInternal({
        tenant,
        environment,
        sessionId: 'ses_archived',
        session: { oid: BigInt(52), id: 'ses_archived', status: 'archived' } as any,
        sourceIp: '203.0.113.10'
      })
    ).rejects.toThrow('Ingress network policy blocked this connection');
    expect(mockDb.sessionProvider.findMany).not.toHaveBeenCalled();
  });
});
