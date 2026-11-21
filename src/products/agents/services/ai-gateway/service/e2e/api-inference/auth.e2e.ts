import { describe, expect, it } from 'vitest';
import { apiUrl, anthropicHeaders, inferenceRest, inferenceUrl } from '../support/client';
import { createToken, useCatalog, useTenant } from '../support/fixtures';

describe('ai-gateway inference auth', () => {
  useCatalog();
  let tenant = useTenant();

  it('answers pings without a token', async () => {
    let response = await fetch(`${inferenceUrl()}/ping`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });

  it('accepts a bearer token', async () => {
    let token = await createToken(tenant);

    let response = await inferenceRest(token.secret).get('/v1/models');

    expect(response.status).toBe(200);
  });

  it('accepts a token in the x-api-key header', async () => {
    let token = await createToken(tenant);

    let response = await inferenceRest().get('/v1/models', {
      headers: { 'x-api-key': token.secret, ...anthropicHeaders }
    });

    expect(response.status).toBe(200);
  });

  it('rejects a missing token in the shape of the calling SDK', async () => {
    let openai = await inferenceRest().get('/v1/models');
    expect(openai.status).toBe(401);
    expect(openai.headers.get('www-authenticate')).toBe('Bearer');
    expect(openai.body.error).toMatchObject({
      type: 'authentication_error',
      code: 'missing_credential'
    });

    let anthropic = await inferenceRest().get('/v1/models', { headers: anthropicHeaders });
    expect(anthropic.status).toBe(401);
    expect(anthropic.body).toMatchObject({
      type: 'error',
      error: { type: 'authentication_error' }
    });
  });

  it('rejects malformed, unknown and tampered tokens', async () => {
    let token = await createToken(tenant);

    for (let secret of [
      'garbage',
      'mt_gw_nope_nope',
      `${token.secret}x`,
      token.secret.slice(0, -4)
    ]) {
      let response = await inferenceRest(secret).get('/v1/models');
      expect(response.status, secret).toBe(401);
      expect(response.body.error.code, secret).toBe('invalid_credential');
    }
  });

  it('rejects an expired token', async () => {
    let token = await createToken(tenant, { expiresAt: new Date(Date.now() + 1500) });
    expect((await inferenceRest(token.secret).get('/v1/models')).status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 2000));

    let response = await inferenceRest(token.secret).get('/v1/models');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('invalid_credential');
  });

  it('authenticates every inference endpoint', async () => {
    for (let [path, headers] of [
      ['/v1/chat/completions', {}],
      ['/v1/responses', {}],
      ['/v1/messages', anthropicHeaders],
      ['/v1/messages/count_tokens', anthropicHeaders]
    ] as const) {
      let response = await inferenceRest().post(path, { body: {}, headers });
      expect(response.status, path).toBe(401);
    }
  });

  it('answers unknown routes with a dialect shaped 404', async () => {
    let token = await createToken(tenant);

    let response = await inferenceRest(token.secret).get('/v1/nothing');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('route_not_found');
  });

  it('allows browsers to call the inference api', async () => {
    let response = await fetch(`${inferenceUrl()}/v1/chat/completions`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type,x-metorial-metadata'
      }
    });

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'x-metorial-metadata'
    );
  });

  it('serves the internal api on a separate port', async () => {
    expect(apiUrl()).not.toBe(inferenceUrl());

    let response = await fetch(`${apiUrl()}/ping`);
    expect(response.status).toBe(200);

    let inference = await fetch(`${inferenceUrl()}/metorial-ai-gateway`, { method: 'POST' });
    expect(inference.status).toBe(404);
  });
});
