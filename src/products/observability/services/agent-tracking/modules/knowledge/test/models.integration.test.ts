import type { Offering, Pricing } from '@metorial/model-catalog/src/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { getId, snowflake } from '@mtsrc/agent-tracking-db';
import { cleanDatabase, testDb } from '@mtsrc/agent-tracking-db/test/setup';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';

let generatedAt = new Date('2026-11-13T10:00:00.000Z');

let pricing = (input: number): Pricing => ({
  currency: 'USD',
  text: {
    input,
    output: input * 5,
    cacheRead: input / 10,
    cacheWrite: [{ ttl: '5m', price: input * 1.25 }],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
});

let offeringData = (id: string) =>
  ({
    id,
    vendorId: 'anthropic',
    vendorModelId: 'claude-fable-5',
    modelId: 'anthropic/claude-fable-5',
    pricing: pricing(10)
  }) as Offering;

let createSource = () =>
  testDb.knowledgeSource.create({
    data: { ...getId('knowledgeSource'), url: `https://${crypto.randomUUID()}.example` }
  });

let createSnapshot = (sourceOid: bigint, fingerprint: string) =>
  testDb.knowledgeSnapshot.create({
    data: {
      ...getId('knowledgeSnapshot'),
      fingerprint,
      schemaVersion: 1,
      status: 'current',
      counts: { offering: { total: 1, added: 1, changed: 0, removed: 0 } },
      generatedAt,
      sourceOid
    }
  });

let createOffering = () => {
  let id = `anthropic:${crypto.randomUUID()}`;

  return testDb.knowledgeOffering.create({
    data: {
      oid: snowflake.nextId(),
      id,
      vendorId: 'anthropic',
      vendorModelId: 'claude-fable-5',
      variantKey: '',
      name: 'Claude Fable 5',
      kind: 'model',
      status: 'active',
      free: false,
      modelId: 'anthropic/claude-fable-5',
      pricingHash: 'hash-10',
      data: offeringData(id),
      contentHash: 'content-1'
    }
  });
};

let openPeriod = (d: { offeringOid: bigint; input: number; validFrom: Date }) =>
  testDb.knowledgePricePeriod.create({
    data: {
      ...getId('knowledgePricePeriod'),
      vendorId: 'anthropic',
      modelId: 'anthropic/claude-fable-5',
      pricing: pricing(d.input),
      pricingHash: `hash-${d.input}`,
      origin: 'observed',
      validFrom: d.validFrom,
      confirmedAt: d.validFrom,
      offeringOid: d.offeringOid,
      openOfferingOid: d.offeringOid
    }
  });

describe('knowledge data models', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('keeps one snapshot per fingerprint and source', async () => {
    let source = await createSource();
    let other = await createSource();

    await createSnapshot(source.oid, 'fp-1');
    await createSnapshot(other.oid, 'fp-1');

    await expect(createSnapshot(source.oid, 'fp-1')).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows only one open price period per offering', async () => {
    let offering = await createOffering();
    let first = await openPeriod({
      offeringOid: offering.oid,
      input: 10,
      validFrom: generatedAt
    });

    await expect(
      openPeriod({ offeringOid: offering.oid, input: 12, validFrom: generatedAt })
    ).rejects.toMatchObject({ code: 'P2002' });

    let changedAt = new Date('2026-11-14T10:00:00.000Z');
    await testDb.knowledgePricePeriod.update({
      where: { oid: first.oid },
      data: { validTo: changedAt, closeReason: 'changed', openOfferingOid: null }
    });
    let second = await openPeriod({
      offeringOid: offering.oid,
      input: 12,
      validFrom: changedAt
    });

    let loaded = await testDb.knowledgeOffering.findUniqueOrThrow({
      where: { oid: offering.oid },
      include: { openPricePeriod: true, pricePeriods: { orderBy: { validFrom: 'asc' } } }
    });

    expect(loaded.openPricePeriod?.id).toBe(second.id);
    expect(
      loaded.pricePeriods.map(period => [period.pricingHash, period.closeReason])
    ).toEqual([
      ['hash-10', 'changed'],
      ['hash-12', null]
    ]);
  });

  it('round-trips typed JSON for entities, periods and the change log', async () => {
    let source = await createSource();
    let snapshot = await createSnapshot(source.oid, 'fp-json');
    let offering = await createOffering();
    let period = await openPeriod({
      offeringOid: offering.oid,
      input: 3,
      validFrom: generatedAt
    });

    await testDb.knowledgeChange.create({
      data: {
        ...getId('knowledgeChange'),
        entity: 'offering',
        entityId: offering.id,
        change: 'added',
        after: offering.data,
        snapshotOid: snapshot.oid
      }
    });

    let change = await testDb.knowledgeChange.findFirstOrThrow({
      where: { entity: 'offering', entityId: offering.id }
    });

    expect(change.after).toEqual(offeringData(offering.id));
    expect(change.before).toBeNull();
    expect(period.pricing).toEqual(pricing(3));
    expect(snapshot.anomalies).toEqual([]);
  });

  it('stores organization price overrides with exact multipliers', async () => {
    let { organization, project } = await createTestScope();

    let override = await testDb.priceOverride.create({
      data: {
        ...getId('priceOverride'),
        name: 'Anthropic via Bedrock',
        target: 'lab',
        targetId: 'anthropic',
        vendorId: 'aws-bedrock',
        kind: 'multiplier',
        multiplier: '0.825',
        validFrom: generatedAt,
        organizationOid: organization.oid,
        projectOid: project.oid
      }
    });
    let rates = await testDb.priceOverride.create({
      data: {
        ...getId('priceOverride'),
        name: 'Contract rates',
        target: 'model',
        targetId: 'anthropic/claude-fable-5',
        kind: 'rates',
        rates: pricing(8),
        validFrom: generatedAt,
        organizationOid: organization.oid
      }
    });

    let active = await testDb.priceOverride.findMany({
      where: { organizationOid: organization.oid, archivedAt: null },
      orderBy: { createdAt: 'asc' }
    });

    expect(override.multiplier?.toString()).toBe('0.825');
    expect(rates.rates).toEqual(pricing(8));
    expect(active.map(item => item.id)).toEqual([override.id, rates.id]);
  });

  it('stores rebuild filters on rebuild runs', async () => {
    let { organization } = await createTestScope();

    let run = await testDb.rebuildRun.create({
      data: {
        ...getId('rebuildRun'),
        layers: ['summary', 'facts'],
        reason: 'catalog_change',
        filter: { modelIds: ['anthropic/claude-fable-5'], vendorIds: ['anthropic'] },
        rangeFrom: generatedAt,
        rangeTo: new Date('2026-11-14T00:00:00.000Z'),
        organizationOid: organization.oid
      }
    });

    expect(run.filter).toEqual({
      modelIds: ['anthropic/claude-fable-5'],
      vendorIds: ['anthropic']
    });
  });
});
