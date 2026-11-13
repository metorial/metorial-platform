import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pruneKnowledgeChanges } from '../../queues/knowledgeSync';
import { closeSessionRedis, getSessionRedis } from '../../sessions/redis';
import { settleSession } from '../../sessions/settle';
import { createSessionHarness, minutesAfter, store } from '../../sessions/tests/harness';
import { cleanDatabase, testDb } from '../../test/setup';
import { expireKnowledgeCheck, getKnowledge, resetKnowledgeCache } from '../cache';
import {
  KnowledgeFingerprintMovedError,
  acceptKnowledgeSnapshot,
  pollKnowledge,
  syncKnowledge
} from '../ingest';
import { knowledgeVersionKey, knowledgeVersionOf } from '../version';
import {
  knowledgeCatalog,
  offering,
  startKnowledgeServer,
  textPricing,
  type KnowledgeFixtureServer
} from './fixture';

let server: KnowledgeFixtureServer;

let sync = () => syncKnowledge({ url: server.url, guardrails: true });

let periodsOf = (offeringId: string) =>
  testDb.knowledgePricePeriod.findMany({
    where: { offering: { id: offeringId } },
    orderBy: { validFrom: 'asc' }
  });

describe('model knowledge sync', () => {
  beforeAll(async () => {
    server = await startKnowledgeServer();
  });

  afterAll(async () => {
    await server.close();
    await closeSessionRedis();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await getSessionRedis().del(knowledgeVersionKey);
    resetKnowledgeCache();
    server.requests.length = 0;
    server.onArchive(null);
  });

  it('ingests a first snapshot with rows, bootstrap prices and a published version', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');

    let result = await sync();

    expect(result.status).toBe('applied');
    if (result.status != 'applied') return;

    expect(result.counts.offering).toEqual({ total: 10, added: 10, changed: 0, removed: 0 });
    expect(await testDb.knowledgeChange.count()).toBe(0);

    let model = await testDb.knowledgeModel.findUniqueOrThrow({
      where: { id: 'claude-sonnet-4-5' }
    });
    expect(model).toMatchObject({
      labId: 'anthropic',
      familyId: 'claude-sonnet',
      capabilities: ['tools', 'structured-output', 'temperature'],
      inputModalities: ['text', 'image'],
      contextTokens: 200_000
    });
    expect(model.releaseDate?.toISOString()).toBe('2025-09-29T00:00:00.000Z');

    let agent = await testDb.knowledgeAgent.findUniqueOrThrow({
      where: { id: 'claude-code' }
    });
    expect(agent).toMatchObject({ aliasKeys: ['claude-code'], defaultVendorId: 'anthropic' });

    let endpoint = await testDb.knowledgeEndpoint.findUniqueOrThrow({
      where: { id: 'anthropic-api' }
    });
    expect(endpoint.baseUrlHost).toBe('api.anthropic.com');

    let [period] = await periodsOf('anthropic:claude-sonnet-4-5-20250929');
    expect(period).toMatchObject({ origin: 'bootstrap', validTo: null, closeReason: null });
    expect(period!.validFrom.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(period!.openOfferingOid).toBe(period!.offeringOid);

    expect(await getSessionRedis().get(knowledgeVersionKey)).toBe(
      knowledgeVersionOf(
        await testDb.knowledgeSnapshot.findUniqueOrThrow({ where: { id: result.snapshotId } })
      )
    );
  });

  it('polls with the ETag and only reports a new fingerprint', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');

    expect(await pollKnowledge({ url: server.url })).toEqual({
      changed: true,
      fingerprint: 'fp-1'
    });
    await sync();

    let source = await testDb.knowledgeSource.findUniqueOrThrow({
      where: { url: server.url }
    });
    expect(source).toMatchObject({ lastFingerprint: 'fp-1', etag: '"fp-1"' });

    server.requests.length = 0;
    expect(await pollKnowledge({ url: server.url })).toEqual({ changed: false });
    expect(server.requests).toEqual(['GET /fingerprint.json']);

    let unchanged = await testDb.knowledgeSource.findUniqueOrThrow({
      where: { url: server.url }
    });
    expect(unchanged.updatedAt).toEqual(source.updatedAt);

    server.publish(knowledgeCatalog({ sonnetInput: 2.5 }), 'fp-2');
    expect(await pollKnowledge({ url: server.url })).toEqual({
      changed: true,
      fingerprint: 'fp-2'
    });
  });

  it('records a price change once, keeps null prices open and logs changes', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');
    await sync();

    server.publish(
      knowledgeCatalog({
        generatedAt: '2026-11-02T00:00:00.000Z',
        sonnetInput: 2.5,
        gptPricing: null,
        extraOfferings: [
          offering({
            vendorId: 'aws-bedrock',
            vendorModelId: 'anthropic.claude-sonnet-4-5',
            modelId: 'claude-sonnet-4-5',
            pricing: textPricing(3.3),
            firstSeenAt: '2026-10-20T00:00:00.000Z'
          })
        ]
      }),
      'fp-2'
    );

    let result = await sync();
    expect(result.status).toBe('applied');

    let sonnet = await periodsOf('anthropic:claude-sonnet-4-5-20250929');
    expect(
      sonnet.map(period => [period.closeReason, period.validTo?.toISOString() ?? null])
    ).toEqual([
      ['changed', '2026-11-02T00:00:00.000Z'],
      [null, null]
    ]);
    expect(sonnet[1]).toMatchObject({ origin: 'observed', pricing: textPricing(2.5) });
    expect(sonnet[1]!.validFrom.toISOString()).toBe('2026-11-02T00:00:00.000Z');

    let gpt = await periodsOf('openai:gpt-5');
    expect(gpt).toHaveLength(1);
    expect(gpt[0]!.validTo).toBeNull();

    let bedrock = await periodsOf('aws-bedrock:anthropic.claude-sonnet-4-5');
    expect(bedrock[0]!.validFrom.toISOString()).toBe('2026-10-20T00:00:00.000Z');

    let changes = await testDb.knowledgeChange.findMany({ orderBy: { entityId: 'asc' } });
    expect(changes.map(change => [change.entityId, change.change])).toEqual([
      ['anthropic:claude-sonnet-4-5-20250929', 'changed'],
      ['aws-bedrock:anthropic.claude-sonnet-4-5', 'added'],
      ['openai:gpt-5', 'changed']
    ]);
    expect((changes[0]!.before as { pricing: unknown }).pricing).toEqual(textPricing(3));

    let offeringRow = await testDb.knowledgeOffering.findUniqueOrThrow({
      where: { id: 'openai:gpt-5' }
    });
    expect(offeringRow.pricingHash).toBe(gpt[0]!.pricingHash);

    expect(await sync()).toMatchObject({ status: 'unchanged' });
    expect(await testDb.knowledgeChange.count()).toBe(3);
    expect(await testDb.knowledgePricePeriod.count()).toBe(12);
  });

  it('soft-deletes removed entities and restores them when they return', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');
    await sync();

    let without = knowledgeCatalog({ generatedAt: '2026-11-02T00:00:00.000Z' });
    without.names = without.names.filter(item => item.raw != 'Claude Sonnet 4.5');
    server.publish(without, 'fp-2');
    await sync();

    let removed = await testDb.knowledgeName.findUniqueOrThrow({
      where: { id: 'display:Claude Sonnet 4.5' }
    });
    expect(removed.removedAt).not.toBeNull();

    let snapshot = await testDb.knowledgeSnapshot.findFirstOrThrow({
      where: { status: 'current' }
    });
    expect(snapshot.anomalies).toEqual([
      { kind: 'removed', entity: 'name', count: 1, sample: ['display:Claude Sonnet 4.5'] }
    ]);

    server.publish(knowledgeCatalog({ generatedAt: '2026-11-03T00:00:00.000Z' }), 'fp-3');
    await sync();

    let restored = await testDb.knowledgeName.findUniqueOrThrow({
      where: { id: 'display:Claude Sonnet 4.5' }
    });
    expect(restored.removedAt).toBeNull();
    expect(restored.oid).toBe(removed.oid);
  });

  it('retries when the fingerprint moves during the download', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');
    server.onArchive(() => server.publish(knowledgeCatalog({ sonnetInput: 9 }), 'fp-2'));

    await expect(sync()).rejects.toBeInstanceOf(KnowledgeFingerprintMovedError);

    expect(await testDb.knowledgeSnapshot.count()).toBe(0);
    expect(await testDb.knowledgeOffering.count()).toBe(0);

    let source = await testDb.knowledgeSource.findUniqueOrThrow({
      where: { url: server.url }
    });
    expect(source.lastError).toContain('fingerprint changed');
  });

  it('rejects a mass price change and applies it once accepted', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');
    let first = await sync();

    server.publish(
      knowledgeCatalog({ generatedAt: '2026-11-02T00:00:00.000Z', fillerInput: 100 }),
      'fp-2'
    );
    let rejected = await sync();

    expect(rejected).toMatchObject({ status: 'rejected' });
    if (rejected.status != 'rejected') return;
    expect(rejected.reason).toContain('change price');

    let current = await testDb.knowledgeSnapshot.findFirstOrThrow({
      where: { status: 'current' }
    });
    expect(current.id).toBe(first.snapshotId);
    expect(await testDb.knowledgeChange.count()).toBe(0);
    expect(await pollKnowledge({ url: server.url })).toEqual({ changed: false });
    expect(await sync()).toMatchObject({
      status: 'rejected',
      snapshotId: rejected.snapshotId
    });

    let accepted = await acceptKnowledgeSnapshot({ snapshotId: rejected.snapshotId });

    expect(accepted).toMatchObject({ status: 'applied', snapshotId: rejected.snapshotId });
    expect(
      await testDb.knowledgeSnapshot.findUniqueOrThrow({ where: { id: rejected.snapshotId } })
    ).toMatchObject({ status: 'current', rejectedReason: null });
    expect(await testDb.knowledgeChange.count()).toBe(8);
  });

  it('serves resolution from the current snapshot and picks up new versions', async () => {
    expect(await getKnowledge()).toBeNull();

    server.publish(knowledgeCatalog(), 'fp-1');
    let first = await sync();
    expireKnowledgeCheck();

    let index = await getKnowledge();
    expect(index?.version).toBe(first.snapshotId);
    expect(index?.modelInfo('claude-sonnet-4-5')).toEqual({
      labId: 'anthropic',
      familyId: 'claude-sonnet',
      status: 'active',
      isLatest: true
    });

    let request = { raw: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };
    let resolver = await index!.prepare([request, { raw: 'Claude Sonnet 4.5' }]);

    expect(resolver.resolveModel({ ...request, at: new Date() })).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      offering: { id: 'anthropic:claude-sonnet-4-5-20250929', pricing: textPricing(3) }
    });
    expect(resolver.resolveModel({ raw: 'Claude Sonnet 4.5', at: new Date() })).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      offering: { id: 'anthropic:claude-sonnet-4-5-20250929' }
    });
    expect(
      resolver.resolveModel({ raw: 'gpt-5', provider: 'openai', at: new Date() })
    ).toEqual({ vendorId: 'openai', vendorSource: 'reported' });

    server.publish(
      knowledgeCatalog({ generatedAt: '2026-11-02T00:00:00.000Z', sonnetInput: 2.5 }),
      'fp-2'
    );
    let second = await sync();

    let next = await getKnowledge();
    expect(next?.version).toBe(second.snapshotId);

    let repriced = await next!.prepare([request]);
    expect(repriced.resolveModel({ ...request, at: new Date() }).offering?.pricing).toEqual(
      textPricing(2.5)
    );
  });

  it('falls back to Postgres and restores the version key when Redis lost it', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');
    let first = await sync();

    await getSessionRedis().del(knowledgeVersionKey);
    expireKnowledgeCheck();

    expect((await getKnowledge())?.version).toBe(first.snapshotId);
    expect(await getSessionRedis().get(knowledgeVersionKey)).toBe(
      knowledgeVersionOf(
        await testDb.knowledgeSnapshot.findUniqueOrThrow({ where: { id: first.snapshotId } })
      )
    );
  });

  it('settles sessions against the synced snapshot', async () => {
    await store.ready();
    server.publish(knowledgeCatalog(), 'fp-1');
    await sync();

    let harness = await createSessionHarness();
    let at = new Date(Date.now() - 60 * 60 * 1000);

    let [record] = await harness.ingest([
      {
        type: 'model.request',
        at,
        sessionId: 'knowledge-1',
        data: {
          model: { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
          usage: { inputUncached: 1_000_000, output: 100_000 }
        }
      },
      {
        type: 'model.request',
        at: minutesAfter(at, 1),
        sessionId: 'knowledge-1',
        data: { model: { id: 'mystery-model' }, usage: { inputUncached: 10, output: 1 } }
      }
    ]);
    let sessionKey = record!.ctx.session_key!;

    await settleSession({ sessionKey });

    let models = (await harness.session(sessionKey))!.summary!.models;
    let sonnet = models.find(model => model.modelId == 'claude-sonnet-4-5');
    let mystery = models.find(model => model.rawIds.includes('mystery-model'));

    expect(sonnet).toMatchObject({ rawIds: ['claude-sonnet-4-5-20250929'], requests: 1 });
    expect(sonnet!.costComputedUsd?.toString()).toBe('4.5');
    expect(mystery?.modelId).toBeUndefined();
    expect(mystery?.costComputedUsd).toBeUndefined();
  });

  it('prunes change log rows past retention', async () => {
    server.publish(knowledgeCatalog(), 'fp-1');
    await sync();
    server.publish(
      knowledgeCatalog({ generatedAt: '2026-11-02T00:00:00.000Z', sonnetInput: 2.5 }),
      'fp-2'
    );
    await sync();

    await testDb.knowledgeChange.updateMany({ data: { createdAt: new Date('2025-01-01') } });

    expect(await pruneKnowledgeChanges({ now: new Date('2026-11-13') })).toEqual({
      deleted: 1
    });
    expect(await testDb.knowledgeChange.count()).toBe(0);
  });
});
