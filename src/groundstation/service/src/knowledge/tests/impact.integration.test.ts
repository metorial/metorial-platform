import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  knowledgeImpactQueue,
  processKnowledgeImpact,
  type KnowledgeImpactJob
} from '../../queues/knowledgeImpact';
import { inlineOrganizationRebuilds, inlineRebuildQueues } from '../../rebuild/tests/inline';
import { bucketStart } from '../../sessions/buckets';
import { closeSessionRedis, getSessionRedis } from '../../sessions/redis';
import { settleSession } from '../../sessions/settle';
import { createSessionHarness, store } from '../../sessions/tests/harness';
import { cleanDatabase, testDb } from '../../test/setup';
import { resetKnowledgeCache } from '../cache';
import { correctPrices } from '../corrections';
import { queuePriceOverrideImpact } from '../impact';
import { syncKnowledge } from '../ingest';
import { loadOverrideFilter } from '../triggers';
import { knowledgeVersionKey } from '../version';
import {
  knowledgeCatalog,
  name,
  startKnowledgeServer,
  textPricing,
  type KnowledgeFixtureServer
} from './fixture';

let hourMs = 60 * 60 * 1000;
let dayMs = 24 * hourMs;

let sonnet = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };
let gpt = { id: 'gpt-5' };
let sonnetOfferingId = 'anthropic:claude-sonnet-4-5-20250929';

let server: KnowledgeFixtureServer;
let jobs: KnowledgeImpactJob[] = [];

let hoursAgo = (hours: number) => new Date(Date.now() - hours * hourMs);

let dayOf = (date: Date) => bucketStart(date, 1440);

let publishAndSync = async (
  catalog: ReturnType<typeof knowledgeCatalog>,
  fingerprint: string
) => {
  server.publish(catalog, fingerprint);

  let result = await syncKnowledge({ url: server.url, guardrails: false });
  expect(result.status).toBe('applied');

  return result;
};

type Harness = Awaited<ReturnType<typeof createSessionHarness>>;

let settleIn = async (
  harness: Harness,
  requests: { at: Date; model: Record<string, unknown>; family?: string }[]
) => {
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

  return sessionKey;
};

let sessions = () => store.collections().sessions;

let costOf = async (sessionKey: string) =>
  (await sessions().findOne({ _id: sessionKey }))!.summary?.costComputedUsd?.toString();

// A rebuilt summary replaces the whole `summary`, so a marker on it shows which sessions were
// re-settled.
let markSettled = async (keys: string[]) => {
  await sessions().updateMany({ _id: { $in: keys } }, { $set: { 'summary.marker': true } });
};

let resettled = async (keys: string[]) => {
  let documents = await sessions()
    .find({ _id: { $in: keys } })
    .toArray();

  return documents
    .filter(document => !(document.summary as { marker?: boolean } | undefined)?.marker)
    .map(document => document._id)
    .sort();
};

let processJobs = async () => {
  let results: { impacts: unknown[]; run?: unknown }[] = [];
  for (let job of jobs.splice(0)) results.push(await processKnowledgeImpact(job));

  return results as [{ impacts: unknown[]; run?: unknown }, ...typeof results];
};

let sonnetPeriods = async () =>
  (
    await testDb.knowledgePricePeriod.findMany({
      where: { offering: { id: sonnetOfferingId } },
      orderBy: [{ validFrom: 'asc' }, { createdAt: 'asc' }]
    })
  ).filter(period => !period.validTo || period.validTo > period.validFrom);

let inputRateOf = (period: { pricing: unknown }) =>
  (period.pricing as ReturnType<typeof textPricing>).text!.input;

