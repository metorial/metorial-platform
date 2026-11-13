import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { store, usd } from '../attribution/fixtures';
import {
  knowledgeCacheService,
  knowledgeSyncService
} from '@mtsrc/agent-tracking-module-knowledge';
import {
  knowledgeCatalog,
  startKnowledgeServer,
  type KnowledgeFixtureServer
} from '@mtsrc/agent-tracking-module-knowledge/test/fixture';
import { knowledgeVersionKey } from '@mtsrc/agent-tracking-module-knowledge';
import { closeRedis, getCacheRedis } from '@mtsrc/agent-tracking-redis';
import type { UsageSliceDocument } from '@mtsrc/agent-tracking-store';
import { cleanDatabase } from '@mtsrc/agent-tracking-db/test/setup';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { usageQueryService } from '@mtsrc/agent-tracking-module-usage';
import {
  buildUsagePipelines,
  type QueryFilters,
  type UsageMetric
} from '@mtsrc/agent-tracking-module-usage';
import { dimensionCatalogOptions } from '@mtsrc/agent-tracking-module-usage/test/dimensionCatalog';

let bucket = new Date('2026-11-10T09:00:00Z');
let range = { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-13T00:00:00Z') };

let server: KnowledgeFixtureServer;
let generation = 0;

let publish = async (options: Parameters<typeof dimensionCatalogOptions>[0] = {}) => {
  generation += 1;
  server.publish(
    knowledgeCatalog({
      ...dimensionCatalogOptions(options),
      generatedAt: new Date(Date.UTC(2026, 10, 1, generation)).toISOString()
    }),
    `fp-dimensions-${generation}`
  );

  let result = await knowledgeSyncService.sync({ url: server.url, guardrails: false });
  expect(result.status).toBe('applied');
  knowledgeCacheService.expire();

  return result;
};

type Scope = Awaited<ReturnType<typeof createTestScope>>;

let sliceOf = (
  scope: Scope,
  d: {
    userId: string;
    family: string;
    cost: string;
    modelId?: string;
    modelRaw?: string;
    vendorId?: string;
    list?: string;
    contract?: string;
  }
): UsageSliceDocument => ({
  _id: crypto.randomUUID(),
  organizationId: scope.organization.id,
  projectId: scope.project.id,
  instanceId: scope.instance.id,
  bucket,
  bucketMinutes: 15,
  sessionKey: crypto.randomUUID(),
  userId: d.userId,
  workspaceIds: [],
  repoIds: [],
  dims: [],
  dimIds: [],
  client: { family: d.family },
  ...(d.modelId ? { modelId: d.modelId } : {}),
  ...(d.modelRaw ? { modelRaw: d.modelRaw } : {}),
  ...(d.vendorId ? { vendorId: d.vendorId } : {}),
  sessionsStarted: 1,
  turns: 1,
  requests: 1,
  failedRequests: 0,
  toolCalls: 0,
  tokens: { inputUncached: 10, cacheRead: 0, cacheWrite: 0, output: 5, reasoning: 0 },
  costReported: [],
  costUsd: usd(d.cost),
  ...(d.list ? { costComputedUsd: usd(d.list) } : {}),
  ...(d.contract ? { costContractUsd: usd(d.contract) } : {}),
  lines: { added: 0, removed: 0 },
  attributionVersion: 1,
  factsVersion: 1,
  computedAt: new Date(),
  expiresAt: new Date('2027-12-01T00:00:00Z')
});

let seed = async () => {
  let scope = await createTestScope();
  let sliceFor = (d: Parameters<typeof sliceOf>[1]) => sliceOf(scope, d);

  await store.ready();
  await store.collections().usageSlices.insertMany([
    sliceFor({
      userId: 'ada',
      family: 'claude-code',
      modelId: 'claude-sonnet-4-5',
      vendorId: 'anthropic',
      cost: '3',
      list: '3',
      contract: '2.4'
    }),
    sliceFor({
      userId: 'grace',
      family: 'claude_code',
      modelId: 'claude-sonnet-4-5',
      vendorId: 'aws-bedrock',
      cost: '2',
      list: '2.2'
    }),
    sliceFor({
      userId: 'ada',
      family: 'claude-code',
      modelId: 'claude-haiku-4-5',
      vendorId: 'anthropic',
      cost: '1',
      list: '1'
    }),
    sliceFor({
      userId: 'grace',
      family: 'codex_cli_rs',
      modelId: 'gpt-5',
      vendorId: 'openai',
      cost: '4',
      list: '4'
    }),
    sliceFor({
      userId: 'linus',
      family: 'cursor',
      modelRaw: 'anthropic/claude-future-9',
      cost: '0.5'
    }),
    sliceFor({ userId: 'linus', family: 'cursor', modelRaw: 'mystery-model', cost: '0.25' })
  ]);

  let usage = async (
    groupBy: string[],
    filters: QueryFilters = {},
    metrics: UsageMetric[] = ['cost.usd', 'users.active']
  ) => {
    let result = await usageQueryService.queryUsage({
      organization: scope.organization,
      query: { range, metrics, groupBy, filters, allocation: 'full' }
    });

    return Object.fromEntries(
      result.rows.map(row => [
        groupBy.map(field => row.keys[field] ?? 'null').join('|') || 'total',
        metrics.length == 2 && metrics.includes('users.active')
          ? [row.metrics['cost.usd'], row.metrics['users.active']]
          : row.metrics
      ])
    );
  };

  return { ...scope, sliceFor, usage };
};

let winningPlan = async (organizationId: string, filters: QueryFilters) => {
  let pipelines = buildUsagePipelines(
    {
      organizationId,
      range,
      metrics: ['cost.usd'],
      groupBy: [],
      filters,
      allocation: 'full'
    },
    {
      maps: await knowledgeCacheService.getDimensionMaps(),
      unresolvedRaws: ['anthropic/claude-future-9']
    }
  );

  let explained = (await store
    .collections()
    .usageSlices.aggregate(pipelines.main)
    .explain('queryPlanner')) as {
    queryPlanner?: { winningPlan: unknown };
    stages?: { $cursor: { queryPlanner: { winningPlan: unknown } } }[];
  };

  return JSON.stringify(
    explained.queryPlanner?.winningPlan ??
      explained.stages?.[0]?.$cursor.queryPlanner.winningPlan
  );
};

describe('usage dimensions', () => {
  beforeAll(async () => {
    server = await startKnowledgeServer();
  });

  afterAll(async () => {
    await server.close();
    await closeRedis();
    await store.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await getCacheRedis().del(knowledgeVersionKey);
    knowledgeCacheService.reset();
    knowledgeCacheService.reset();
    await publish();
  });

  it('groups and filters by model lab with the hint of unresolved models', async () => {
    let { usage } = await seed();

    expect(await usage(['model.lab'])).toEqual({
      anthropic: [6.5, 3],
      openai: [4, 1],
      null: [0.25, 1]
    });
    expect(await usage(['user'], { 'model.lab': { in: ['anthropic'] } })).toEqual({
      ada: [4, 1],
      grace: [2, 1],
      linus: [0.5, 1]
    });
    expect(await usage([], { 'model.lab': { notIn: ['anthropic'] } })).toEqual({
      total: [4.25, 2]
    });
  });

  it('groups and filters by model family', async () => {
    let { usage } = await seed();

    expect(await usage(['model.family'])).toEqual({
      'claude-sonnet': [5, 2],
      'claude-haiku': [1, 1],
      null: [4.75, 2]
    });
    expect(await usage(['model'], { 'model.family': { in: ['claude-haiku'] } })).toEqual({
      'claude-haiku-4-5': [1, 1]
    });
    expect(await usage(['model.isLatest'])).toEqual({
      true: [6, 2],
      false: [4, 1],
      null: [0.75, 1]
    });
  });

  it('groups and filters by vendor and vendor kind', async () => {
    let { usage } = await seed();

    expect(await usage(['vendor'])).toEqual({
      anthropic: [4, 1],
      'aws-bedrock': [2, 1],
      openai: [4, 1],
      null: [0.75, 1]
    });
    expect(await usage(['vendor.kind'])).toEqual({
      'first-party': [8, 2],
      cloud: [2, 1],
      null: [0.75, 1]
    });
    expect(await usage(['user'], { 'vendor.kind': { in: ['cloud'] } })).toEqual({
      grace: [2, 1]
    });
    expect(await usage(['vendor.kind'], { vendor: { in: ['anthropic', 'openai'] } })).toEqual({
      'first-party': [8, 2]
    });
  });

  it('groups and filters by catalog agent and agent maker', async () => {
    let { usage } = await seed();

    expect(await usage(['agent'])).toEqual({
      'claude-code': [6, 2],
      codex: [4, 1],
      null: [0.75, 1]
    });
    expect(await usage(['agent.maker'])).toEqual({
      anthropic: [6, 2],
      openai: [4, 1],
      null: [0.75, 1]
    });
    expect(await usage(['client.family'], { agent: { in: ['claude-code'] } })).toEqual({
      'claude-code': [4, 1],
      claude_code: [2, 1]
    });
    expect(await usage(['agent'], { 'agent.maker': { notIn: ['anthropic'] } })).toEqual({
      codex: [4, 1],
      null: [0.75, 1]
    });
  });

  it('sums list and contract cost per mapped group', async () => {
    let { usage } = await seed();

    expect(await usage(['agent'], {}, ['cost.usd', 'cost.list', 'cost.contract'])).toEqual({
      'claude-code': { 'cost.usd': 6, 'cost.list': 6.2, 'cost.contract': 2.4 },
      codex: { 'cost.usd': 4, 'cost.list': 4, 'cost.contract': 0 },
      null: { 'cost.usd': 0.75, 'cost.list': 0, 'cost.contract': 0 }
    });
  });

  it('serves expanded filters from the slice indexes', async () => {
    let { organization, sliceFor } = await seed();

    await store.collections().usageSlices.insertMany(
      Array.from({ length: 300 }, (_, index) =>
        sliceFor({
          userId: `filler-${index}`,
          family: 'claude-code',
          modelId: `filler-${index % 8}`,
          vendorId: 'openai',
          cost: '1'
        })
      )
    );

    let byFamily = await winningPlan(organization.id, {
      'model.family': { in: ['claude-haiku'] }
    });
    expect(byFamily).toContain('organizationId_1_modelId_1_bucket_1');
    expect(byFamily).not.toContain('COLLSCAN');

    let byVendorKind = await winningPlan(organization.id, {
      'vendor.kind': { in: ['cloud'] }
    });
    expect(byVendorKind).toContain('organizationId_1_vendorId_1_bucket_1');
    expect(byVendorKind).not.toContain('COLLSCAN');

    let byLab = await winningPlan(organization.id, { 'model.lab': { in: ['anthropic'] } });
    expect(byLab).toContain('organizationId_1_modelId_1_bucket_1');
    expect(byLab).toContain('organizationId_1_modelRaw_1_bucket_1');
    expect(byLab).not.toContain('COLLSCAN');

    let byAgent = await winningPlan(organization.id, { agent: { in: ['codex'] } });
    expect(byAgent).toContain('IXSCAN');
    expect(byAgent).not.toContain('COLLSCAN');
  });

  it('reloads the maps only when the knowledge version changes', async () => {
    let { usage } = await seed();

    let first = await knowledgeCacheService.getDimensionMaps();
    expect(await knowledgeCacheService.getDimensionMaps()).toBe(first);
    expect(await usage(['agent.maker'])).toMatchObject({ openai: [4, 1] });

    let next = await publish({ haikuFamilyId: 'claude-sonnet', codexMakerId: 'anthropic' });

    let reloaded = await knowledgeCacheService.getDimensionMaps();
    expect(reloaded).not.toBe(first);
    expect(reloaded.version).toBe(next.snapshotId);
    expect(await usage(['model.family'])).toEqual({
      'claude-sonnet': [6, 2],
      null: [4.75, 2]
    });
    expect(await usage(['agent.maker'])).toEqual({ anthropic: [10, 2], null: [0.75, 1] });
  });
});
