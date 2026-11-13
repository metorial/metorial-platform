import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCatalogIndex, type ModelRequest, type ResolvedModel } from '../../catalog';
import { db } from '../../db';
import { closeSessionRedis, getSessionRedis } from '../../sessions/redis';
import { settleSession } from '../../sessions/settle';
import { createSessionHarness, store } from '../../sessions/tests/harness';
import { cleanDatabase, testDb } from '../../test/setup';
import { getKnowledge, resetKnowledgeCache } from '../cache';
import { syncKnowledge } from '../ingest';
import { knowledgeVersionKey } from '../version';
import {
  knowledgeCatalog,
  offering,
  startKnowledgeServer,
  textPricing,
  type KnowledgeFixtureServer
} from './fixture';

let hourMs = 60 * 60 * 1000;
let dayMs = 24 * hourMs;

let server: KnowledgeFixtureServer;

let hoursAgo = (hours: number) => new Date(Date.now() - hours * hourMs);

let publishAndSync = async (
  catalog: ReturnType<typeof knowledgeCatalog>,
  fingerprint: string
) => {
  server.publish(catalog, fingerprint);

  let result = await syncKnowledge({ url: server.url, guardrails: false });
  expect(result.status).toBe('applied');
};

let sonnetPeriods = () =>
  testDb.knowledgePricePeriod.findMany({
    where: { offering: { id: 'anthropic:claude-sonnet-4-5-20250929' } },
    orderBy: { validFrom: 'asc' }
  });

let settle = async (
  requests: { at: Date; model: Record<string, unknown>; family?: string }[]
) => {
  let harness = await createSessionHarness();
  let sessionId = crypto.randomUUID();

  let [record] = await harness.ingest(
    requests.map(request => ({
      type: 'model.request',
      at: request.at,
      sessionId,
      family: request.family,
      data: { model: request.model, usage: { inputUncached: 1_000_000, output: 100_000 } }
    }))
  );
  let sessionKey = record!.ctx.session_key!;

  await settleSession({ sessionKey });

  let session = (await harness.session(sessionKey))!;
  let slices = await harness
    .collections()
    .usageSlices.find({ sessionKey })
    .sort({ bucket: 1 })
    .toArray();

  return { session, slices };
};

let requestSlices = <T extends { requests: number }>(slices: T[]) =>
  slices.filter(slice => slice.requests);

let sonnet = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

