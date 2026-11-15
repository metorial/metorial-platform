import { metorialEndpoints, rest, rpc, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import type { IntegrationsClient, SubspaceInternalClient } from '../src';

describe('api-integrations', () => {
  it('serves /ping on the public and subspace-internal APIs', async () => {
    let integrations = await rest(metorialEndpoints().integrations).get('/ping');
    expect(integrations.status).toBe(200);
    expect(integrations.text).toBe('OK');

    let subspaceInternal = await rest(metorialEndpoints().subspaceInternal).get('/ping');
    expect(subspaceInternal.status).toBe(200);
    expect(subspaceInternal.text).toBe('OK');
  });

  it('redirects setup sessions to the integrations UI and rejects unknown routes', async () => {
    let api = rest(metorialEndpoints().integrations);
    let sessionId = uniqueId('pss');

    let redirect = await api.get(`/setup-session/${sessionId}`, { query: { step: 'auth' } });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toMatch(
      new RegExp(`/setup-session/${sessionId}\\?step=auth$`)
    );

    let callback = await api.get(`/oauth-callback/${uniqueId('unknown')}`);
    expect(callback.status).toBe(400);
    expect(callback.text).toBe('Invalid oauth callback URL');

    let missing = await api.get(`/${uniqueId('missing')}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('not_found');
  });

  it('rejects frontend RPC calls for unknown setup sessions', async () => {
    let client = rpc<IntegrationsClient>(
      `${metorialEndpoints().integrations}/integrations-api`
    );

    await expect(
      client.setupSession.get({ sessionId: uniqueId('pss'), clientSecret: uniqueId('secret') })
    ).rejects.toMatchObject({ data: { status: 404, code: 'not_found' } });
  });

  it('validates subspace-internal callback events', async () => {
    let client = rpc<SubspaceInternalClient>(
      `${metorialEndpoints().subspaceInternal}/subspace-internal`
    );

    await expect(
      client.callbackEvent.receive({ tenantIdentifier: uniqueId('tenant') } as any)
    ).rejects.toMatchObject({ data: { status: 400 } });
  });
});
