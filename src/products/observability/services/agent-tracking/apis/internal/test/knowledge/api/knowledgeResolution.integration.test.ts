import { gzipSync } from 'node:zlib';
import type { Catalog } from '@metorial/model-catalog/src/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  knowledgePriceAtPresenter,
  knowledgeResolutionPresenter
} from '../../../src/presenters/knowledgeResolution';
import { closeRedis, getCacheRedis } from '@mtsrc/agent-tracking-redis';
import { expectServiceError } from '@mtsrc/agent-tracking-testing';
import { cleanDatabase, testDb } from '@mtsrc/agent-tracking-db/test/setup';
import {
  knowledgeCacheService,
  knowledgeSyncService
} from '@mtsrc/agent-tracking-module-knowledge';
import { knowledgeCatalog } from '@mtsrc/agent-tracking-module-knowledge/test/fixture';
import { currentSnapshot, knowledgeVersionKey } from '@mtsrc/agent-tracking-module-knowledge';
import {
  knowledgeResolutionService,
  type KnowledgeRequestInput
} from '@mtsrc/agent-tracking-module-knowledge';
import {
  addApiFixtures,
  apiFixture
} from '@mtsrc/agent-tracking-module-knowledge/test/api/catalog';

let generatedAt = {
  first: '2026-11-01T00:00:00.000Z',
  second: '2026-11-02T00:00:00.000Z',
  third: '2026-11-03T00:00:00.000Z'
};

let afterThird = new Date('2026-11-03T01:00:00.000Z');

let importCatalog = async (catalog: Catalog) => {
  let result = await knowledgeSyncService.importSnapshot({
    archive: gzipSync(JSON.stringify(catalog)),
    guardrails: false
  });
  expect(result.status).toBe('applied');
};

let resolve = async (d: KnowledgeRequestInput) =>
  knowledgeResolutionPresenter(
    await knowledgeResolutionService.resolve({ at: afterThird, ...d })
  );

let offeringPriceAt = async (offeringId: string, at: Date) =>
  knowledgePriceAtPresenter(await knowledgeResolutionService.priceAt({ offeringId, at }));

let periodSummary = (result: Awaited<ReturnType<typeof offeringPriceAt>>) => ({
  input: result.pricePeriod?.pricing.text?.input ?? null,
  validFrom: result.pricePeriod?.validFrom.toISOString() ?? null,
  validTo: result.pricePeriod?.validTo?.toISOString() ?? null,
  priceAssumed: result.priceAssumed
});

