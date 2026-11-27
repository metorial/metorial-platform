import {
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogLabs, catalogModels, catalogProviders } from './_catalog';
import { crossTenantClients, ensureCatalog, gatewayPath, ids } from './_shared';

describe('api-core ai-gateway: catalog', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let api = () => org.clients.instance;

  beforeAll(async () => {
    await ensureCatalog();
  });

  it('authenticates the catalog routes for every credential', async () => {
    let clients = crossTenantClients(org, otherOrg);
    let expected = {
      none: 401,
      session: 200,
      management: 200,
      instance: 200,
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 200
    };

    for (let path of ['/labs', '/providers', '/models', '/model-offerings']) {
      await expectAuthMatrix(
        clients,
        (client, name) => client.get(gatewayPath(org, name, path)),
        expected
      );
    }
  });

  it('lists the labs and providers of the synced catalog', async () => {
    let labs = await listAll(api(), '/ai-gateway/labs');
    expect(labs.map(lab => lab.slug)).toEqual(expect.arrayContaining([...catalogLabs]));
    for (let lab of labs) expectPresented(lab, 'ai_gateway.lab');

    let providers = await listAll(api(), '/ai-gateway/providers');
    expect(providers.map(provider => provider.slug)).toEqual(
      expect.arrayContaining([...catalogProviders])
    );
    for (let provider of providers) expectPresented(provider, 'ai_gateway.provider');
  });

  it('lists models, pages through them and filters by lab and search', async () => {
    let models = await listAll(api(), '/ai-gateway/models');
    expect(models.map(model => model.slug)).toEqual(
      expect.arrayContaining(Object.values(catalogModels))
    );
    for (let model of models) expectPresented(model, 'ai_gateway.model');

    let paged = await listAll(api(), '/ai-gateway/models', { limit: 1 });
    expect(ids(paged)).toEqual(ids(models));
    expect(new Set(ids(paged)).size).toBe(paged.length);

    let anthropic = await listAll(api(), '/ai-gateway/models', {
      query: { lab: 'anthropic' }
    });
    expect(anthropic.map(model => model.slug)).toEqual(
      expect.arrayContaining([catalogModels.sonnet, catalogModels.haiku])
    );
    expect(anthropic.map(model => model.slug)).not.toContain(catalogModels.gpt);
    expect(new Set(anthropic.map(model => model.lab.slug))).toEqual(new Set(['anthropic']));

    let searched = await listAll(api(), '/ai-gateway/models', { query: { search: 'haiku' } });
    expect(searched.map(model => model.slug)).toEqual([catalogModels.haiku]);
  });

  it('gets a model by id and by URL-encoded slug', async () => {
    let [model] = await listAll(api(), '/ai-gateway/models', { query: { search: 'haiku' } });

    let byId = expectOk(await api().get(`/ai-gateway/models/${model.id}`));
    expect(byId).toMatchObject({ id: model.id, slug: catalogModels.haiku });
    expectPresented(byId, 'ai_gateway.model');

    let bySlug = expectOk(
      await api().get(`/ai-gateway/models/${encodeURIComponent(catalogModels.haiku)}`)
    );
    expect(bySlug.id).toBe(model.id);
  });

  it('answers 404 for a model that does not exist', async () => {
    expectError(await api().get('/ai-gateway/models/nobody%2Fnothing'), 404);
  });

  it('resolves model strings the way the gateway does', async () => {
    let resolved = expectOk(
      await api().post('/ai-gateway/models/resolve', { model: catalogModels.sonnet })
    );
    expectPresented(resolved, 'ai_gateway.model.resolution');
    expect(resolved).toMatchObject({
      requested: catalogModels.sonnet,
      model: { slug: catalogModels.sonnet }
    });

    let pinned = expectOk(
      await api().post('/ai-gateway/models/resolve', { model: 'openai:gpt-6' })
    );
    expect(pinned.model.slug).toBe(catalogModels.gpt);

    expectError(
      await api().post('/ai-gateway/models/resolve', { model: 'no-such-model' }),
      404
    );
    expectError(
      await api().post('/ai-gateway/models/resolve', { model: '' }),
      400,
      'invalid_data'
    );
    expectError(await api().post('/ai-gateway/models/resolve', {}), 400, 'invalid_data');
  });

  it('lists offerings and filters them by model and provider', async () => {
    let offerings = await listAll(api(), '/ai-gateway/model-offerings');
    expect(offerings.length).toBeGreaterThanOrEqual(3);
    for (let offering of offerings) expectPresented(offering, 'ai_gateway.model.offering');

    let [model] = await listAll(api(), '/ai-gateway/models', { query: { search: 'gpt' } });
    let ofModel = await listAll(api(), '/ai-gateway/model-offerings', {
      query: { model_id: model.id }
    });
    expect(ofModel.length).toBeGreaterThan(0);
    expect(new Set(ofModel.map(offering => offering.model?.id))).toEqual(new Set([model.id]));

    let ofProvider = await listAll(api(), '/ai-gateway/model-offerings', {
      query: { provider: 'anthropic' }
    });
    expect(ofProvider.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ofProvider.map(offering => offering.provider.slug))).toEqual(
      new Set(['anthropic'])
    );
  });
});
