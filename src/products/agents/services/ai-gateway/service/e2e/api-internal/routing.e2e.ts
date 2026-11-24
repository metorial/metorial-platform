import { expectServiceError } from '@metorial/e2e';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import { createConnection, createTenant, useCatalog } from '../support/fixtures';

describe('ai-gateway routing api', () => {
  useCatalog();

  let preview = (
    tenant: Awaited<ReturnType<typeof createTenant>>,
    model: string,
    requiredFeatures?: Array<'zdr'>
  ) => gateway.routing.preview({ ...tenant.scope, model, requiredFeatures });

  it('routes to the Metorial provider when the instance has no connections', async () => {
    let tenant = await createTenant();

    let route = await preview(tenant, catalogModels.haiku);

    expect(route).toMatchObject({
      object: 'ai_gateway#route_preview',
      requested: catalogModels.haiku,
      via: 'slug',
      model: { slug: catalogModels.haiku }
    });
    expect(route.candidates).toHaveLength(1);
    expect(route.candidates[0]).toMatchObject({
      provider: 'metorial',
      connectionOwner: 'platform'
    });
    expect(route.candidates[0]).not.toHaveProperty('connectionId');
    expect(route.candidates[0]!.pricing).toMatchObject({ text: { input: 3, output: 15 } });
  });

  it('prefers the customer connection and falls back to the Metorial provider', async () => {
    let tenant = await createTenant();
    let connection = await createConnection(tenant);

    let route = await preview(tenant, catalogModels.sonnet);

    expect(route.candidates.map(candidate => candidate.connectionOwner)).toEqual([
      'customer',
      'platform'
    ]);
    expect(route.candidates[0]).toMatchObject({
      provider: 'anthropic',
      connectionId: connection.id,
      vendorModelId: 'claude-sonnet-5'
    });
  });

  it('orders customer connections by priority', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    let low = await createConnection(tenant, { priority: 1 });
    let high = await createConnection(tenant, { priority: 10 });

    let route = await preview(tenant, catalogModels.haiku);

    expect(route.candidates.map(candidate => candidate.connectionId)).toEqual([
      high.id,
      low.id
    ]);
  });

  it('skips disabled connections', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    let connection = await createConnection(tenant);
    await gateway.providerConnection.setEnabled({
      ...tenant.scope,
      connectionId: connection.id,
      enabled: false
    });

    await expectServiceError(preview(tenant, catalogModels.haiku), 'model_unavailable');
  });

  it('only offers a model through providers that serve it', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    await createConnection(tenant, { providerSlug: 'anthropic' });

    await expectServiceError(preview(tenant, catalogModels.gpt), 'model_unavailable');

    await createConnection(tenant, { providerSlug: 'openai' });
    let route = await preview(tenant, catalogModels.gpt);
    expect(route.candidates).toMatchObject([{ provider: 'openai', vendorModelId: 'gpt-6' }]);
  });

  it('can turn the Metorial provider off for an instance', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });

    await expectServiceError(preview(tenant, catalogModels.haiku), 'model_unavailable');
  });

  it('pins a provider with a provider prefix', async () => {
    let tenant = await createTenant();

    await expectServiceError(preview(tenant, 'anthropic:claude-haiku-5'), 'model_unavailable');

    let connection = await createConnection(tenant);
    let route = await preview(tenant, 'anthropic:claude-haiku-5');

    expect(route.via).toBe('offering');
    expect(route.candidates).toMatchObject([
      { provider: 'anthropic', connectionOwner: 'customer', connectionId: connection.id }
    ]);
  });

  it('pins the Metorial provider with the metorial prefix', async () => {
    let tenant = await createTenant();
    await createConnection(tenant);

    let route = await preview(tenant, `metorial:${catalogModels.haiku}`);

    expect(route.candidates.map(candidate => candidate.connectionOwner)).toEqual(['platform']);
  });

  it('resolves model aliases', async () => {
    let tenant = await createTenant();

    let route = await preview(tenant, 'claude-haiku-latest');

    expect(route).toMatchObject({ via: 'alias', model: { slug: catalogModels.haiku } });
  });

  it('requires zero data retention connections when asked to', async () => {
    let tenant = await createTenant();
    await createConnection(tenant);

    let error = await expectServiceError(
      preview(tenant, catalogModels.haiku, ['zdr']),
      'model_unavailable'
    );
    expect(error.message).toContain('zero data retention');

    let zdr = await createConnection(tenant, { features: { zdr: true } });
    let route = await preview(tenant, catalogModels.haiku, ['zdr']);
    expect(route.candidates.map(candidate => candidate.connectionId)).toEqual([zdr.id]);
  });

  it('applies the zero data retention instance setting to every route', async () => {
    let tenant = await createTenant({ settings: { zeroDataRetention: { required: true } } });

    await expectServiceError(preview(tenant, catalogModels.haiku), 'model_unavailable');

    let zdr = await createConnection(tenant, { features: { zdr: true } });
    let route = await preview(tenant, catalogModels.haiku);
    expect(route.candidates.map(candidate => candidate.connectionId)).toEqual([zdr.id]);
  });

  it('applies connection pricing overrides to the billed price', async () => {
    let tenant = await createTenant();
    await createConnection(tenant, { pricingOverride: { multiplier: 2 } });

    let [customer] = (await preview(tenant, catalogModels.sonnet)).candidates;

    expect(customer).toMatchObject({
      pricingSource: 'connection',
      pricing: { text: { input: 6, output: 30 } }
    });
  });

  it('rejects unknown models and invalid requests', async () => {
    let tenant = await createTenant();

    await expectServiceError(preview(tenant, 'nobody/nothing'), 'model_not_found');
    await expect(preview(tenant, '')).rejects.toThrow();
  });

  it('does not route virtual model slugs', async () => {
    let tenant = await createTenant();
    await gateway.virtualModel.create({
      ...tenant.scope,
      slug: 'router',
      name: 'Router',
      definition: { rules: [], default: { models: [{ model: catalogModels.haiku }] } }
    });

    await expectServiceError(preview(tenant, 'router'), 'model_not_found');
  });
});