describe('knowledge resolution', () => {
  beforeAll(async () => {
    await cleanDatabase();
    await getCacheRedis().del(knowledgeVersionKey);
    knowledgeCacheService.reset();

    await importCatalog(addApiFixtures(knowledgeCatalog({ generatedAt: generatedAt.first })));
    await importCatalog(
      addApiFixtures(knowledgeCatalog({ generatedAt: generatedAt.second }), {
        largeInput: 2.5
      })
    );
    await importCatalog(
      addApiFixtures(knowledgeCatalog({ generatedAt: generatedAt.third }), {
        largeInput: 1.8
      })
    );
  });

  afterAll(async () => {
    knowledgeCacheService.reset();
    await closeRedis();
  });

  describe('resolve', () => {
    it('resolves a display name to the first-party offering and its price', async () => {
      let snapshot = await currentSnapshot();
      let result = await resolve({ raw: 'Mistral Large 3' });

      expect(result).toMatchObject({
        object: 'agent_tracking#knowledge_resolution',
        at: afterThird,
        snapshotId: snapshot!.id,
        request: {
          raw: 'Mistral Large 3',
          provider: null,
          agent: null,
          baseUrl: null,
          subscription: null
        },
        resolved: true,
        matchedBy: 'raw',
        pointers: [],
        modelId: 'mistral-large-3',
        model: { id: 'mistral-large-3', name: 'Mistral Large 3', labId: 'mistral' },
        release: null,
        agent: null,
        vendorId: 'mistral',
        vendorSource: 'first-party',
        vendor: { id: 'mistral', kind: 'first-party' },
        offering: { id: apiFixture.offerings.firstParty },
        pricePeriod: {
          offeringId: apiFixture.offerings.firstParty,
          validFrom: new Date(generatedAt.third),
          validTo: null,
          confirmedAt: new Date(generatedAt.third),
          pricing: { text: { input: 1.8, output: 6 } }
        },
        priceAssumed: false
      });
      expect(result.names).toEqual([
        expect.objectContaining({
          object: 'agent_tracking#knowledge_name',
          id: apiFixture.names.display,
          namespace: 'display',
          raw: 'Mistral Large 3',
          currentTargetModelId: 'mistral-large-3',
          targetAt: { kind: 'model', modelId: 'mistral-large-3' },
          periodAt: expect.objectContaining({
            from: new Date('2026-10-01T00:00:00.000Z'),
            to: null
          })
        })
      ]);
    });

    it('follows a vendor name through a pointer, evaluated at the request time', async () => {
      let current = await resolve({ raw: 'mistral-large-latest', provider: 'mistral' });

      expect(current).toMatchObject({
        matchedBy: 'namespace',
        modelId: 'mistral-large-3',
        vendorId: 'mistral',
        vendorSource: 'reported',
        offering: { id: apiFixture.offerings.firstParty },
        priceAssumed: false
      });
      expect(current.names.map(name => name.id)).toEqual([apiFixture.names.pointer]);
      expect(current.names[0]!.targetAt).toEqual({
        kind: 'pointer',
        pointerId: apiFixture.pointer
      });
      expect(current.pointers).toEqual([
        expect.objectContaining({
          id: apiFixture.pointer,
          targetAt: { kind: 'model', modelId: 'mistral-large-3' },
          periodAt: expect.objectContaining({
            from: new Date(apiFixture.pointerRetargetedAt),
            to: null
          })
        })
      ]);

      let earlier = await resolve({
        raw: 'mistral-large-latest',
        provider: 'mistral',
        at: new Date('2025-06-01T00:00:00.000Z')
      });

      expect(earlier).toMatchObject({
        resolved: true,
        modelId: 'mistral-large-2-1',
        model: { id: 'mistral-large-2-1' },
        vendorId: 'mistral',
        offering: null,
        pricePeriod: null,
        priceAssumed: null
      });
      expect(earlier.pointers).toEqual([
        expect.objectContaining({
          id: apiFixture.pointer,
          targetAt: { kind: 'model', modelId: 'mistral-large-2-1' },
          periodAt: expect.objectContaining({
            from: new Date('2024-11-18T00:00:00.000Z'),
            to: new Date(apiFixture.pointerRetargetedAt)
          })
        })
      ]);
    });

    it('resolves a name that targets a release', async () => {
      let result = await resolve({ raw: 'mistral-large-2601', provider: 'mistral' });

      expect(result).toMatchObject({
        matchedBy: 'namespace',
        modelId: 'mistral-large-3',
        release: { id: 'mistral-large-3@2026-01-15', modelId: 'mistral-large-3' },
        offering: { id: apiFixture.offerings.firstParty }
      });
      expect(result.names.map(name => name.id)).toEqual([apiFixture.names.release]);
    });

    it("resolves a vendor's model id through its offering", async () => {
      let result = await resolve({
        raw: 'mistralai/mistral-large-3',
        provider: 'together-ai'
      });

      expect(result).toMatchObject({
        matchedBy: 'offering',
        names: [],
        pointers: [],
        modelId: 'mistral-large-3',
        vendorId: 'together-ai',
        vendorSource: 'reported',
        vendor: { id: 'together-ai', kind: 'inference' },
        offering: { id: apiFixture.offerings.inference },
        pricePeriod: { pricing: { text: { input: 1.5, output: 9 } } },
        priceAssumed: false
      });
    });

    it("picks the agent's vendor, preferring its subscription vendor on a subscription", async () => {
      let byDefault = await resolve({ raw: 'Mistral Large 3', agent: 'le_chat' });

      expect(byDefault).toMatchObject({
        agent: { id: apiFixture.agent },
        vendorId: 'mistral',
        vendorSource: 'agent',
        offering: { id: apiFixture.offerings.firstParty }
      });

      let subscribed = await resolve({
        raw: 'Mistral Large 3',
        agent: 'le_chat',
        subscription: true
      });

      expect(subscribed).toMatchObject({
        request: { agent: 'le_chat', subscription: true },
        agent: { id: apiFixture.agent },
        vendorId: 'together-ai',
        vendorSource: 'agent',
        offering: { id: apiFixture.offerings.inference }
      });
    });

    it('takes the vendor from a known base URL', async () => {
      let result = await resolve({
        raw: 'Mistral Large 3',
        baseUrl: 'https://api.together.xyz/v1'
      });

      expect(result).toMatchObject({
        vendorId: 'together-ai',
        vendorSource: 'endpoint',
        offering: { id: apiFixture.offerings.inference }
      });
    });

    it('explains a miss with nulls instead of failing', async () => {
      let result = await resolve({ raw: 'mystery-model-9', provider: 'mistral' });

      expect(result).toMatchObject({
        resolved: false,
        matchedBy: null,
        names: [],
        pointers: [],
        modelId: null,
        model: null,
        release: null,
        offering: null,
        pricePeriod: null,
        priceAssumed: null
      });
      expect(result.snapshotId).toBe((await currentSnapshot())!.id);
    });
  });

  describe('prices.at', () => {
    let offeringId = apiFixture.offerings.firstParty;

    it('assumes the first price before the first period', async () => {
      let result = await offeringPriceAt(offeringId, new Date('2026-09-01T00:00:00.000Z'));

      expect(result).toMatchObject({
        object: 'agent_tracking#knowledge_price_at',
        modelId: 'mistral-large-3',
        vendorId: 'mistral',
        vendorSource: null,
        offering: { id: offeringId }
      });
      expect(periodSummary(result)).toEqual({
        input: 2,
        validFrom: '2026-10-01T00:00:00.000Z',
        validTo: generatedAt.second,
        priceAssumed: true
      });
    });

    it('returns the closed period that covered a time after a price change', async () => {
      let result = await offeringPriceAt(offeringId, new Date('2026-11-02T12:00:00.000Z'));

      expect(periodSummary(result)).toEqual({
        input: 2.5,
        validFrom: generatedAt.second,
        validTo: generatedAt.third,
        priceAssumed: false
      });
    });

    it('returns the open period, assumed once unconfirmed for more than 7 days', async () => {
      expect(periodSummary(await offeringPriceAt(offeringId, afterThird))).toEqual({
        input: 1.8,
        validFrom: generatedAt.third,
        validTo: null,
        priceAssumed: false
      });

      let stale = await offeringPriceAt(offeringId, new Date('2026-11-11T00:00:00.000Z'));
      expect(stale.pricePeriod?.confirmedAt).toEqual(new Date(generatedAt.third));
      expect(periodSummary(stale)).toMatchObject({ input: 1.8, priceAssumed: true });
    });

    it('prices a raw request at a time through the resolver', async () => {
      let result = knowledgePriceAtPresenter(
        await knowledgeResolutionService.priceAt({
          raw: 'mistral-large-3',
          provider: 'mistral',
          at: new Date('2026-11-02T12:00:00.000Z')
        })
      );

      expect(result).toMatchObject({
        modelId: 'mistral-large-3',
        vendorId: 'mistral',
        vendorSource: 'reported',
        offering: { id: offeringId }
      });
      expect(periodSummary(result)).toMatchObject({ input: 2.5, priceAssumed: false });

      let miss = knowledgePriceAtPresenter(
        await knowledgeResolutionService.priceAt({ raw: 'mystery-model-9', at: afterThird })
      );
      expect(miss).toMatchObject({
        modelId: null,
        offering: null,
        pricePeriod: null,
        priceAssumed: null
      });
    });

    it('rejects an unknown offering', async () => {
      await expectServiceError(
        knowledgeResolutionService.priceAt({ offeringId: 'nope:nope' }),
        'not_found'
      );
    });

    it('returns no price inside a corrected gap', async () => {
      let periods = await testDb.knowledgePricePeriod.findMany({
        where: { offering: { id: offeringId } },
        orderBy: { validFrom: 'asc' }
      });

      await testDb.knowledgePricePeriod.update({
        where: { id: periods[0]!.id },
        data: { closeReason: 'corrected' }
      });
      await testDb.knowledgePricePeriod.update({
        where: { id: periods[1]!.id },
        data: { validFrom: new Date('2026-11-02T12:00:00.000Z') }
      });

      let gap = await offeringPriceAt(offeringId, new Date('2026-11-02T06:00:00.000Z'));

      expect(gap).toMatchObject({
        offering: { id: offeringId },
        pricePeriod: null,
        priceAssumed: null
      });

      let afterGap = await offeringPriceAt(offeringId, new Date('2026-11-02T13:00:00.000Z'));
      expect(periodSummary(afterGap)).toMatchObject({ input: 2.5, priceAssumed: false });
    });
  });
});
