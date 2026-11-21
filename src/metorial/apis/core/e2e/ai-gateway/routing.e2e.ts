import {
  expectError,
  expectOk,
  expectPresented,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogModels } from './_catalog';
import { crossTenantClients, ensureCatalog, gatewayPath } from './_shared';

describe('api-core ai-gateway: routing preview', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let api = () => org.clients.instance;

  beforeAll(async () => {
    await ensureCatalog();
  });

  it('requires a credential', async () => {
    let clients = crossTenantClients(org, otherOrg);

    expectError(
      await clients.none.post(gatewayPath(org, 'none', '/routing/preview'), {
        model: catalogModels.haiku
      }),
      401
    );
  });

  it('routes catalog models to the Metorial provider', async () => {
    for (let model of [catalogModels.haiku, catalogModels.gpt]) {
      let route = expectOk(await api().post('/ai-gateway/routing/preview', { model }));

      expectPresented(route, 'ai_gateway.route_preview');
      expect(route).toMatchObject({
        requested: model,
        via: 'slug',
        model: { slug: model },
        candidates: [{ connection_owner: 'platform', provider: 'metorial' }]
      });
    }
  });

  it('does not route a pinned provider that has no connection', async () => {
    expectError(
      await api().post('/ai-gateway/routing/preview', { model: 'openai:gpt-6' }),
      404,
      'model_unavailable'
    );
  });

  it('applies the zero data retention requirement to provider connections', async () => {
    let error = expectError(
      await api().post('/ai-gateway/routing/preview', {
        model: catalogModels.haiku,
        required_features: ['zdr']
      }),
      404,
      'model_unavailable'
    );

    expect(error.message).toContain('zero data retention');
  });

  it('rejects a model that does not exist', async () => {
    expectError(
      await api().post('/ai-gateway/routing/preview', { model: 'nobody/nothing' }),
      404,
      'model_not_found'
    );
  });

  it('does not route virtual models', async () => {
    let slug = uniqueId('preview').toLowerCase();
    expectOk(
      await api().post('/ai-gateway/virtual-models', {
        slug,
        name: 'Preview router',
        definition: { rules: [], default: { models: [{ model: catalogModels.sonnet }] } }
      })
    );

    expectError(
      await api().post('/ai-gateway/routing/preview', { model: slug }),
      404,
      'model_not_found'
    );
  });

  it('rejects an invalid request', async () => {
    for (let body of [
      {},
      { model: '' },
      { model: catalogModels.haiku, required_features: ['telepathy'] }
    ]) {
      expectError(await api().post('/ai-gateway/routing/preview', body), 400, 'invalid_data');
    }
  });
});
