import { catalogModels, type RecordedRequest } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import {
  chat,
  createTenant,
  createToken,
  failing,
  useCatalog,
  useUpstream
} from '../support/fixtures';

let longPrompt = 'lorem ipsum '.repeat(2500);

let modelsOf = (upstream: ReturnType<typeof useUpstream>) =>
  upstream.requests.map(request => request.body.model);

describe('ai-gateway inference through virtual models', () => {
  useCatalog();
  let upstream = useUpstream();

  let setup = async (
    definition: Parameters<typeof gateway.virtualModel.create>[0]['definition']
  ) => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    let virtualModel = await gateway.virtualModel.create({
      ...tenant.scope,
      slug: 'router',
      name: 'Router',
      definition
    });

    return { tenant, token, virtualModel };
  };

  let tiers = {
    rules: [
      {
        id: 'long',
        when: 'request.input_tokens > 1000',
        models: [{ model: catalogModels.sonnet }]
      }
    ],
    default: { models: [{ model: catalogModels.haiku }] }
  };

  it('routes requests by rule', async () => {
    let { token } = await setup(tiers);

    expect((await chat(token.secret, 'router')).status).toBe(200);
    expect(modelsOf(upstream)).toEqual(['claude-haiku-5']);

    upstream.reset();
    expect(
      (
        await chat(token.secret, 'router', {
          messages: [{ role: 'user', content: longPrompt }]
        })
      ).status
    ).toBe(200);
    expect(modelsOf(upstream)).toEqual(['claude-sonnet-5']);
  });

  it('routes on request metadata', async () => {
    let { token } = await setup({
      rules: [
        {
          id: 'premium',
          when: "metadata.tier == 'premium'",
          models: [{ model: catalogModels.sonnet }]
        }
      ],
      default: { models: [{ model: catalogModels.haiku }] }
    });

    await chat(token.secret, 'router', {}, { 'x-metorial-metadata': '{"tier":"premium"}' });
    await chat(token.secret, 'router', {}, { 'x-metorial-metadata': '{"tier":"free"}' });

    expect(modelsOf(upstream)).toEqual(['claude-sonnet-5', 'claude-haiku-5']);
  });

  it('falls through the targets of a rule when one fails', async () => {
    let { token } = await setup({
      rules: [],
      default: { models: [{ model: catalogModels.sonnet }, { model: catalogModels.gpt }] }
    });
    upstream.respond((request: RecordedRequest) =>
      new URL(request.url).hostname == 'api.anthropic.com'
        ? failing(500)
        : { steps: [{ type: 'text', text: 'From OpenAI' }] }
    );

    let response = await chat(token.secret, 'router');

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBe('From OpenAI');
    expect(new URL(upstream.requests.at(-1)!.url).hostname).toBe('api.openai.com');
  });

  it('applies parameter overrides to the upstream request', async () => {
    let { token } = await setup({
      rules: [],
      default: {
        models: [{ model: catalogModels.haiku }],
        overrides: { maxOutputTokens: 77 }
      }
    });

    await chat(token.secret, 'router', { max_tokens: 500 });

    expect(upstream.requests[0]!.body.max_tokens).toBe(77);
  });

  it('serves a new version after the definition changes', async () => {
    let { tenant, token, virtualModel } = await setup(tiers);
    await chat(token.secret, 'router');

    await gateway.virtualModel.update({
      ...tenant.scope,
      virtualModelId: virtualModel.id,
      definition: { rules: [], default: { models: [{ model: catalogModels.gpt }] } }
    });
    await chat(token.secret, 'router');

    expect(modelsOf(upstream)).toEqual(['claude-haiku-5', 'gpt-6']);
  });

  it('stops serving an archived virtual model', async () => {
    let { tenant, token, virtualModel } = await setup(tiers);
    await gateway.virtualModel.archive({ ...tenant.scope, virtualModelId: virtualModel.id });

    let response = await chat(token.secret, 'router');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('model_not_found');
  });

  it('keeps virtual models inside their instance', async () => {
    await setup(tiers);
    let other = await createTenant();
    let token = await createToken(other);

    let response = await chat(token.secret, 'router');

    expect(response.status).toBe(404);
  });

  it('checks the token against the virtual model, not its targets', async () => {
    let { tenant } = await setup(tiers);
    let long = { messages: [{ role: 'user', content: longPrompt }] };

    let allowed = await createToken(tenant, { allowedModels: ['router'] });
    expect((await chat(allowed.secret, 'router', long)).status).toBe(200);
    expect(modelsOf(upstream)).toEqual(['claude-sonnet-5']);

    upstream.reset();
    let restricted = await createToken(tenant, { allowedModels: [catalogModels.haiku] });
    let refused = await chat(restricted.secret, 'router');
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('model_not_allowed');
    expect(upstream.requests).toEqual([]);
  });
});
