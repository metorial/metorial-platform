import {
  expectOk,
  metorialEndpoints,
  rest,
  rpc,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import type { IntegrationsClient, SubspaceInternalClient } from '../src';
import { integrationsUiUrl } from './_fixtures';

type SetupSession = { id: string; clientSecret: string };

let notFound = { data: { status: 404, code: 'not_found' } };

describe('api-integrations frontend and internal RPC', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let frontend = () =>
    rpc<IntegrationsClient>(`${metorialEndpoints().integrations}/integrations-api`);
  let legacyFrontend = () =>
    rpc<IntegrationsClient>(
      `${metorialEndpoints().integrations}/subspace-public/internal-api`
    );
  let subspaceInternal = () =>
    rpc<SubspaceInternalClient>(`${metorialEndpoints().subspaceInternal}/subspace-internal`);

  let createSetupSession = async (owner: typeof org): Promise<SetupSession> => {
    let session = expectOk(
      await owner.clients.instance.post('/provider-setup-sessions', {
        name: uniqueId('e2e-setup')
      })
    );
    let url = new URL(session.url);
    expect(`${url.origin}${url.pathname}`).toBe(
      `${integrationsUiUrl()}/setup-session/${session.id}`
    );

    return { id: session.id, clientSecret: url.searchParams.get('client_secret')! };
  };

  let session: SetupSession;
  let otherSession: SetupSession;

  beforeAll(async () => {
    session = await createSetupSession(org);
    otherSession = await createSetupSession(otherOrg);
  }, 120_000);

  it('opens a setup session only with its own client secret', async () => {
    for (let client of [frontend(), legacyFrontend()]) {
      let full = await client.setupSession.get({
        sessionId: session.id,
        clientSecret: session.clientSecret
      });
      expect(full.session).toMatchObject({
        object: 'provider.setup_session',
        id: session.id,
        status: 'pending'
      });
      expect(JSON.stringify(full)).not.toContain(session.clientSecret);
    }

    await expect(
      frontend().setupSession.get({ sessionId: session.id, clientSecret: uniqueId('secret') })
    ).rejects.toMatchObject(notFound);

    await expect(
      frontend().setupSession.get({
        sessionId: session.id,
        clientSecret: otherSession.clientSecret
      })
    ).rejects.toMatchObject(notFound);

    await expect(
      frontend().setupSession.get({
        sessionId: otherSession.id,
        clientSecret: session.clientSecret
      })
    ).rejects.toMatchObject(notFound);

    await expect(
      frontend().setupSession.listProviders({
        sessionId: session.id,
        clientSecret: uniqueId('secret')
      })
    ).rejects.toMatchObject(notFound);

    let providers = await frontend().setupSession.listProviders({
      sessionId: otherSession.id,
      clientSecret: otherSession.clientSecret
    });
    expect(providers).toMatchObject({
      items: expect.any(Array),
      pagination: expect.any(Object)
    });
  });

  it('validates setup session RPC input before touching the session', async () => {
    await expect(
      frontend().setupSession.get({ sessionId: session.id } as any)
    ).rejects.toMatchObject({ data: { status: 400 } });

    await expect(
      frontend().setupSession.get({ clientSecret: session.clientSecret } as any)
    ).rejects.toMatchObject({ data: { status: 400 } });

    await expect(
      frontend().integrationSetupSession.get({
        sessionId: uniqueId('iss'),
        clientSecret: uniqueId('secret')
      })
    ).rejects.toMatchObject(notFound);
  });

  it.fails(
    'rejects an empty client secret as a client error (bug: setup-session RPC middlewares throw a plain Error for empty strings, which surfaces as a 500)',
    async () => {
      await expect(
        frontend().setupSession.get({ sessionId: session.id, clientSecret: '' })
      ).rejects.toMatchObject({ data: { status: 400 } });

      await expect(
        frontend().integrationSetupSession.get({
          sessionId: uniqueId('iss'),
          clientSecret: ''
        })
      ).rejects.toMatchObject({ data: { status: 400 } });
    }
  );

  it('keeps subspace-internal off the public integrations port and away from browsers', async () => {
    let publicApi = rest(metorialEndpoints().integrations);
    let internalApi = rest(metorialEndpoints().subspaceInternal);

    let exposed = await publicApi.post('/subspace-internal', {});
    expect(exposed.status).toBe(404);

    let preflight = await internalApi.request('OPTIONS', '/subspace-internal', {
      headers: {
        origin: integrationsUiUrl(),
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();

    let frontendRoute = await internalApi.get(`/setup-session/${session.id}`, {
      query: { client_secret: session.clientSecret }
    });
    expect(frontendRoute.status).toBe(404);
    expect(frontendRoute.headers.get('location')).toBeNull();
  });

  it.fails(
    'rejects unauthenticated callback events on subspace-internal (bug: subspace-internal has no app-level authentication and relies only on network isolation)',
    async () => {
      let error = await subspaceInternal()
        .callbackEvent.receive({
          tenantIdentifier: uniqueId('tenant'),
          callbackId: uniqueId('cb'),
          callbackInstanceId: uniqueId('cbi'),
          triggerEventId: uniqueId('te'),
          triggerRegistrationId: uniqueId('tr'),
          triggerGroupKey: 'e2e',
          triggerKey: 'e2e',
          source: 'webhook',
          occurredAt: new Date()
        })
        .then(
          () => null,
          error => error
        );

      expect([401, 403]).toContain(error?.data?.status);
    }
  );
});
