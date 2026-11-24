import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import {
  anthropicClient,
  anthropicHeaders,
  inferenceRest,
  openaiClient
} from '../support/client';
import { createConnection, createTenant, createToken, useCatalog } from '../support/fixtures';

let slugs = Object.values(catalogModels);

describe('ai-gateway models endpoint', () => {
  useCatalog();

  it('lists the models available through the Metorial provider', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    let page = await openaiClient(token.secret).models.list();

    expect(page.data.map(model => model.id)).toEqual(expect.arrayContaining(slugs));
  });

  it('answers in the format of the calling SDK', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    let openai = await inferenceRest(token.secret).get('/v1/models');
    expect(openai.body).toMatchObject({ object: 'list' });
    expect(openai.body.data[0]).toMatchObject({ object: 'model' });

    let anthropic = await anthropicClient(token.secret).models.list();
    expect(anthropic.data.map(model => model.id)).toEqual(expect.arrayContaining(slugs));
    expect(anthropic.data[0]).toMatchObject({ type: 'model' });
  });

  it('gets a single model and rejects unknown ones', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    let model = await openaiClient(token.secret).models.retrieve(catalogModels.haiku);
    expect(model.id).toBe(catalogModels.haiku);

    let missing = await inferenceRest(token.secret).get('/v1/models/nobody/nothing');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('model_not_found');

    let anthropicMissing = await inferenceRest(token.secret).get('/v1/models/nobody/nothing', {
      headers: anthropicHeaders
    });
    expect(anthropicMissing.status).toBe(404);
    expect(anthropicMissing.body.type).toBe('error');
  });

  it('only lists models the token may use', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant, { allowedModels: ['anthropic/*'] });

    let page = await openaiClient(token.secret).models.list();
    let ids = page.data.map(model => model.id);

    expect(ids).toEqual(expect.arrayContaining([catalogModels.sonnet, catalogModels.haiku]));
    expect(ids).not.toContain(catalogModels.gpt);

    let hidden = await inferenceRest(token.secret).get(`/v1/models/${catalogModels.gpt}`);
    expect(hidden.status).toBe(404);
  });

  it('lists nothing when the Metorial provider is off and no connection exists', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    let token = await createToken(tenant);

    let page = await openaiClient(token.secret).models.list();

    expect(page.data).toEqual([]);
  });

  it('lists only the models of the connected providers', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    await createConnection(tenant, { providerSlug: 'openai' });
    let token = await createToken(tenant);

    let ids = (await openaiClient(token.secret).models.list()).data.map(model => model.id);

    expect(ids).toContain(catalogModels.gpt);
    expect(ids).not.toContain(catalogModels.sonnet);
  });
});