describe('price history and vendor resolution against the stored knowledge', () => {
  beforeAll(async () => {
    server = await startKnowledgeServer();
    await store.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeSessionRedis();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await getSessionRedis().del(knowledgeVersionKey);
    resetKnowledgeCache();
  });

  it('prices each request with the period valid at its time', async () => {
    let changedAt = hoursAgo(2);

    await publishAndSync(knowledgeCatalog({ generatedAt: hoursAgo(6).toISOString() }), 'fp-1');
    await publishAndSync(
      knowledgeCatalog({ generatedAt: changedAt.toISOString(), sonnetInput: 2.5 }),
      'fp-2'
    );

    let periods = await sonnetPeriods();
    expect(periods.map(period => period.closeReason)).toEqual(['changed', null]);

    let { session, slices } = await settle([
      { at: hoursAgo(3), model: sonnet },
      { at: hoursAgo(1), model: sonnet }
    ]);

    expect(session.summary!.models).toHaveLength(1);
    expect(session.summary!.models[0]).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      vendorId: 'anthropic',
      vendorSource: 'reported',
      offeringId: 'anthropic:claude-sonnet-4-5-20250929',
      pricePeriodIds: periods.map(period => period.id),
      requests: 2
    });
    expect(session.summary!.models[0]!.priceAssumed).toBeUndefined();
    expect(session.summary!.costComputedUsd?.toString()).toBe('8.25');

    expect(
      requestSlices(slices).map(slice => [
        slice.vendorId,
        slice.vendorSource,
        slice.costComputedUsd?.toString()
      ])
    ).toEqual([
      ['anthropic', 'reported', '4.5'],
      ['anthropic', 'reported', '3.75']
    ]);
  });

  it('assumes the price once the open period went more than 7 days unconfirmed', async () => {
    await publishAndSync(knowledgeCatalog({ generatedAt: hoursAgo(6).toISOString() }), 'fp-1');

    let [open] = await sonnetPeriods();
    await testDb.knowledgePricePeriod.update({
      where: { oid: open!.oid },
      data: { confirmedAt: new Date(Date.now() - 8 * dayMs) }
    });
    resetKnowledgeCache();

    let { session } = await settle([{ at: hoursAgo(1), model: sonnet }]);

    expect(session.summary!.models[0]).toMatchObject({
      pricePeriodIds: [open!.id],
      priceAssumed: true
    });
    expect(session.summary!.models[0]!.costComputedUsd?.toString()).toBe('4.5');
  });

  it('keeps pricing an offering whose upstream price went null', async () => {
    await publishAndSync(knowledgeCatalog({ generatedAt: hoursAgo(6).toISOString() }), 'fp-1');
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(3).toISOString(), gptPricing: null }),
      'fp-2'
    );

    let { session } = await settle([
      { at: hoursAgo(1), model: { id: 'gpt-5' }, family: 'codex' }
    ]);

    expect(session.summary!.models[0]).toMatchObject({
      modelId: 'gpt-5',
      vendorId: 'openai',
      vendorSource: 'offering',
      offeringId: 'openai:gpt-5'
    });
    expect(session.summary!.models[0]!.costComputedUsd?.toString()).toBe('1.875');
  });

  it('stores the vendor source on summaries and slices', async () => {
    await publishAndSync(knowledgeCatalog({ generatedAt: hoursAgo(6).toISOString() }), 'fp-1');

    let { session, slices } = await settle([
      { at: hoursAgo(5), model: sonnet },
      {
        at: hoursAgo(4),
        model: { id: 'Claude Sonnet 4.5', baseUrl: 'https://api.anthropic.com' }
      },
      { at: hoursAgo(3), model: { id: 'claude-sonnet-4-5-20250929' } },
      { at: hoursAgo(2), model: { id: 'Claude Sonnet 4.5' } },
      { at: hoursAgo(1), model: { id: 'gpt-5' } }
    ]);

    expect(
      session.summary!.models.map(model => [model.modelId, model.vendorId, model.vendorSource])
    ).toEqual([
      ['claude-sonnet-4-5', 'anthropic', 'reported'],
      ['gpt-5', 'openai', 'offering']
    ]);
    expect(
      requestSlices(slices).map(slice => [slice.modelId, slice.vendorId, slice.vendorSource])
    ).toEqual([
      ['claude-sonnet-4-5', 'anthropic', 'reported'],
      ['claude-sonnet-4-5', 'anthropic', 'endpoint'],
      ['claude-sonnet-4-5', 'anthropic', 'offering'],
      ['claude-sonnet-4-5', 'anthropic', 'agent'],
      ['gpt-5', 'openai', 'offering']
    ]);
  });

  it('resolves the same way as the in-memory catalog', async () => {
    let first = knowledgeCatalog({
      generatedAt: hoursAgo(6).toISOString(),
      extraOfferings: [
        offering({
          vendorId: 'anthropic',
          vendorModelId: 'claude-sonnet-unnamed',
          modelId: 'claude-sonnet-4-5',
          pricing: textPricing(4)
        })
      ]
    });
    await publishAndSync(first, 'fp-1');

    let requests: ModelRequest[] = [
      { raw: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
      { raw: 'claude-sonnet-4-5-20250929', family: 'claude-code' },
      { raw: 'claude-sonnet-unnamed', provider: 'anthropic' },
      { raw: 'claude-sonnet-unnamed', family: 'claude-code' },
      { raw: 'Claude Sonnet 4.5', family: 'claude_code' },
      { raw: 'Claude Sonnet 4.5', baseUrl: 'api.anthropic.com' },
      { raw: 'Claude Sonnet 4.5', provider: 'bedrock' },
      { raw: 'gpt-5', family: 'claude-code' },
      { raw: 'gpt-5', provider: 'other:openai' },
      { raw: 'filler-3' },
      { raw: 'mystery', family: 'claude-code' },
      { raw: 'mystery', provider: 'gateway' }
    ];
    let times = [
      new Date('2026-01-01T00:00:00Z'),
      hoursAgo(1),
      new Date(Date.now() + 30 * dayMs)
    ];

    let comparable = (result: ResolvedModel) => ({
      modelId: result.modelId,
      match: result.match,
      agentId: result.agentId,
      vendorId: result.vendorId,
      vendorSource: result.vendorSource,
      offeringId: result.offering?.id,
      pricing: result.period?.pricing,
      validFrom: result.period?.validFrom,
      priceAssumed: result.priceAssumed
    });

    let memory = createCatalogIndex(first);
    let sql = await (await getKnowledge())!.prepare(requests);

    for (let request of requests) {
      for (let at of times) {
        expect(comparable(sql.resolveModel({ ...request, at }))).toEqual(
          comparable(memory.resolveModel({ ...request, at }))
        );
      }
    }

    expect(
      sql.resolveModel({
        raw: 'claude-sonnet-unnamed',
        family: 'claude-code',
        at: hoursAgo(1)
      })
    ).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      vendorId: 'anthropic',
      vendorSource: 'offering',
      offering: { id: 'anthropic:claude-sonnet-unnamed' }
    });
  });

  it('prepares cold with three indexed queries and warm with none', async () => {
    await publishAndSync(knowledgeCatalog({ generatedAt: hoursAgo(6).toISOString() }), 'fp-1');

    let index = (await getKnowledge())!;
    let requests = [
      { raw: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
      { raw: 'Claude Sonnet 4.5', family: 'claude-code' },
      { raw: 'gpt-5', provider: 'openai' }
    ];
    let queries = vi.spyOn(db, '$queryRawUnsafe');

    await index.prepare(requests);
    expect(queries).toHaveBeenCalledTimes(3);

    queries.mockClear();
    let resolver = await index.prepare(requests);
    expect(queries).not.toHaveBeenCalled();
    queries.mockRestore();

    let started = performance.now();
    for (let iteration = 0; iteration < 10_000; iteration++) {
      resolver.resolveModel({ ...requests[0]!, at: hoursAgo(1) });
    }
    expect((performance.now() - started) / 10_000).toBeLessThan(0.1);
  });
});
