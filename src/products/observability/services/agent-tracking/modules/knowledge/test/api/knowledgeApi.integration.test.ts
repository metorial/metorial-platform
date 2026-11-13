import { gzipSync } from 'node:zlib';
import type { Paginator } from '@lowerdeck/pagination';
import type { Catalog } from '@metorial/model-catalog/src/types';
import { beforeAll, describe, expect, it } from 'vitest';
import { withTransaction } from '@mtsrc/agent-tracking-db';
import { expectServiceError } from '@mtsrc/agent-tracking-testing';
import { cleanDatabase, testDb } from '@mtsrc/agent-tracking-db/test/setup';
import { importKnowledgeSnapshot } from '../../src/lib/ingest';
import { knowledgeCatalog } from '../fixture';
import { knowledgeAgentService } from '../../src/services/api/knowledgeAgent';
import { knowledgeChangeService } from '../../src/services/api/knowledgeChange';
import { knowledgeFamilyService } from '../../src/services/api/knowledgeFamily';
import { knowledgeLabService } from '../../src/services/api/knowledgeLab';
import { knowledgeModelService } from '../../src/services/api/knowledgeModel';
import { knowledgeOfferingService } from '../../src/services/api/knowledgeOffering';
import { knowledgePriceService } from '../../src/services/api/knowledgePrice';
import { knowledgeSnapshotService } from '../../src/services/api/knowledgeSnapshot';
import { knowledgeVendorService } from '../../src/services/api/knowledgeVendor';
import { addApiFixtures, apiFixture } from './catalog';

let generatedAt = {
  first: '2026-11-01T00:00:00.000Z',
  second: '2026-11-02T00:00:00.000Z',
  third: '2026-11-03T00:00:00.000Z'
};

let snapshotIds: string[] = [];

let importCatalog = async (catalog: Catalog) => {
  let result = await importKnowledgeSnapshot({
    archive: gzipSync(JSON.stringify(catalog)),
    guardrails: false
  });
  expect(result.status).toBe('applied');

  snapshotIds.push(result.snapshotId!);
};

let idsOf = (items: { id: string }[]) => items.map(item => item.id);

let pageThrough = async <T extends { id: string }>(
  paginator: Paginator<T>,
  d: { limit: number; order?: 'asc' | 'desc'; useCursor?: boolean }
) => {
  let items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 50; page++) {
    let list = await paginator.run({ limit: d.limit, order: d.order, after });
    items.push(...list.items);

    if (!list.pagination.hasNextPage) return items;
    after = d.useCursor ? list.pagination.after : list.items[list.items.length - 1]!.id;
  }

  throw new Error('Pagination did not finish.');
};

