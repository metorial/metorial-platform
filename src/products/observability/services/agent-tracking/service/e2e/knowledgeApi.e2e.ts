import { describe, expect, it } from 'vitest';
import {
  addApiFixtures,
  apiFixture
} from '@mtsrc/agent-tracking-module-knowledge/test/api/catalog';
import { importKnowledge } from './knowledgeSupport';
import { agentTracking, rpcErrorCode } from './support';

let importApiKnowledge = async (
  options: { largeInput?: number; withSmall?: boolean } = {}
) => {
  let result = await importKnowledge({ extend: catalog => addApiFixtures(catalog, options) });
  expect(result.status).toBe('applied');

  return result as typeof result & { snapshotId: string };
};

let idsOf = (items: { id: string }[]) => items.map(item => item.id);

describe('knowledge API', () => {
  it('browses labs and families', async () => {
    await importApiKnowledge();
    let knowledge = agentTracking().knowledge;

    let labs = await knowledge.labs.list({ limit: 100 });
    expect(idsOf(labs.items)).toEqual(expect.arrayContaining(['anthropic', 'mistral']));
    expect(idsOf(labs.items)).not.toContain('amazon');

    let lab = await knowledge.labs.get({ labId: 'mistral' });
    expect(lab).toMatchObject({
      object: 'agent_tracking#knowledge_lab',
      id: 'mistral',
      name: 'Mistral AI',
      country: 'FR',
      familyCount: 1,
      modelCount: 4,
      firstPartyVendors: [
        { id: 'mistral', name: 'Mistral', kind: 'first-party', status: 'active' }
      ]
    });
    expect(lab).not.toHaveProperty('oid');
    expect(await rpcErrorCode(knowledge.labs.get({ labId: 'amazon' }))).toBe('not_found');

    let families = await knowledge.families.list({ labIds: ['mistral'] });
    expect(idsOf(families.items)).toEqual(['mistral-large']);
    expect(families.items[0]).toMatchObject({
      object: 'agent_tracking#knowledge_family',
      line: 'large',
      latestModelId: apiFixture.latestModel
    });

    let family = await knowledge.families.get({ familyId: 'mistral-large' });
    expect(idsOf(family.models)).toEqual([
      'mistral-large-3',
      'mistral-large-2-1',
      'mistral-large-2'
    ]);
    expect(family.latestModel).toMatchObject({
      object: 'agent_tracking#knowledge_model',
      id: 'mistral-large-3'
    });
  });

  it('filters, searches and pages models and gets one with its graph', async () => {
    await importApiKnowledge();
    let knowledge = agentTracking().knowledge;

    let longContext = await knowledge.models.list({
      labIds: ['mistral'],
      minContextTokens: 250_000
    });
    expect(idsOf(longContext.items)).toEqual(['mistral-large-3']);

    let openWeights = await knowledge.models.list({ openWeights: true, labIds: ['mistral'] });
    expect(idsOf(openWeights.items)).toEqual(['mistral-small-3']);

    let reasoning = await knowledge.models.list({
      capabilities: ['reasoning'],
      inputModalities: ['text'],
      outputModalities: ['text'],
      familyIds: ['mistral-large'],
      kinds: ['chat'],
      statuses: ['active']
    });
    expect(reasoning.items).toEqual([]);

    let search = await knowledge.models.list({ search: 'mistral large 3' });
    expect(search.items[0]?.id).toBe('mistral-large-3');

    let pages: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 10; page++) {
      let list = await knowledge.models.list({ labIds: ['mistral'], limit: 1, after });
      pages.push(...idsOf(list.items));
      if (!list.pagination.has_more_after) break;
      after = list.items[0]!.id;
    }
    expect(pages).toEqual([
      'mistral-large-2',
      'mistral-large-2-1',
      'mistral-large-3',
      'mistral-small-3'
    ]);

    let model = await knowledge.models.get({ modelId: 'mistral-large-3' });
    expect(model).toMatchObject({
      object: 'agent_tracking#knowledge_model',
      name: 'Mistral Large 3',
      labId: 'mistral',
      familyId: 'mistral-large',
      contextTokens: 256_000,
      versionSort: [3],
      capabilityKeys: ['tools', 'structured-output', 'temperature']
    });
    expect(new Date(model.releaseDate!).toISOString()).toBe('2025-11-01T00:00:00.000Z');
    expect(idsOf(model.releases)).toEqual([...apiFixture.releases].reverse());
    expect(model.pointers).toEqual([
      expect.objectContaining({
        id: apiFixture.pointer,
        target: { kind: 'model', modelId: 'mistral-large-3' }
      })
    ]);

    let firstParty = model.offerings.find(item => item.id == apiFixture.offerings.firstParty);
    expect(firstParty).toMatchObject({
      object: 'agent_tracking#knowledge_offering',
      vendorId: 'mistral',
      price: { pricing: { text: { input: 2, output: 6 } } }
    });
    expect(firstParty?.price?.pricePeriodId).toMatch(/^atpp_/);
    expect(
      model.offerings.find(item => item.id == apiFixture.offerings.unpriced)?.price
    ).toBeNull();

    expect(await rpcErrorCode(knowledge.models.get({ modelId: 'no-such-model' }))).toBe(
      'not_found'
    );
  });

  it('lists vendors, cheapest offerings and agents', async () => {
    await importApiKnowledge();
    let knowledge = agentTracking().knowledge;

    let inference = await knowledge.vendors.list({ kinds: ['inference'] });
    expect(inference.items.find(vendor => vendor.id == 'together-ai')).toMatchObject({
      object: 'agent_tracking#knowledge_vendor',
      organizationId: 'together',
      offeringCount: 2,
      endpoints: [
        expect.objectContaining({
          object: 'agent_tracking#knowledge_endpoint',
          id: 'together-api',
          baseUrlHost: 'api.together.xyz'
        })
      ]
    });

    let vendor = await knowledge.vendors.get({ vendorId: 'mistral' });
    expect(vendor).toMatchObject({ kind: 'first-party', offeringCount: 2 });
    expect(await rpcErrorCode(knowledge.vendors.get({ vendorId: 'nope' }))).toBe('not_found');

    let cheapest = await knowledge.offerings.list({
      modelIds: ['mistral-large-3'],
      free: false,
      sort: 'input_price'
    });
    expect(idsOf(cheapest.items)).toEqual([
      apiFixture.offerings.inference,
      apiFixture.offerings.firstParty,
      apiFixture.offerings.unpriced
    ]);

    let byOutput = await knowledge.offerings.list({
      familyIds: ['mistral-large'],
      vendorIds: ['together-ai'],
      sort: 'output_price',
      order: 'desc',
      limit: 1
    });
    expect(idsOf(byOutput.items)).toEqual([apiFixture.offerings.inference]);
    expect(byOutput.pagination.has_more_after).toBe(true);

    let next = await knowledge.offerings.list({
      familyIds: ['mistral-large'],
      vendorIds: ['together-ai'],
      sort: 'output_price',
      order: 'desc',
      limit: 1,
      after: byOutput.items[0]!.id
    });
    expect(idsOf(next.items)).toEqual([apiFixture.offerings.free]);
    expect(next.items[0]).toMatchObject({ variantKey: 'free', free: true });

    let unpriced = await knowledge.offerings.list({ labIds: ['mistral'], priced: false });
    expect(idsOf(unpriced.items)).toEqual([apiFixture.offerings.unpriced]);

    let variants = await knowledge.offerings.list({
      variantKeys: ['free'],
      labIds: ['mistral']
    });
    expect(idsOf(variants.items)).toEqual([apiFixture.offerings.free]);

    let agents = await knowledge.agents.list({
      makerIds: ['mistral'],
      surfaces: ['ide'],
      openSource: true
    });
    expect(idsOf(agents.items)).toEqual([apiFixture.agent]);

    let agent = await knowledge.agents.get({ agentId: apiFixture.agent });
    expect(agent).toMatchObject({
      object: 'agent_tracking#knowledge_agent',
      makerId: 'mistral',
      defaultVendorId: 'mistral',
      aliases: ['le_chat'],
      vendors: [
        { vendorId: 'mistral', role: 'default' },
        { vendorId: 'together-ai', role: 'subscription' }
      ]
    });
    expect(await rpcErrorCode(knowledge.agents.get({ agentId: 'nope' }))).toBe('not_found');
  });

  it('hides removed entities unless asked and logs their removal', async () => {
    await importApiKnowledge({ withSmall: true });
    let second = await importApiKnowledge({ withSmall: false });
    let knowledge = agentTracking().knowledge;

    let live = await knowledge.models.list({ labIds: ['mistral'] });
    expect(idsOf(live.items)).not.toContain('mistral-small-3');

    let all = await knowledge.models.list({ labIds: ['mistral'], includeRemoved: true });
    let small = all.items.find(model => model.id == 'mistral-small-3');
    expect(small?.removedAt).toBeTruthy();

    let offerings = await knowledge.offerings.list({ vendorIds: ['mistral'] });
    expect(idsOf(offerings.items)).toEqual([apiFixture.offerings.firstParty]);
    let withRemoved = await knowledge.offerings.list({
      vendorIds: ['mistral'],
      includeRemoved: true
    });
    expect(idsOf(withRemoved.items)).toContain(apiFixture.offerings.small);

    let removed = await knowledge.changes.list({
      snapshotId: second.snapshotId,
      changes: ['removed'],
      limit: 100
    });
    expect(removed.items.map(change => [change.entity, change.entityId]).sort()).toEqual([
      ['model', 'mistral-small-3'],
      ['offering', apiFixture.offerings.small]
    ]);
    expect(removed.items[0]).toMatchObject({
      object: 'agent_tracking#knowledge_change',
      change: 'removed',
      snapshotId: second.snapshotId,
      after: null
    });

    let modelChanges = await knowledge.changes.list({
      entities: ['model'],
      entityIds: ['mistral-small-3'],
      order: 'desc',
      limit: 1
    });
    expect(modelChanges.items[0]).toMatchObject({ change: 'removed' });
    expect(modelChanges.items[0]!.before).toMatchObject({ id: 'mistral-small-3' });

    expect(
      await rpcErrorCode(knowledge.changes.list({ snapshotId: 'atks_does_not_exist' }))
    ).toBe('not_found');
  });

  it('returns price history for an offering, model, family and vendor in a range', async () => {
    await importApiKnowledge({ largeInput: 2 });
    let beforeChange = new Date();
    await importApiKnowledge({ largeInput: 2.5 });
    let afterChange = new Date();
    let knowledge = agentTracking().knowledge;

    let history = await knowledge.prices.history({
      offeringId: apiFixture.offerings.firstParty,
      limit: 100
    });
    let [previous, current] = history.items.slice(-2);
    expect(previous).toMatchObject({
      object: 'agent_tracking#knowledge_price_period',
      offeringId: apiFixture.offerings.firstParty,
      vendorId: 'mistral',
      modelId: 'mistral-large-3',
      closeReason: 'changed',
      pricing: { text: { input: 2 } }
    });
    expect(current).toMatchObject({ validTo: null, pricing: { text: { input: 2.5 } } });
    expect(new Date(current!.validFrom).getTime()).toBeGreaterThanOrEqual(
      beforeChange.getTime()
    );
    expect(new Date(previous!.validTo!).getTime()).toBe(
      new Date(current!.validFrom).getTime()
    );

    let untilChange = await knowledge.prices.history({
      offeringId: apiFixture.offerings.firstParty,
      to: beforeChange,
      limit: 100
    });
    expect(idsOf(untilChange.items)).not.toContain(current!.id);
    expect(idsOf(untilChange.items)).toContain(previous!.id);

    let sinceChange = await knowledge.prices.history({
      offeringId: apiFixture.offerings.firstParty,
      from: afterChange
    });
    expect(idsOf(sinceChange.items)).toEqual([current!.id]);

    let offeringIds = (items: { offeringId: string }[]) =>
      [...new Set(items.map(item => item.offeringId))].sort();
    let largeOfferings = [
      apiFixture.offerings.firstParty,
      apiFixture.offerings.free,
      apiFixture.offerings.inference
    ].sort();

    let byModel = await knowledge.prices.history({
      modelId: 'mistral-large-3',
      from: afterChange,
      limit: 100
    });
    expect(offeringIds(byModel.items)).toEqual(largeOfferings);

    let byFamily = await knowledge.prices.history({
      familyId: 'mistral-large',
      from: afterChange,
      limit: 100
    });
    expect(offeringIds(byFamily.items)).toEqual(largeOfferings);

    let byVendor = await knowledge.prices.history({
      vendorId: 'together-ai',
      from: afterChange,
      limit: 1
    });
    expect(byVendor.items).toHaveLength(1);
    expect(byVendor.pagination.has_more_after).toBe(true);

    expect(await rpcErrorCode(knowledge.prices.history({}))).toBe('bad_request');
    expect(await rpcErrorCode(knowledge.prices.history({ offeringId: 'nope' }))).toBe(
      'not_found'
    );
  });

  it('explains how a request resolves, including misses', async () => {
    let imported = await importApiKnowledge();
    let knowledge = agentTracking().knowledge;

    let viaPointer = await knowledge.resolve({
      raw: 'mistral-large-latest',
      provider: 'mistral'
    });
    expect(viaPointer).toMatchObject({
      object: 'agent_tracking#knowledge_resolution',
      snapshotId: imported.snapshotId,
      resolved: true,
      matchedBy: 'namespace',
      names: [{ id: apiFixture.names.pointer }],
      pointers: [
        { id: apiFixture.pointer, targetAt: { kind: 'model', modelId: 'mistral-large-3' } }
      ],
      model: { id: 'mistral-large-3' },
      vendor: { id: 'mistral' },
      vendorSource: 'reported',
      offering: { id: apiFixture.offerings.firstParty },
      pricePeriod: { offeringId: apiFixture.offerings.firstParty, validTo: null },
      priceAssumed: false
    });
    expect(viaPointer).not.toHaveProperty('oid');

    let viaAgent = await knowledge.resolve({
      raw: 'Mistral Large 3',
      agent: 'le_chat',
      subscription: true
    });
    expect(viaAgent).toMatchObject({
      matchedBy: 'raw',
      agent: { id: apiFixture.agent },
      vendorSource: 'agent',
      offering: { id: apiFixture.offerings.inference }
    });

    let miss = await knowledge.resolve({ raw: 'mystery-model-9' });
    expect(miss).toMatchObject({
      resolved: false,
      matchedBy: null,
      names: [],
      model: null,
      offering: null,
      pricePeriod: null,
      priceAssumed: null
    });
  });

  it('returns the price that applied at a time, before and after a price change', async () => {
    await importApiKnowledge({ largeInput: 2 });
    await importApiKnowledge({ largeInput: 2.5 });
    let knowledge = agentTracking().knowledge;
    let offeringId = apiFixture.offerings.firstParty;

    let after = await knowledge.prices.at({ offeringId, at: new Date() });
    expect(after).toMatchObject({
      object: 'agent_tracking#knowledge_price_at',
      offering: { id: offeringId },
      pricePeriod: { validTo: null, pricing: { text: { input: 2.5 } } },
      priceAssumed: false
    });

    let changedAt = new Date(after.pricePeriod!.validFrom);
    let beforeChange = new Date(changedAt.getTime() - 1);

    let before = await knowledge.prices.at({ offeringId, at: beforeChange });
    expect(before).toMatchObject({
      pricePeriod: { closeReason: 'changed', pricing: { text: { input: 2 } } },
      priceAssumed: false
    });
    expect(new Date(before.pricePeriod!.validTo!)).toEqual(changedAt);

    let atChange = await knowledge.prices.at({ offeringId, at: changedAt });
    expect(atChange.pricePeriod!.id).toBe(after.pricePeriod!.id);

    let byRequest = await knowledge.prices.at({
      raw: 'mistral-large-3',
      provider: 'mistral',
      at: beforeChange
    });
    expect(byRequest).toMatchObject({
      vendorSource: 'reported',
      offering: { id: offeringId },
      pricePeriod: { id: before.pricePeriod!.id }
    });

    let unresolved = await knowledge.prices.at({ raw: 'mystery-model-9' });
    expect(unresolved).toMatchObject({
      offering: null,
      pricePeriod: null,
      priceAssumed: null
    });

    expect(await rpcErrorCode(knowledge.prices.at({ offeringId: 'nope:nope' }))).toBe(
      'not_found'
    );
  });

  it('lists snapshots and returns the current one without archives', async () => {
    let imported = await importApiKnowledge();
    let knowledge = agentTracking().knowledge;

    let current = await knowledge.snapshots.current({});
    expect(current).toMatchObject({
      object: 'agent_tracking#knowledge_snapshot',
      id: imported.snapshotId,
      status: 'current',
      hasArchive: true,
      source: { url: 'import://snapshots' }
    });
    expect(current).not.toHaveProperty('archive');
    expect(current!.counts.model).toMatchObject({ total: 14 });

    let latest = await knowledge.snapshots.list({ order: 'desc', limit: 2 });
    expect(latest.items[0]!.id).toBe(imported.snapshotId);
    expect(latest.items[1]!.status).toBe('superseded');
    for (let snapshot of latest.items) expect(snapshot).not.toHaveProperty('archive');

    let currentOnly = await knowledge.snapshots.list({ statuses: ['current'] });
    expect(idsOf(currentOnly.items)).toEqual([imported.snapshotId]);

    let fetched = await knowledge.snapshots.get({ snapshotId: latest.items[1]!.id });
    expect(fetched).toMatchObject({ id: latest.items[1]!.id, status: 'superseded' });
    expect(fetched).not.toHaveProperty('archive');

    expect(await rpcErrorCode(knowledge.snapshots.get({ snapshotId: 'nope' }))).toBe(
      'not_found'
    );
  });
});