describe('knowledge impact', () => {
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
    vi.restoreAllMocks();

    jobs = [];
    vi.spyOn(knowledgeImpactQueue, 'add').mockImplementation((async (
      job: KnowledgeImpactJob
    ) => {
      jobs.push(job);
    }) as never);
  });

  it('rebuilds only the organization and sessions a price change touches', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );
    jobs.length = 0;

    let sonnetOrg = await createSessionHarness();
    let recent = await settleIn(sonnetOrg, [{ at: hoursAgo(1), model: sonnet }]);
    let older = await settleIn(sonnetOrg, [{ at: hoursAgo(50), model: sonnet }]);
    let sameOrgGpt = await settleIn(sonnetOrg, [
      { at: hoursAgo(1), model: gpt, family: 'codex' }
    ]);

    let gptOrg = await createSessionHarness();
    let otherOrgGpt = await settleIn(gptOrg, [
      { at: hoursAgo(1), model: gpt, family: 'codex' }
    ]);

    let keys = [recent, older, sameOrgGpt, otherOrgGpt];
    expect(await Promise.all(keys.map(costOf))).toEqual(['4.5', '4.5', '1.875', '1.875']);
    await markSettled(keys);

    let organizations = inlineOrganizationRebuilds();
    let queues = inlineRebuildQueues();

    let changedAt = hoursAgo(3);
    let synced = await publishAndSync(
      knowledgeCatalog({ generatedAt: changedAt.toISOString(), sonnetInput: 2.5 }),
      'fp-2'
    );
    expect(jobs).toEqual([{ type: 'snapshot', snapshotId: synced.snapshotId }]);

    let [{ impacts }] = (await processJobs()) as [{ impacts: unknown[] }];
    expect(impacts).toEqual([
      { filter: { modelIds: ['claude-sonnet-4-5'] }, from: changedAt.toISOString(), to: null }
    ]);

    let runs = await organizations.start();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      organizationOid: sonnetOrg.scope.organization.oid,
      reason: 'catalog_change',
      layers: ['summary', 'facts'],
      filter: { modelIds: ['claude-sonnet-4-5'] },
      rangeFrom: dayOf(changedAt)
    });

    expect(await queues.drain()).toEqual([recent]);
    expect(await resettled(keys)).toEqual([recent]);
    expect(await Promise.all(keys.map(costOf))).toEqual(['3.75', '4.5', '1.875', '1.875']);
  });

  it('becomes one recent rebuild per organization for a first snapshot', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );

    let [{ impacts }] = (await processJobs()) as [{ impacts: { filter: unknown }[] }];
    expect(impacts).toEqual([{ filter: null, from: expect.any(String), to: null }]);
  });

  it('rebuilds slices of a name that newly resolves', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );
    jobs.length = 0;

    let harness = await createSessionHarness();
    let unresolved = await settleIn(harness, [
      { at: hoursAgo(2), model: { id: 'Claude Sonnet Next' } }
    ]);
    let resolved = await settleIn(harness, [{ at: hoursAgo(2), model: sonnet }]);
    await markSettled([unresolved, resolved]);

    let before = (await sessions().findOne({ _id: unresolved }))!;
    expect(before.summary!.models[0]!.modelId).toBeUndefined();

    let organizations = inlineOrganizationRebuilds();
    let queues = inlineRebuildQueues();

    await publishAndSync(
      knowledgeCatalog({
        generatedAt: hoursAgo(1).toISOString(),
        extraNames: [
          name('display', 'Claude Sonnet Next', {
            kind: 'model',
            modelId: 'claude-sonnet-4-5'
          })
        ]
      }),
      'fp-2'
    );

    let [{ impacts }] = (await processJobs()) as [{ impacts: unknown[] }];
    expect(impacts).toEqual([
      {
        filter: { modelRaws: ['Claude Sonnet Next'] },
        from: new Date(0).toISOString(),
        to: null
      }
    ]);

    let runs = await organizations.start();
    expect(runs).toHaveLength(1);
    expect(runs[0]!.filter).toEqual({ modelRaws: ['Claude Sonnet Next'] });
    expect(runs[0]!.rangeFrom.getTime()).toBeGreaterThanOrEqual(Date.now() - 92 * dayMs);

    expect(await queues.drain()).toEqual([unresolved]);
    expect(await resettled([unresolved, resolved])).toEqual([unresolved]);

    let after = (await sessions().findOne({ _id: unresolved }))!;
    expect(after.summary!.models[0]!.modelId).toBe('claude-sonnet-4-5');
    expect(after.summary!.costComputedUsd?.toString()).toBe('4.5');
  });

  it('corrects a range inside one period and reprices what it covers', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );
    jobs.length = 0;

    let harness = await createSessionHarness();
    let session = await settleIn(harness, [
      { at: hoursAgo(4), model: sonnet },
      { at: hoursAgo(1), model: sonnet }
    ]);
    expect(await costOf(session)).toBe('9');

    let organizations = inlineOrganizationRebuilds();
    let queues = inlineRebuildQueues();
    let version = await getSessionRedis().get(knowledgeVersionKey);

    let from = hoursAgo(5);
    let to = hoursAgo(3);
    let result = await correctPrices({
      offeringId: sonnetOfferingId,
      from,
      to,
      pricing: textPricing(1),
      reason: 'Launch discount missing upstream',
      correctedBy: 'ops@example.com'
    });

    let periods = await sonnetPeriods();
    expect(
      periods.map(period => [
        period.origin,
        inputRateOf(period),
        period.validFrom,
        period.validTo
      ])
    ).toEqual([
      ['bootstrap', 3, periods[0]!.validFrom, from],
      ['correction', 1, from, to],
      ['bootstrap', 3, to, null]
    ]);
    expect(periods[0]!.closeReason).toBe('corrected');
    expect(periods[1]).toMatchObject({
      correctionReason: 'Launch discount missing upstream',
      correctedBy: 'ops@example.com'
    });
    expect(periods.filter(period => period.openOfferingOid)).toHaveLength(1);
    expect(result.periods.map(period => period.offering.id)).toContain(sonnetOfferingId);

    let change = await testDb.knowledgeChange.findFirstOrThrow({
      where: { entity: 'offering', entityId: sonnetOfferingId },
      orderBy: { createdAt: 'desc' }
    });
    expect(change.after).toMatchObject({
      offeringId: sonnetOfferingId,
      correction: { reason: 'Launch discount missing upstream', to: to.toISOString() }
    });
    expect(await getSessionRedis().get(knowledgeVersionKey)).not.toBe(version);

    expect(jobs).toEqual([
      {
        type: 'correction',
        offeringId: sonnetOfferingId,
        from: from.toISOString(),
        to: to.toISOString()
      }
    ]);
    await processJobs();

    let runs = await organizations.start();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ rangeFrom: dayOf(from), rangeTo: to });

    expect(await queues.drain()).toEqual([session]);
    expect(await costOf(session)).toBe('6');

    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(0.5).toISOString() }),
      'fp-1b'
    );
    expect((await sonnetPeriods()).map(period => inputRateOf(period))).toEqual([3, 1, 3]);
  });

  it('corrects a range spanning several periods', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(6).toISOString(), sonnetInput: 2.5 }),
      'fp-2'
    );
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(3).toISOString(), sonnetInput: 2 }),
      'fp-3'
    );
    expect((await sonnetPeriods()).map(period => inputRateOf(period))).toEqual([3, 2.5, 2]);

    let from = hoursAgo(8);
    let to = hoursAgo(2);
    await correctPrices({
      offeringId: sonnetOfferingId,
      from,
      to,
      pricing: textPricing(1),
      reason: 'Wrong prices published',
      correctedBy: 'ops@example.com'
    });

    let periods = await sonnetPeriods();
    expect(
      periods.map(period => [
        period.origin,
        inputRateOf(period),
        period.validFrom,
        period.validTo
      ])
    ).toEqual([
      ['bootstrap', 3, periods[0]!.validFrom, from],
      ['correction', 1, from, to],
      ['observed', 2, to, null]
    ]);
    expect(
      await testDb.knowledgePricePeriod.count({
        where: { offering: { id: sonnetOfferingId }, closeReason: 'corrected' }
      })
    ).toBe(3);
    expect(
      await testDb.knowledgePricePeriod.count({
        where: { offering: { id: sonnetOfferingId }, openOfferingOid: { not: null } }
      })
    ).toBe(1);
  });

  it('ends a price and reopens it once upstream changes', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );

    let harness = await createSessionHarness();
    let session = await settleIn(harness, [{ at: hoursAgo(1), model: sonnet }]);
    expect(await costOf(session)).toBe('4.5');

    let organizations = inlineOrganizationRebuilds();
    let queues = inlineRebuildQueues();
    jobs.length = 0;

    let endedAt = hoursAgo(2);
    await correctPrices({
      offeringId: sonnetOfferingId,
      from: endedAt,
      pricing: null,
      reason: 'Model is free during preview',
      correctedBy: 'ops@example.com'
    });
    expect(
      await testDb.knowledgePricePeriod.count({
        where: { offering: { id: sonnetOfferingId }, openOfferingOid: { not: null } }
      })
    ).toBe(0);

    await processJobs();
    await organizations.start();
    await queues.drain();
    expect(await costOf(session)).toBeUndefined();

    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(0.75).toISOString() }),
      'fp-1b'
    );
    expect(await sonnetPeriods()).toHaveLength(1);

    let changedAt = hoursAgo(0.5);
    await publishAndSync(
      knowledgeCatalog({ generatedAt: changedAt.toISOString(), sonnetInput: 2.5 }),
      'fp-2'
    );

    let periods = await sonnetPeriods();
    expect(
      periods.map(period => [
        period.origin,
        inputRateOf(period),
        period.validFrom,
        period.validTo
      ])
    ).toEqual([
      ['bootstrap', 3, periods[0]!.validFrom, endedAt],
      ['observed', 2.5, changedAt, null]
    ]);
  });

  it('rejects ranges that end before they start and unknown offerings', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );

    await expect(
      correctPrices({
        offeringId: sonnetOfferingId,
        from: hoursAgo(1),
        to: hoursAgo(2),
        pricing: textPricing(1),
        reason: 'r',
        correctedBy: 'c'
      })
    ).rejects.toThrow();
    await expect(
      correctPrices({
        offeringId: 'nobody:nothing',
        from: hoursAgo(2),
        pricing: textPricing(1),
        reason: 'r',
        correctedBy: 'c'
      })
    ).rejects.toThrow();
  });

  it('maps override targets to slice filters', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );

    let filterOf = (target: string, targetId: string | null, vendorId: string | null = null) =>
      loadOverrideFilter({ target: target as never, targetId, vendorId });

    expect(await filterOf('model', 'gpt-5')).toEqual({ modelIds: ['gpt-5'] });
    expect(await filterOf('family', 'claude-sonnet')).toEqual({
      modelIds: ['claude-sonnet-4-5']
    });
    expect(((await filterOf('lab', 'openai'))!.modelIds ?? []).sort()).toEqual(
      ['gpt-5', ...Array.from({ length: 8 }, (_, index) => `filler-${index}`)].sort()
    );
    expect(await filterOf('offering', sonnetOfferingId)).toEqual({
      modelIds: ['claude-sonnet-4-5']
    });
    expect(await filterOf('offering', 'nobody:nothing')).toEqual({});
    expect(await filterOf('vendor', 'aws-bedrock')).toEqual({ vendorIds: ['aws-bedrock'] });
    expect(await filterOf('agent', 'claude-code')).toEqual({
      clientFamilies: expect.arrayContaining(['claude-code', 'claude_code'])
    });
    expect(await filterOf('all', null)).toBeNull();
    expect(await filterOf('all', null, 'openai')).toEqual({ vendorIds: ['openai'] });
  });

  it('rebuilds what an override matched before and after it changed', async () => {
    await publishAndSync(
      knowledgeCatalog({ generatedAt: hoursAgo(10).toISOString() }),
      'fp-1'
    );

    let harness = await createSessionHarness();
    let sonnetSession = await settleIn(harness, [{ at: hoursAgo(5), model: sonnet }]);
    let gptSession = await settleIn(harness, [
      { at: hoursAgo(2), model: gpt, family: 'codex' }
    ]);
    let other = await createSessionHarness();
    await settleIn(other, [{ at: hoursAgo(2), model: gpt, family: 'codex' }]);
    await markSettled([sonnetSession, gptSession]);

    let queues = inlineRebuildQueues();
    jobs.length = 0;

    let organization = await testDb.organization.findUniqueOrThrow({
      where: { id: harness.scope.organization.id }
    });
    let validFrom = hoursAgo(6);
    await queuePriceOverrideImpact({
      organizationOid: organization.oid,
      projectOid: null,
      before: {
        target: 'family',
        targetId: 'claude-sonnet',
        vendorId: null,
        validFrom,
        validTo: hoursAgo(4)
      },
      after: {
        target: 'model',
        targetId: 'gpt-5',
        vendorId: null,
        validFrom: hoursAgo(3),
        validTo: null
      }
    });
    expect(jobs).toHaveLength(1);

    let [result] = await processJobs();
    expect(result.run).toMatchObject({
      reason: 'price_override',
      filter: { modelIds: ['claude-sonnet-4-5', 'gpt-5'] },
      rangeFrom: dayOf(validFrom)
    });
    expect(await testDb.rebuildRun.count({ where: { reason: 'price_override' } })).toBe(1);

    expect((await queues.drain()).sort()).toEqual([sonnetSession, gptSession].sort());

    await queuePriceOverrideImpact({
      organizationOid: organization.oid,
      projectOid: null,
      before: null,
      after: {
        target: 'model',
        targetId: 'unknown',
        vendorId: null,
        validFrom: hoursAgo(3),
        validTo: null
      }
    });
    let [nothing] = await processJobs();
    expect(nothing.run).toBeNull();
  });
});
