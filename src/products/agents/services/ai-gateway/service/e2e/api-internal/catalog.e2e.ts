import { eventually } from '@metorial/e2e';
import {
  catalogFingerprint,
  catalogLabs,
  catalogModels,
  catalogProviders
} from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { expectServiceError } from '@metorial/e2e';
import { gateway } from '../support/client';
import { useCatalog } from '../support/fixtures';

describe('ai-gateway catalog api', () => {
  useCatalog();

  it('reports the synced catalog', async () => {
    let status = await gateway.catalog.getSyncStatus({});

    expect(status).toMatchObject({
      object: 'ai_gateway#catalog_sync',
      fingerprint: catalogFingerprint,
      lastError: null
    });
    expect(status.counts).toBeTruthy();
    expect(status.lastSyncedAt).toBeTruthy();
  });

  it('keeps the catalog in place when a sync is requested again', async () => {
    let before = await gateway.catalog.getSyncStatus({});

    expect(await gateway.catalog.requestSync({})).toEqual({ requested: true });

    await eventually(async () => {
      let after = await gateway.catalog.getSyncStatus({});
      expect(after.fingerprint).toBe(before.fingerprint);
      expect(new Date(after.lastCheckedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(before.lastCheckedAt!).getTime()
      );
    });
  });

  it('lists labs and providers', async () => {
    let labs = await gateway.catalog.listLabs({});
    expect(labs.items.map(lab => lab.slug)).toEqual(expect.arrayContaining([...catalogLabs]));

    let providers = await gateway.catalog.listProviders({});
    let anthropic = providers.items.find(provider => provider.slug == 'anthropic');
    expect(anthropic).toMatchObject({ supported: true });
    expect(anthropic!.features).toContain('zdr');
    expect(providers.items.map(provider => provider.slug)).toEqual(
      expect.arrayContaining([...catalogProviders])
    );
  });

  it('lists and filters models', async () => {
    let all = await gateway.catalog.listModels({});
    expect(all.items.map(model => model.slug)).toEqual(
      expect.arrayContaining(Object.values(catalogModels))
    );

    let anthropic = await gateway.catalog.listModels({ labSlug: 'anthropic' });
    expect(anthropic.items.every(model => model.lab.slug == 'anthropic')).toBe(true);
    expect(anthropic.items.map(model => model.slug)).toEqual(
      expect.arrayContaining([catalogModels.sonnet, catalogModels.haiku])
    );

    let searched = await gateway.catalog.listModels({ search: 'Haiku' });
    expect(searched.items.map(model => model.slug)).toContain(catalogModels.haiku);
    expect(searched.items.map(model => model.slug)).not.toContain(catalogModels.gpt);
  });

  it('paginates models', async () => {
    let first = await gateway.catalog.listModels({ limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.pagination.has_more_after).toBe(true);

    let second = await gateway.catalog.listModels({
      limit: 1,
      after: first.items[0]!.id
    });
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
  });

  it('gets a model with its capabilities', async () => {
    let [listed] = (await gateway.catalog.listModels({ search: 'Sonnet' })).items;

    let model = await gateway.catalog.getModel({ modelId: listed!.id });
    expect(model).toMatchObject({
      object: 'ai_gateway#model',
      slug: catalogModels.sonnet,
      name: 'Claude Sonnet 5',
      lab: { slug: 'anthropic' },
      contextTokens: 200_000,
      outputTokens: 64_000,
      modalities: { input: ['text'], output: ['text'] }
    });
  });

  it('lists model offerings with pricing', async () => {
    let offerings = await gateway.catalog.listOfferings({ providerSlug: 'anthropic' });

    let sonnet = offerings.items.find(
      offering => offering.model?.slug == catalogModels.sonnet
    );
    expect(sonnet).toMatchObject({
      name: 'anthropic:claude-sonnet-5',
      vendorModelId: 'claude-sonnet-5',
      provider: { slug: 'anthropic' }
    });
    expect(sonnet!.pricing).toMatchObject({ text: { input: 3, output: 15 } });
    expect(offerings.items.every(offering => offering.provider.slug == 'anthropic')).toBe(
      true
    );
  });

  it('resolves model names through slugs, aliases and provider pins', async () => {
    let bySlug = await gateway.catalog.resolveModel({ model: catalogModels.sonnet });
    expect(bySlug).toMatchObject({ via: 'slug', model: { slug: catalogModels.sonnet } });

    let byAlias = await gateway.catalog.resolveModel({ model: 'claude-sonnet-latest' });
    expect(byAlias).toMatchObject({ via: 'alias', model: { slug: catalogModels.sonnet } });

    let pinned = await gateway.catalog.resolveModel({ model: 'anthropic:claude-haiku-5' });
    expect(pinned).toMatchObject({ via: 'offering', model: { slug: catalogModels.haiku } });
  });

  it('rejects an unknown model name', async () => {
    await expectServiceError(
      gateway.catalog.resolveModel({ model: 'nobody/nothing' }),
      'model_not_found'
    );
  });
});
