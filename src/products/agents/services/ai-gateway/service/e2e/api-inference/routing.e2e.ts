import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import {
  apiKeys,
  chat,
  createConnection,
  createTenant,
  createToken,
  failing,
  keysOf,
  respondPerKey,
  useCatalog,
  useUpstream
} from '../support/fixtures';

describe('ai-gateway inference routing', () => {
  useCatalog();
  let upstream = useUpstream();

  let setup = async (settings: Parameters<typeof createTenant>[0] = {}) => {
    let tenant = await createTenant(settings);
    let token = await createToken(tenant);

    return { tenant, token };
  };

  it('uses the Metorial provider when the instance has no connection', async () => {
    let { token } = await setup();

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(200);
    expect(keysOf(upstream)).toEqual([apiKeys.platformAnthropic]);
  });

  it('uses the customer connection before the Metorial provider', async () => {
    let { tenant, token } = await setup();
    await createConnection(tenant, { credentials: { apiKey: 'customer-key' } });

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(200);
    expect(keysOf(upstream)).toEqual(['customer-key']);
  });

  it('uses connections in priority order', async () => {
    let { tenant, token } = await setup({
      settings: { metorialProvider: { enabled: false } }
    });
    await createConnection(tenant, { priority: 1, credentials: { apiKey: 'low-key' } });
    await createConnection(tenant, { priority: 9, credentials: { apiKey: 'high-key' } });

    await chat(token.secret, catalogModels.haiku);

    expect(keysOf(upstream)).toEqual(['high-key']);
  });

  it('falls back to the next connection and then the Metorial provider', async () => {
    let { tenant, token } = await setup();
    await createConnection(tenant, { priority: 9, credentials: { apiKey: 'broken-key' } });
    await createConnection(tenant, { priority: 1, credentials: { apiKey: 'also-broken' } });
    respondPerKey(upstream, {
      'broken-key': failing(500),
      'also-broken': failing(503)
    });

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(200);
    expect(keysOf(upstream)).toEqual(['broken-key', 'also-broken', apiKeys.platformAnthropic]);
  });

  it('falls back after authentication failures and rate limits', async () => {
    let { tenant, token } = await setup({
      settings: { metorialProvider: { enabled: false } }
    });
    await createConnection(tenant, { priority: 3, credentials: { apiKey: 'revoked-key' } });
    await createConnection(tenant, { priority: 2, credentials: { apiKey: 'throttled-key' } });
    await createConnection(tenant, { priority: 1, credentials: { apiKey: 'good-key' } });
    respondPerKey(upstream, {
      'revoked-key': failing(401),
      'throttled-key': failing(429)
    });

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(200);
    expect(keysOf(upstream)).toEqual(['revoked-key', 'throttled-key', 'good-key']);
  });

  it('does not fall back when the request itself is invalid', async () => {
    let { tenant, token } = await setup();
    await createConnection(tenant, { priority: 9, credentials: { apiKey: 'strict-key' } });
    await createConnection(tenant, { priority: 1, credentials: { apiKey: 'other-key' } });
    respondPerKey(upstream, { 'strict-key': failing(400, 'prompt is too long') });

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('prompt is too long');
    expect(keysOf(upstream)).toEqual(['strict-key']);
  });

  it('reports the last failure once every candidate failed', async () => {
    let { tenant, token } = await setup({
      settings: { metorialProvider: { enabled: false } }
    });
    await createConnection(tenant, { credentials: { apiKey: 'down-key' } });
    upstream.respond(failing(503, 'overloaded'));

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('upstream_overloaded');
  });

  it('names the customer provider when its credentials are rejected', async () => {
    let { tenant, token } = await setup({
      settings: { metorialProvider: { enabled: false } }
    });
    await createConnection(tenant, { credentials: { apiKey: 'expired-key' } });
    upstream.respond(failing(401, 'invalid x-api-key'));

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('upstream_authentication_failed');
    expect(response.body.error.message).toContain('Anthropic');
  });

  it('can disable fallbacks for an instance', async () => {
    let { tenant, token } = await setup({ settings: { fallbacks: { enabled: false } } });
    await createConnection(tenant, { credentials: { apiKey: 'broken-key' } });
    upstream.respond(failing(500));

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(keysOf(upstream)).toEqual(['broken-key']);
  });

  it('keeps a pinned provider from falling back to the Metorial provider', async () => {
    let { tenant, token } = await setup();
    await createConnection(tenant, { credentials: { apiKey: 'broken-key' } });
    upstream.respond(failing(500));

    let response = await chat(token.secret, 'anthropic:claude-haiku-5');

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(keysOf(upstream)).toEqual(['broken-key']);
  });

  it('refuses a pinned provider without a connection', async () => {
    let { token } = await setup();

    let response = await chat(token.secret, 'anthropic:claude-haiku-5');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('model_unavailable');
    expect(upstream.requests).toEqual([]);
  });

  it('keeps the metorial prefix on the Metorial provider', async () => {
    let { tenant, token } = await setup();
    await createConnection(tenant, { credentials: { apiKey: 'customer-key' } });

    await chat(token.secret, `metorial:${catalogModels.haiku}`);

    expect(keysOf(upstream)).toEqual([apiKeys.platformAnthropic]);
  });

  it('answers 404 when no provider serves the model', async () => {
    let { token } = await setup({ settings: { metorialProvider: { enabled: false } } });

    let response = await chat(token.secret, catalogModels.haiku);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('model_unavailable');
    expect(upstream.requests).toEqual([]);
  });

  it('routes OpenAI models to the OpenAI key', async () => {
    let { tenant, token } = await setup();

    await chat(token.secret, catalogModels.gpt);
    expect(keysOf(upstream)).toEqual([apiKeys.platformOpenai]);

    upstream.reset();
    await createConnection(tenant, {
      providerSlug: 'openai',
      credentials: { apiKey: 'customer-openai' }
    });
    await chat(token.secret, catalogModels.gpt);
    expect(keysOf(upstream)).toEqual(['customer-openai']);
  });

  it('requires zero data retention connections when the instance asks for it', async () => {
    let { tenant, token } = await setup({
      settings: { zeroDataRetention: { required: true } }
    });
    await createConnection(tenant, { credentials: { apiKey: 'plain-key' } });

    let refused = await chat(token.secret, catalogModels.haiku);
    expect(refused.status).toBe(404);
    expect(refused.body.error.code).toBe('model_unavailable');
    expect(upstream.requests).toEqual([]);

    await createConnection(tenant, {
      credentials: { apiKey: 'zdr-key' },
      features: { zdr: true }
    });
    let served = await chat(token.secret, catalogModels.haiku);
    expect(served.status).toBe(200);
    expect(keysOf(upstream)).toEqual(['zdr-key']);
  });

  it('skips disabled and archived connections', async () => {
    let { tenant, token } = await setup();
    let disabled = await createConnection(tenant, { credentials: { apiKey: 'disabled-key' } });
    let archived = await createConnection(tenant, { credentials: { apiKey: 'archived-key' } });
    let { gateway } = await import('../support/client');
    await gateway.providerConnection.setEnabled({
      ...tenant.scope,
      connectionId: disabled.id,
      enabled: false
    });
    await gateway.providerConnection.archive({ ...tenant.scope, connectionId: archived.id });

    await chat(token.secret, catalogModels.haiku);

    expect(keysOf(upstream)).toEqual([apiKeys.platformAnthropic]);
  });

  describe('token restrictions', () => {
    it('refuses models the token may not use', async () => {
      let { tenant } = await setup();
      let token = await createToken(tenant, { allowedModels: [catalogModels.haiku] });

      let allowed = await chat(token.secret, catalogModels.haiku);
      expect(allowed.status).toBe(200);

      let refused = await chat(token.secret, catalogModels.sonnet);
      expect(refused.status).toBe(403);
      expect(refused.body.error.code).toBe('model_not_allowed');
    });

    it('matches wildcards and aliases', async () => {
      let { tenant } = await setup();
      let token = await createToken(tenant, { allowedModels: ['anthropic/*'] });

      expect((await chat(token.secret, catalogModels.sonnet)).status).toBe(200);
      expect((await chat(token.secret, 'claude-haiku-latest')).status).toBe(200);
      expect((await chat(token.secret, catalogModels.gpt)).status).toBe(403);
    });

    it('applies changes to allowed models to a token already in use', async () => {
      let { tenant } = await setup();
      let token = await createToken(tenant);
      expect((await chat(token.secret, catalogModels.gpt)).status).toBe(200);

      let { gateway } = await import('../support/client');
      await gateway.gatewayToken.update({
        organizationId: tenant.organization.id,
        gatewayTokenId: token.id,
        allowedModels: [catalogModels.haiku]
      });

      expect((await chat(token.secret, catalogModels.gpt)).status).toBe(403);
    });
  });
});