describe('knowledge API services', () => {
  beforeAll(async () => {
    await cleanDatabase();

    await importCatalog(addApiFixtures(knowledgeCatalog({ generatedAt: generatedAt.first })));
    await importCatalog(
      addApiFixtures(knowledgeCatalog({ generatedAt: generatedAt.second }), {
        largeInput: 2.5,
        withSmall: false
      })
    );
    await importCatalog(
      addApiFixtures(knowledgeCatalog({ generatedAt: generatedAt.third }), {
        largeInput: 1.8,
        withSmall: false
      })
    );
  });

  describe('labs', () => {
    it('lists labs with counts and first-party vendors', async () => {
      let labs = await (await knowledgeLabService.listLabs({})).run({ limit: 100 });

      expect(idsOf(labs.items)).toEqual(['anthropic', 'mistral', 'openai']);
      expect(labs.items.find(lab => lab.id == 'mistral')).toMatchObject({
        familyCount: 1,
        modelCount: 3,
        firstPartyVendors: [expect.objectContaining({ id: 'mistral', kind: 'first-party' })]
      });
      expect(labs.items.find(lab => lab.id == 'openai')).toMatchObject({
        familyCount: 0,
        modelCount: 9
      });
    });

    it('pages through labs and gets one by id', async () => {
      let labs = await pageThrough(await knowledgeLabService.listLabs({}), { limit: 1 });
      expect(idsOf(labs)).toEqual(['anthropic', 'mistral', 'openai']);

      let lab = await knowledgeLabService.getLabById({ labId: 'mistral' });
      expect(lab).toMatchObject({ name: 'Mistral AI', modelCount: 3 });
      expect(lab.data.country).toBe('FR');

      await expectServiceError(
        knowledgeLabService.getLabById({ labId: 'amazon' }),
        'not_found'
      );
    });
  });

  describe('families', () => {
    it('filters families by lab and kind', async () => {
      let mistral = await (
        await knowledgeFamilyService.listFamilies({ labIds: ['mistral'] })
      ).run({});
      expect(idsOf(mistral.items)).toEqual(['mistral-large']);

      let none = await (
        await knowledgeFamilyService.listFamilies({ kinds: ['image'] })
      ).run({});
      expect(none.items).toEqual([]);

      let empty = await (await knowledgeFamilyService.listFamilies({ labIds: [] })).run({});
      expect(empty.items).toEqual([]);
    });

    it('gets a family with models by version and its latest model', async () => {
      let family = await knowledgeFamilyService.getFamilyById({ familyId: 'mistral-large' });

      expect(idsOf(family.models)).toEqual([
        'mistral-large-3',
        'mistral-large-2-1',
        'mistral-large-2'
      ]);
      expect(family.latestModel?.id).toBe('mistral-large-3');
    });
  });

  describe('models', () => {
    it('filters by lab, family, kind, open weights, modalities, capabilities and context', async () => {
      let run = async (filters: Parameters<typeof knowledgeModelService.listModels>[0]) =>
        idsOf(
          (await (await knowledgeModelService.listModels(filters)).run({ limit: 100 })).items
        );

      expect(await run({ labIds: ['mistral'] })).toEqual([
        'mistral-large-2',
        'mistral-large-2-1',
        'mistral-large-3'
      ]);
      expect(await run({ familyIds: ['claude-sonnet'] })).toEqual(['claude-sonnet-4-5']);
      expect(await run({ kinds: ['embedding'] })).toEqual([]);
      expect(await run({ openWeights: true })).toEqual([]);
      expect(await run({ openWeights: true, includeRemoved: true })).toEqual([
        'mistral-small-3'
      ]);
      expect(await run({ labIds: ['mistral'], inputModalities: ['text', 'image'] })).toEqual([
        'mistral-large-2',
        'mistral-large-2-1',
        'mistral-large-3'
      ]);
      expect(await run({ capabilities: ['reasoning'], includeRemoved: true })).toEqual([
        'mistral-small-3'
      ]);
      expect(await run({ minContextTokens: 250_000 })).toEqual(['mistral-large-3']);
      expect(await run({ statuses: [] })).toEqual([]);
    });

    it('searches names by substring and similarity, best match first', async () => {
      let search = async (query: string) =>
        idsOf(
          (
            await (
              await knowledgeModelService.listModels({ search: query })
            ).run({ limit: 100 })
          ).items
        );

      expect(await search('mistral large 3')).toEqual(
        expect.arrayContaining(['mistral-large-3'])
      );
      expect((await search('mistral large 3'))[0]).toBe('mistral-large-3');
      let large = await search('Large 2.1');
      expect(large[0]).toBe('mistral-large-2-1');
      expect(large).not.toContain('claude-sonnet-4-5');
      expect(await search('sonnet')).toEqual(['claude-sonnet-4-5']);
      expect(await search('mistrl larg')).toEqual(
        expect.arrayContaining(['mistral-large-2', 'mistral-large-2-1', 'mistral-large-3'])
      );
      expect(await search('100%_')).toEqual([]);
      expect(await search('zzzz-no-such-model')).toEqual([]);
    });

    it('serves the search predicate from the trigram indexes', async () => {
      let plan = await withTransaction(async tdb => {
        await tdb.$executeRawUnsafe('SET LOCAL enable_seqscan = off');

        return await tdb.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
          `EXPLAIN SELECT m."id" FROM "KnowledgeModel" m
           WHERE m."name" ILIKE '%large%' OR m."id" ILIKE '%large%'
             OR 'large' <% m."name" OR 'large' <% m."id"`
        );
      });
      let text = plan.map(row => row['QUERY PLAN']).join('\n');

      expect(text).toContain('KnowledgeModel_name_trgm_idx');
      expect(text).toContain('KnowledgeModel_id_trgm_idx');
    });

    it('pages forward and backward with ids and encoded cursors', async () => {
      let all = idsOf(
        (await (await knowledgeModelService.listModels({})).run({ limit: 100 })).items
      );
      expect(all).toHaveLength(13);
      expect(all).toEqual([...all].sort());

      let paginator = await knowledgeModelService.listModels({});
      expect(idsOf(await pageThrough(paginator, { limit: 4 }))).toEqual(all);
      expect(idsOf(await pageThrough(paginator, { limit: 5, useCursor: true }))).toEqual(all);
      expect(idsOf(await pageThrough(paginator, { limit: 3, order: 'desc' }))).toEqual(
        [...all].reverse()
      );

      let backward = await paginator.run({ limit: 3, before: all[6] });
      expect(idsOf(backward.items)).toEqual(all.slice(3, 6));
      expect(backward.pagination).toMatchObject({ hasNextPage: true, hasPreviousPage: true });

      let start = await paginator.run({ limit: 3, before: all[3] });
      expect(idsOf(start.items)).toEqual(all.slice(0, 3));
      expect(start.pagination.hasPreviousPage).toBe(false);

      let searched = await knowledgeModelService.listModels({ search: 'mistral large' });
      let ranked = idsOf((await searched.run({ limit: 100 })).items);
      expect(idsOf(await pageThrough(searched, { limit: 1 }))).toEqual(ranked);
    });

    it('gets a model with releases, pointers and priced offerings', async () => {
      let model = await knowledgeModelService.getModelById({ modelId: 'mistral-large-3' });

      expect(model.contextTokens).toBe(256_000);
      expect(idsOf(model.releases)).toEqual([...apiFixture.releases].reverse());
      expect(idsOf(model.pointers)).toEqual([apiFixture.pointer]);
      expect(idsOf(model.offerings)).toEqual([
        apiFixture.offerings.unpriced,
        apiFixture.offerings.firstParty,
        apiFixture.offerings.inference,
        apiFixture.offerings.free
      ]);

      let firstParty = model.offerings.find(
        item => item.id == apiFixture.offerings.firstParty
      );
      expect(firstParty?.openPricePeriod?.pricing.text?.input).toBe(1.8);
      expect(
        model.offerings.find(item => item.id == apiFixture.offerings.unpriced)?.openPricePeriod
      ).toBeNull();

      await expectServiceError(
        knowledgeModelService.getModelById({ modelId: 'nope' }),
        'not_found'
      );
    });

    it('keeps removed models out of lists but still gets them', async () => {
      let removed = await knowledgeModelService.getModelById({ modelId: 'mistral-small-3' });
      expect(removed.removedAt).not.toBeNull();

      let withRemoved = await (
        await knowledgeModelService.listModels({ includeRemoved: true })
      ).run({ limit: 100 });
      expect(idsOf(withRemoved.items)).toContain('mistral-small-3');
    });
  });

  describe('vendors', () => {
    it('lists vendors by kind with endpoints and offering counts', async () => {
      let inference = await (
        await knowledgeVendorService.listVendors({ kinds: ['inference'] })
      ).run({});

      expect(inference.items).toHaveLength(1);
      expect(inference.items[0]).toMatchObject({
        id: 'together-ai',
        offeringCount: 2,
        endpoints: [expect.objectContaining({ id: 'together-api' })]
      });

      let byOrganization = await (
        await knowledgeVendorService.listVendors({ organizationIds: ['amazon'] })
      ).run({});
      expect(idsOf(byOrganization.items)).toEqual(['aws-bedrock']);
    });

    it('gets a vendor and excludes removed offerings from its count', async () => {
      let vendor = await knowledgeVendorService.getVendorById({ vendorId: 'mistral' });

      expect(vendor.offeringCount).toBe(1);
      expect(idsOf(vendor.endpoints)).toEqual(['mistral-api']);
      expect(vendor.endpoints[0]!.baseUrlHost).toBe('api.mistral.ai');
    });
  });

  describe('offerings', () => {
    let list = async (
      filters: Parameters<typeof knowledgeOfferingService.listOfferings>[0],
      order?: 'asc' | 'desc'
    ) =>
      idsOf(
        (
          await (
            await knowledgeOfferingService.listOfferings(filters)
          ).run({ limit: 100, order })
        ).items
      );

    it("sorts a model's offerings by input or output price with unpriced last", async () => {
      expect(
        await list({ modelIds: ['mistral-large-3'], free: false, sort: 'input_price' })
      ).toEqual([
        apiFixture.offerings.inference,
        apiFixture.offerings.firstParty,
        apiFixture.offerings.unpriced
      ]);

      expect(
        await list(
          { modelIds: ['mistral-large-3'], free: false, sort: 'output_price' },
          'desc'
        )
      ).toEqual([
        apiFixture.offerings.inference,
        apiFixture.offerings.firstParty,
        apiFixture.offerings.unpriced
      ]);

      expect(await list({ modelIds: ['mistral-large-3'], sort: 'output_price' })).toEqual([
        apiFixture.offerings.free,
        apiFixture.offerings.firstParty,
        apiFixture.offerings.inference,
        apiFixture.offerings.unpriced
      ]);
    });

    it('pages through price-sorted offerings', async () => {
      let paginator = await knowledgeOfferingService.listOfferings({
        labIds: ['mistral'],
        includeRemoved: true,
        sort: 'input_price'
      });
      let all = idsOf((await paginator.run({ limit: 100 })).items);

      expect(all).toEqual([
        apiFixture.offerings.free,
        apiFixture.offerings.small,
        apiFixture.offerings.inference,
        apiFixture.offerings.firstParty,
        apiFixture.offerings.unpriced
      ]);
      expect(idsOf(await pageThrough(paginator, { limit: 1 }))).toEqual(all);
      expect(idsOf(await pageThrough(paginator, { limit: 2, useCursor: true }))).toEqual(all);

      let previous = await paginator.run({ limit: 2, before: all[4] });
      expect(idsOf(previous.items)).toEqual(all.slice(2, 4));

      let descending = await knowledgeOfferingService.listOfferings({
        labIds: ['mistral'],
        includeRemoved: true,
        sort: 'input_price'
      });
      expect(idsOf(await pageThrough(descending, { limit: 2, order: 'desc' }))).toEqual([
        apiFixture.offerings.firstParty,
        apiFixture.offerings.inference,
        apiFixture.offerings.small,
        apiFixture.offerings.free,
        apiFixture.offerings.unpriced
      ]);
    });

    it('filters by family, lab, vendor, variant and priced', async () => {
      expect(await list({ familyIds: ['mistral-large'], vendorIds: ['together-ai'] })).toEqual(
        [apiFixture.offerings.inference, apiFixture.offerings.free]
      );
      expect(await list({ variantKeys: ['free'] })).toEqual([apiFixture.offerings.free]);
      expect(await list({ labIds: ['mistral'], priced: false })).toEqual([
        apiFixture.offerings.unpriced
      ]);
      expect(await list({ labIds: ['mistral'] })).not.toContain(apiFixture.offerings.small);
      expect(await list({ labIds: ['mistral'], includeRemoved: true })).toContain(
        apiFixture.offerings.small
      );
      expect(await list({ vendorIds: [] })).toEqual([]);
    });
  });

  describe('agents', () => {
    it('filters agents by maker, surface, vendor and open source', async () => {
      let run = async (filters: Parameters<typeof knowledgeAgentService.listAgents>[0]) =>
        idsOf((await (await knowledgeAgentService.listAgents(filters)).run({})).items);

      expect(await run({})).toEqual(['claude-code', 'le-chat-cli']);
      expect(await run({ makerIds: ['mistral'] })).toEqual(['le-chat-cli']);
      expect(await run({ surfaces: ['ide'] })).toEqual(['le-chat-cli']);
      expect(await run({ vendorIds: ['together-ai'] })).toEqual(['le-chat-cli']);
      expect(await run({ openSource: false })).toEqual(['claude-code']);
    });

    it('gets an agent with its vendor links', async () => {
      let agent = await knowledgeAgentService.getAgentById({ agentId: 'le-chat-cli' });

      expect(agent).toMatchObject({ defaultVendorId: 'mistral', surfaces: ['cli', 'ide'] });
      expect(agent.data.vendors).toEqual([
        { vendorId: 'mistral', role: 'default' },
        { vendorId: 'together-ai', role: 'subscription' }
      ]);

      await expectServiceError(
        knowledgeAgentService.getAgentById({ agentId: 'nope' }),
        'not_found'
      );
    });
  });

  describe('price history', () => {
    let history = async (
      filters: Parameters<typeof knowledgePriceService.listPriceHistory>[0]
    ) =>
      (await (await knowledgePriceService.listPriceHistory(filters)).run({ limit: 100 }))
        .items;

    it("returns an offering's periods in order and narrows them by range", async () => {
      let periods = await history({ offeringId: apiFixture.offerings.firstParty });

      expect(
        periods.map(period => [
          period.pricing.text?.input,
          period.validFrom.toISOString(),
          period.validTo?.toISOString() ?? null
        ])
      ).toEqual([
        [2, '2026-10-01T00:00:00.000Z', generatedAt.second],
        [2.5, generatedAt.second, generatedAt.third],
        [1.8, generatedAt.third, null]
      ]);
      expect(
        periods.every(period => period.offering.id == apiFixture.offerings.firstParty)
      ).toBe(true);

      let middle = await history({
        offeringId: apiFixture.offerings.firstParty,
        from: new Date('2026-11-02T06:00:00.000Z'),
        to: new Date('2026-11-02T18:00:00.000Z')
      });
      expect(middle.map(period => period.pricing.text?.input)).toEqual([2.5]);

      let fromSecond = await history({
        offeringId: apiFixture.offerings.firstParty,
        from: new Date(generatedAt.second)
      });
      expect(fromSecond.map(period => period.pricing.text?.input)).toEqual([2.5, 1.8]);

      let untilSecond = await history({
        offeringId: apiFixture.offerings.firstParty,
        to: new Date(generatedAt.second)
      });
      expect(untilSecond.map(period => period.pricing.text?.input)).toEqual([2]);
    });

    it('returns periods for every offering of a model, family or vendor', async () => {
      let offeringIds = (periods: { offering: { id: string } }[]) =>
        [...new Set(periods.map(period => period.offering.id))].sort();

      let mistralLargeOfferings = [
        apiFixture.offerings.firstParty,
        apiFixture.offerings.free,
        apiFixture.offerings.inference
      ].sort();

      expect(offeringIds(await history({ modelId: 'mistral-large-3' }))).toEqual(
        mistralLargeOfferings
      );
      expect(offeringIds(await history({ familyId: 'mistral-large' }))).toEqual(
        mistralLargeOfferings
      );
      expect(offeringIds(await history({ vendorId: 'mistral' }))).toEqual([
        apiFixture.offerings.firstParty,
        apiFixture.offerings.small
      ]);
      expect(
        offeringIds(await history({ vendorId: 'mistral', modelId: 'mistral-small-3' }))
      ).toEqual([apiFixture.offerings.small]);

      let paginator = await knowledgePriceService.listPriceHistory({ vendorId: 'mistral' });
      let all = (await paginator.run({ limit: 100 })).items;
      expect(idsOf(await pageThrough(paginator, { limit: 1 }))).toEqual(idsOf(all));
      expect(
        all
          .map(period => period.validFrom.getTime())
          .every((time, index, times) => (index == 0 ? true : times[index - 1]! <= time))
      ).toBe(true);
    });

    it('rejects missing targets, unknown ids and empty ranges', async () => {
      await expectServiceError(knowledgePriceService.listPriceHistory({}), 'bad_request');
      await expectServiceError(
        knowledgePriceService.listPriceHistory({
          modelId: 'mistral-large-3',
          from: new Date(generatedAt.third),
          to: new Date(generatedAt.second)
        }),
        'bad_request'
      );
      await expectServiceError(
        knowledgePriceService.listPriceHistory({ offeringId: 'nope' }),
        'not_found'
      );
      await expectServiceError(
        knowledgePriceService.listPriceHistory({ familyId: 'nope' }),
        'not_found'
      );
    });
  });

  describe('changes', () => {
    it('filters the change log by entity, id, type and snapshot', async () => {
      let run = async (filters: Parameters<typeof knowledgeChangeService.listChanges>[0]) =>
        (await (await knowledgeChangeService.listChanges(filters)).run({ limit: 100 })).items;

      let removed = await run({ changes: ['removed'] });
      expect(removed.map(change => [change.entity, change.entityId]).sort()).toEqual([
        ['model', 'mistral-small-3'],
        ['offering', apiFixture.offerings.small]
      ]);
      expect(removed.every(change => change.snapshot.id == snapshotIds[1])).toBe(true);

      let offering = await run({
        entities: ['offering'],
        entityIds: [apiFixture.offerings.firstParty]
      });
      expect(offering.map(change => [change.change, change.snapshot.id])).toEqual([
        ['changed', snapshotIds[1]],
        ['changed', snapshotIds[2]]
      ]);

      let third = await run({ snapshotId: snapshotIds[2] });
      expect(third.map(change => change.entityId)).toEqual([apiFixture.offerings.firstParty]);

      let paginator = await knowledgeChangeService.listChanges({});
      let all = (await paginator.run({ limit: 100 })).items;
      expect(idsOf(await pageThrough(paginator, { limit: 1 }))).toEqual(idsOf(all));

      await expectServiceError(
        knowledgeChangeService.listChanges({ snapshotId: 'nope' }),
        'not_found'
      );
    });
  });

  describe('snapshots', () => {
    it('lists, gets and returns the current snapshot without archives', async () => {
      let list = await (await knowledgeSnapshotService.listSnapshots({})).run({});
      expect(idsOf(list.items)).toEqual(snapshotIds);
      for (let snapshot of list.items) {
        expect(snapshot).not.toHaveProperty('archive');
        expect(snapshot.hasArchive).toBe(true);
      }

      let superseded = await (
        await knowledgeSnapshotService.listSnapshots({ statuses: ['superseded'] })
      ).run({});
      expect(idsOf(superseded.items)).toEqual(snapshotIds.slice(0, 2));

      let current = await knowledgeSnapshotService.getCurrentSnapshot();
      expect(current).toMatchObject({ id: snapshotIds[2], status: 'current' });
      expect(current).not.toHaveProperty('archive');
      expect(current?.source.url).toBe('import://snapshots');

      await testDb.knowledgeSnapshot.update({
        where: { id: snapshotIds[0] },
        data: { archive: null }
      });
      let first = await knowledgeSnapshotService.getSnapshotById({
        snapshotId: snapshotIds[0]!
      });
      expect(first).toMatchObject({ status: 'superseded', hasArchive: false });
      expect(first.counts.model).toMatchObject({ total: 14, added: 14 });

      await expectServiceError(
        knowledgeSnapshotService.getSnapshotById({ snapshotId: 'nope' }),
        'not_found'
      );
    });

    it('returns null when there is no current snapshot', async () => {
      await testDb.knowledgeSnapshot.updateMany({
        where: { status: 'current' },
        data: { status: 'superseded' }
      });

      expect(await knowledgeSnapshotService.getCurrentSnapshot()).toBeNull();

      await testDb.knowledgeSnapshot.update({
        where: { id: snapshotIds[2] },
        data: { status: 'current' }
      });
    });
  });
});
