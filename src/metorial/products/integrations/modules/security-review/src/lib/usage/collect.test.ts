import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  specificationTools: vi.fn(),
  usageGroupBy: vi.fn(),
  protoguardGroupBy: vi.fn(),
  authConfigCount: vi.fn(),
  configCount: vi.fn()
}));

let allowedModels = new Set([
  'providerTool',
  'providerToolUsageHourly',
  'providerProtoGuardHourly',
  'providerAuthConfig',
  'providerConfig'
]);

vi.mock('@metorial-subspace/db', () => ({
  db: new Proxy(
    {
      $queryRaw: mocks.queryRaw,
      providerTool: { findMany: mocks.specificationTools },
      providerToolUsageHourly: { groupBy: mocks.usageGroupBy },
      providerProtoGuardHourly: { groupBy: mocks.protoguardGroupBy },
      providerAuthConfig: { count: mocks.authConfigCount },
      providerConfig: { count: mocks.configCount }
    },
    {
      get: (target, key: string) => {
        if (!(key in target) && !allowedModels.has(key)) {
          throw new Error(`usage evidence must not read ${key}`);
        }
        return (target as any)[key];
      }
    }
  )
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  buildIntegrationProviderToolFilterChain: () => [],
  normalizeToolFilterChain: (chain: unknown) => chain,
  checkToolAccess: () => ({ allowed: true })
}));

vi.mock('../subjects/specification', () => ({
  loadSpecification: async () => ({ files: { 'spec.json': '{"name":"example"}' } })
}));

import { collectUsageEvidence } from './collect';

let baseRevision = {
  id: 'srr_base',
  specificationOid: 1n,
  report: {
    summary: { text: 'Base.', trustNote: 'Trust.', exposureNote: 'Exposure.' },
    capabilities: { tools: [{ key: 'search', tags: ['read'], behavior: 'Reads.' }] },
    findings: []
  }
} as any;

beforeEach(() => {
  vi.clearAllMocks();

  mocks.queryRaw.mockResolvedValue([]);
  mocks.specificationTools.mockResolvedValue([
    { key: 'search', value: { scopes: { AND: [{ OR: ['read:all'] }] } } }
  ]);
  mocks.usageGroupBy.mockResolvedValue([
    { toolKey: 'search', _sum: { calls: 120, errors: 3 } }
  ]);
  mocks.protoguardGroupBy.mockResolvedValue([]);
  mocks.authConfigCount.mockResolvedValue(2);
  mocks.configCount.mockResolvedValue(3);
});

describe('collectUsageEvidence', () => {
  it('reads only aggregated usage tables, never calls, messages or sessions', async () => {
    await expect(
      collectUsageEvidence({ review: { instanceOid: 1n, providerOid: 2n }, baseRevision })
    ).resolves.toBeDefined();

    expect(mocks.usageGroupBy).toHaveBeenCalledOnce();
    expect(mocks.protoguardGroupBy).toHaveBeenCalled();
  });

  it('writes aggregate-only evidence files for the agent', async () => {
    let collected = await collectUsageEvidence({
      review: { instanceOid: 1n, providerOid: 2n },
      baseRevision
    });

    expect(Object.keys(collected.files)).toEqual(
      expect.arrayContaining([
        'base/report.json',
        'usage/overview.json',
        'usage/tools.json',
        'usage/scopes.json',
        'usage/protoguard.json',
        'usage/daily.json',
        'usage/tool-filters.json'
      ])
    );
    expect(JSON.parse(collected.files['usage/overview.json']!)).toMatchObject({
      calls: 120,
      activeAuthConfigs: 2,
      activeConfigs: 3
    });
  });

  it('keeps the snapshot to counts and tool keys', async () => {
    let collected = await collectUsageEvidence({
      review: { instanceOid: 1n, providerOid: 2n },
      baseRevision
    });

    expect(collected.snapshot).toMatchObject({
      baseRevisionId: 'srr_base',
      calls: 120,
      toolsUsed: ['search'],
      authConfigs: 2,
      configs: 3
    });
  });
});
