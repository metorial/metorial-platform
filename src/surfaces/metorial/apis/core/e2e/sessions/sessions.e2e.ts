import {
  API_VERSIONS,
  createRemoteProvider,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  useMcpTestServer,
  useOrganization,
  type RemoteProvider
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createProviderConfig,
  createProviderDeployment,
  crossTenantClients,
  ids,
  instancePathFor
} from './_shared';

describe('api-core sessions: sessions and session providers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let provider: RemoteProvider;
  let otherProvider: RemoteProvider;
  let deployment: any;
  let config: any;
  let otherDeployment: any;
  let otherConfig: any;

  beforeAll(async () => {
    provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    otherProvider = await createRemoteProvider(otherOrg.clients.instance, { url: server.url });

    deployment = await createProviderDeployment(org.clients.instance, provider.providerId);
    config = await createProviderConfig(org.clients.instance, {
      providerId: provider.providerId,
      deploymentId: deployment.id
    });
    otherDeployment = await createProviderDeployment(
      otherOrg.clients.instance,
      otherProvider.providerId
    );
    otherConfig = await createProviderConfig(otherOrg.clients.instance, {
      providerId: otherProvider.providerId,
      deploymentId: otherDeployment.id
    });
  }, 180_000);

  let createSessionResponse = (providers: unknown[], body: Record<string, unknown> = {}) =>
    org.clients.instance.post('/sessions', { ...body, providers });

  let createSession = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await createSessionResponse([{ provider_deployment_id: deployment.id }], {
        name: uniqueId('e2e-session'),
        ...body
      })
    );

  let fineGrained = (secret: string) =>
    rest(metorialEndpoints().api, { apiKey: secret, version: API_VERSIONS.magnetar });

  it('authenticates session routes per credential', async () => {
    let session = await createSession();
    let clients = crossTenantClients(org, otherOrg);

    let responses = await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, `/sessions/${session.id}`)),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404
      }
    );
    for (let name of ['session', 'management', 'instance'] as const) {
      expect(responses[name].body.id).toBe(session.id);
    }

    let lists = await expectAuthMatrix(
      clients,
      (client, name) => client.get(instancePathFor(org, name, '/sessions')),
      { none: 401, session: 200, management: 200, instance: 200, otherInstance: 200 }
    );
    for (let name of ['session', 'management', 'instance'] as const) {
      expect(ids(lists[name].body.items)).toContain(session.id);
    }
    expect(ids(lists.otherInstance.body.items)).not.toContain(session.id);
  });

  it('creates sessions from a provider deployment reference or an inline deployment', async () => {
    let byReference = expectOk(
      await createSessionResponse([{ provider_deployment_id: deployment.id }])
    );
    expect(byReference.providers).toHaveLength(1);
    expect(byReference.providers[0]).toMatchObject({
      provider_id: provider.providerId,
      session_id: byReference.id,
      deployment: { id: deployment.id }
    });

    let deploymentName = uniqueId('inline-deployment');
    let inline = expectOk(
      await createSessionResponse([
        {
          provider_deployment: {
            provider_id: provider.providerId,
            name: deploymentName,
            description: 'Inline deployment',
            metadata: { source: 'e2e' }
          }
        }
      ])
    );
    expect(inline.providers[0].provider_id).toBe(provider.providerId);
    expect(inline.providers[0].deployment.id).not.toBe(deployment.id);
    expect(inline.providers[0].deployment).toMatchObject({
      name: deploymentName,
      description: 'Inline deployment',
      metadata: { source: 'e2e' }
    });

    let two = expectOk(
      await createSessionResponse([
        { provider_deployment_id: deployment.id },
        { provider_deployment: { provider_id: provider.providerId } }
      ])
    );
    expect(two.providers).toHaveLength(2);
    expect(two.providers.map((item: any) => item.deployment.id)).toContain(deployment.id);
  });

  it('creates sessions with provider config references and inline configs', async () => {
    let withConfigId = expectOk(
      await createSessionResponse([
        { provider_deployment_id: deployment.id, provider_config_id: config.id }
      ])
    );
    expect(withConfigId.providers[0].config.id).toBe(config.id);

    let configOnly = expectOk(
      await createSessionResponse([{ provider_config_id: config.id }])
    );
    expect(configOnly.providers[0].deployment.id).toBe(deployment.id);
    expect(configOnly.providers[0].config.id).toBe(config.id);

    let invalidValue = expectError(
      await createSessionResponse([
        {
          provider_deployment_id: deployment.id,
          provider_config: { value: { api_key: 'e2e-inline-secret' } }
        }
      ]),
      400,
      'invalid_data'
    );
    expect(invalidValue.entity).toBe('config');

    let configName = uniqueId('inline-config');
    let inlineWithReference = expectOk(
      await createSessionResponse([
        {
          provider_deployment_id: deployment.id,
          provider_config: { name: configName, value: {} }
        }
      ])
    );
    expect(inlineWithReference.providers[0].deployment.id).toBe(deployment.id);
    expect(inlineWithReference.providers[0].config.name).toBe(configName);
    expect(inlineWithReference.providers[0].config.id).not.toBe(config.id);

    let inlineWithInlineDeployment = expectOk(
      await createSessionResponse([
        {
          provider_deployment: { provider_id: provider.providerId },
          provider_config: { name: configName, value: {} }
        }
      ])
    );
    expect(inlineWithInlineDeployment.providers[0].config.name).toBe(configName);
  });

  it('keeps every provider alternative of a combined body instead of dropping one', async () => {
    let mismatch = expectError(
      await createSessionResponse([
        {
          provider_deployment: { provider_id: provider.providerId },
          provider_config_id: config.id
        }
      ]),
      400,
      'bad_request'
    );
    expect(mismatch.message).toContain('cannot be used with the selected deployment');

    let vault = expectError(
      await createSessionResponse([
        {
          provider_deployment_id: deployment.id,
          provider_config: { provider_config_vault_id: uniqueId('pcvt') }
        }
      ]),
      404,
      'not_found'
    );
    expect(vault.entity).toBe('provider.config_vault');

    let authConfig = expectError(
      await createSessionResponse([
        {
          provider_deployment_id: deployment.id,
          provider_auth_config_id: uniqueId('pac')
        }
      ]),
      404,
      'not_found'
    );
    expect(authConfig.entity).toBe('provider.auth_config');

    let inlineAuth = await createSessionResponse([
      {
        provider_deployment_id: deployment.id,
        provider_auth_config: {
          provider_auth_method_id: uniqueId('pam'),
          credentials: { token: 'e2e-credential' }
        }
      }
    ]);
    expect(inlineAuth.status).toBeGreaterThanOrEqual(400);
    expect(inlineAuth.body.entity).not.toBe('provider');
  });

  it('rejects provider config references that do not exist or belong to another organization', async () => {
    for (let providerConfigId of [uniqueId('pcf'), otherConfig.id]) {
      let error = expectError(
        await createSessionResponse([
          { provider_deployment_id: deployment.id, provider_config_id: providerConfigId }
        ]),
        404,
        'not_found'
      );
      expect(error.entity).toBe('provider.config');
    }
  });

  it('validates session bodies', async () => {
    let invalidBodies: unknown[] = [
      {},
      { providers: 'all' },
      { providers: [{ provider_deployment_id: 42 }] },
      { providers: [{ provider_deployment: {} }] },
      { providers: [{ provider_deployment: { provider_id: 42 } }] },
      { providers: [{ provider_deployment: { provider_id: 'pro_x', metadata: 'x' } }] },
      { providers: [{ provider_config: { name: 'missing value or vault' } }] },
      { providers: [{ provider_config: { value: 'not-an-object' } }] },
      { providers: [{ provider_config: { provider_config_vault_id: 42 } }] },
      { providers: [{ provider_config_id: 42 }] },
      { providers: [{ provider_auth_config: { credentials: {} } }] },
      {
        providers: [
          { provider_auth_config: { provider_auth_method_id: 'pam_x', credentials: 'x' } }
        ]
      },
      { providers: [{ provider_auth_config_id: 42 }] },
      { providers: [{ session_template_id: 42 }] },
      { providers: [{ provider_deployment_id: 'pdp_x', tool_filters: { type: 'unknown' } }] },
      {
        providers: [{ provider_deployment_id: 'pdp_x', tool_filters: { type: 'tool_keys' } }]
      },
      { name: 42, providers: [] },
      { metadata: 'x', providers: [] }
    ];

    for (let body of invalidBodies) {
      expectError(await org.clients.instance.post('/sessions', body), 400, 'invalid_data');
    }

    let empty = expectError(await createSessionResponse([{}]), 400, 'bad_request');
    expect(empty.message).toContain('at least a provider config');

    let missingDeployment = expectError(
      await createSessionResponse([{ provider_deployment_id: uniqueId('pdp') }]),
      404,
      'not_found'
    );
    expect(missingDeployment.entity).toBe('provider.deployment');

    let missingProvider = expectError(
      await createSessionResponse([{ provider_deployment: { provider_id: uniqueId('pro') } }]),
      404,
      'not_found'
    );
    expect(missingProvider.entity).toBe('provider');

    for (let query of [{ status: 'deleted' }, { limit: 0 }, { status: 'unknown' }]) {
      expectError(await org.clients.instance.get('/sessions', { query }), 400, 'invalid_data');
    }
  });

  it('updates and archives a session', async () => {
    let session = await createSession({ description: 'Created by e2e', metadata: { a: 1 } });
    expect(session).toMatchObject({
      status: 'active',
      description: 'Created by e2e',
      metadata: { a: 1 }
    });

    let updated = expectOk(
      await org.clients.instance.patch(`/sessions/${session.id}`, {
        name: 'Renamed session',
        metadata: { b: 2 }
      })
    );
    expect(updated).toMatchObject({
      name: 'Renamed session',
      description: 'Created by e2e',
      metadata: { b: 2 }
    });

    expectError(
      await org.clients.instance.patch(`/sessions/${session.id}`, { name: 42 }),
      400,
      'invalid_data'
    );

    let archived = expectOk(await org.clients.instance.delete(`/sessions/${session.id}`));
    expect(archived.status).toBe('archived');
    expect(archived.connection_state).toBe('disconnected');

    let fetched = expectOk(await org.clients.instance.get(`/sessions/${session.id}`));
    expect(fetched.status).toBe('archived');

    expectError(
      await org.clients.instance.patch(`/sessions/${session.id}`, { name: 'Too late' }),
      410,
      'gone'
    );
    expectError(await org.clients.instance.delete(`/sessions/${session.id}`), 410, 'gone');

    let active = await listAll(org.clients.instance, '/sessions');
    expect(ids(active)).not.toContain(session.id);

    let archivedList = await listAll(org.clients.instance, '/sessions', {
      query: { status: 'archived' }
    });
    expect(ids(archivedList)).toContain(session.id);
  });

  it('pages through and filters sessions', async () => {
    let created = [await createSession(), await createSession(), await createSession()];
    let inline = expectOk(
      await createSessionResponse([
        { provider_deployment: { provider_id: provider.providerId } }
      ])
    );

    let paged = await listAll(org.clients.instance, '/sessions', { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(ids(paged)).toEqual(expect.arrayContaining([...ids(created), inline.id]));

    let byId = await listAll(org.clients.instance, '/sessions', {
      query: { id: created[1].id }
    });
    expect(ids(byId)).toEqual([created[1].id]);

    let byDeployment = await listAll(org.clients.instance, '/sessions', {
      query: { provider_deployment_id: deployment.id }
    });
    expect(ids(byDeployment)).toEqual(expect.arrayContaining(ids(created)));
    expect(ids(byDeployment)).not.toContain(inline.id);

    let bySessionProvider = await listAll(org.clients.instance, '/sessions', {
      query: { session_provider_id: inline.providers[0].id }
    });
    expect(ids(bySessionProvider)).toEqual([inline.id]);

    let byProvider = await listAll(org.clients.instance, '/sessions', {
      query: { provider_id: provider.providerId }
    });
    expect(ids(byProvider)).toEqual(expect.arrayContaining([...ids(created), inline.id]));

    let byForeignProvider = await listAll(org.clients.instance, '/sessions', {
      query: { provider_id: otherProvider.providerId }
    });
    expect(byForeignProvider).toEqual([]);
  });

  it('hides sessions from other organizations and rejects their provider ids', async () => {
    let session = await createSession();
    let other = otherOrg.clients.instance;

    expectError(await other.get(`/sessions/${session.id}`), 404, 'not_found');
    expectError(await other.patch(`/sessions/${session.id}`, { name: 'x' }), 404, 'not_found');
    expectError(await other.delete(`/sessions/${session.id}`), 404, 'not_found');
    expectError(
      await rest(metorialEndpoints().api, { session: otherOrg.session }).get(
        `/dashboard/instances/${otherOrg.ids.instanceId}/sessions/${session.id}`
      ),
      404,
      'not_found'
    );

    let foreignDeployment = expectError(
      await createSessionResponse([{ provider_deployment_id: otherDeployment.id }]),
      404,
      'not_found'
    );
    expect(foreignDeployment.entity).toBe('provider.deployment');

    let foreignProvider = expectError(
      await createSessionResponse([
        { provider_deployment: { provider_id: otherProvider.providerId } }
      ]),
      404,
      'not_found'
    );
    expect(foreignProvider.entity).toBe('provider');

    expect(expectOk(await org.clients.instance.get(`/sessions/${session.id}`)).status).toBe(
      'active'
    );
  });

  it('presents sessions with a client secret scoped to the session', async () => {
    let session = await createSession();
    expectPresented(session, 'session');
    expectPresented(session.providers[0], 'session.provider');
    expect(session.connection_url).toMatch(new RegExp(`/connect/mcp/${session.id}$`));
    expect(session.client_secret).toEqual(expect.any(String));
    expect(session.from_template_ids).toEqual([]);
    expect(session.usage).toEqual({
      total_productive_client_message_count: 0,
      total_productive_provider_message_count: 0
    });

    let fetched = expectOk(await org.clients.instance.get(`/sessions/${session.id}`));
    expect(fetched.client_secret).toBe(session.client_secret);
    let listed = (
      await listAll(org.clients.instance, '/sessions', {
        query: { id: session.id }
      })
    )[0];
    expect(listed.client_secret).toBe(session.client_secret);

    let other = await createSession();
    expect(other.client_secret).not.toBe(session.client_secret);

    let scoped = fineGrained(session.client_secret);
    expect(expectOk(await scoped.get(`/sessions/${session.id}`)).id).toBe(session.id);
    expect(ids(expectOk(await scoped.get('/sessions')).items)).toEqual([session.id]);
    expectError(await scoped.get(`/sessions/${other.id}`), 403);
    expectError(
      await scoped.post('/sessions', {
        providers: [{ provider_deployment_id: deployment.id }]
      }),
      403
    );
  });

  describe('session providers', () => {
    let addProvider = (body: Record<string, unknown>) =>
      org.clients.instance.post('/session-providers', body);

    it('authenticates session provider routes per credential', async () => {
      let session = await createSession();
      let sessionProviderId = session.providers[0].id;

      await expectAuthMatrix(
        crossTenantClients(org, otherOrg),
        (client, name) =>
          client.get(instancePathFor(org, name, `/session-providers/${sessionProviderId}`)),
        {
          none: 401,
          session: 200,
          management: 200,
          instance: 200,
          otherSession: 404,
          otherManagement: 404,
          otherInstance: 404
        }
      );
    });

    it('adds, updates and archives providers of a session', async () => {
      let session = await createSession();

      let added = expectOk(
        await addProvider({
          session_id: session.id,
          provider_deployment: { provider_id: provider.providerId },
          tool_filters: { type: 'tool_keys', keys: ['echo'] }
        })
      );
      expectPresented(added, 'session.provider');
      expect(added).toMatchObject({
        status: 'active',
        session_id: session.id,
        provider_id: provider.providerId
      });
      expect(added.deployment.id).not.toBe(deployment.id);

      let byReference = expectOk(
        await addProvider({
          session_id: session.id,
          provider_deployment_id: deployment.id,
          provider_config_id: config.id
        })
      );
      expect(byReference.config.id).toBe(config.id);

      let fetched = expectOk(await org.clients.instance.get(`/session-providers/${added.id}`));
      expect(fetched.id).toBe(added.id);

      let listed = await listAll(org.clients.instance, '/session-providers', {
        query: { session_id: session.id },
        limit: 1
      });
      expect(ids(listed).sort()).toEqual(
        [session.providers[0].id, added.id, byReference.id].sort()
      );

      let session2 = expectOk(await org.clients.instance.get(`/sessions/${session.id}`));
      expect(ids(session2.providers)).toEqual(
        expect.arrayContaining([added.id, byReference.id])
      );

      let updated = expectOk(
        await org.clients.instance.patch(`/session-providers/${added.id}`, {
          tool_filters: { type: 'tool_keys', keys: ['add'] }
        })
      );
      expect(JSON.stringify(updated.tool_filter)).toContain('add');
      expect(JSON.stringify(updated.tool_filter)).not.toContain('echo');

      let archived = expectOk(
        await org.clients.instance.delete(`/session-providers/${added.id}`)
      );
      expect(archived.status).toBe('archived');

      expectError(
        await org.clients.instance.patch(`/session-providers/${added.id}`, {
          tool_filters: null
        }),
        410,
        'gone'
      );
      expectError(
        await org.clients.instance.delete(`/session-providers/${added.id}`),
        410,
        'gone'
      );

      let active = await listAll(org.clients.instance, '/session-providers', {
        query: { session_id: session.id }
      });
      expect(ids(active)).not.toContain(added.id);

      let archivedList = await listAll(org.clients.instance, '/session-providers', {
        query: { session_id: session.id, status: 'archived' }
      });
      expect(ids(archivedList)).toEqual([added.id]);
    });

    it('validates session provider bodies', async () => {
      let session = await createSession();

      for (let body of [
        {},
        { provider_deployment_id: deployment.id },
        { session_id: 42, provider_deployment_id: deployment.id },
        { session_id: session.id, provider_deployment: {} },
        { session_id: session.id, provider_config: { name: 'x' } },
        { session_id: session.id, provider_auth_config: { credentials: {} } },
        { session_id: session.id, provider_deployment_id: deployment.id, tool_filters: 'x' }
      ]) {
        expectError(await addProvider(body), 400, 'invalid_data');
      }

      let mismatch = expectError(
        await addProvider({
          session_id: session.id,
          provider_deployment: { provider_id: provider.providerId },
          provider_config_id: config.id
        }),
        400,
        'bad_request'
      );
      expect(mismatch.message).toContain('cannot be used with the selected deployment');

      expectError(
        await addProvider({
          session_id: uniqueId('ses'),
          provider_deployment_id: deployment.id
        }),
        404,
        'not_found'
      );

      expectError(
        await org.clients.instance.patch(`/session-providers/${session.providers[0].id}`, {
          tool_filters: { type: 'tool_regex' }
        }),
        400,
        'invalid_data'
      );
      expectError(
        await org.clients.instance.get('/session-providers', { query: { status: 'gone' } }),
        400,
        'invalid_data'
      );
    });

    it('rejects adding providers to archived sessions', async () => {
      let session = await createSession();
      expectOk(await org.clients.instance.delete(`/sessions/${session.id}`));

      let error = expectError(
        await addProvider({ session_id: session.id, provider_deployment_id: deployment.id }),
        400,
        'use_after_delete'
      );
      expect(error.entityId).toBe(session.id);
    });

    it('hides session providers from other organizations', async () => {
      let session = await createSession();
      let sessionProviderId = session.providers[0].id;
      let other = otherOrg.clients.instance;

      expectError(
        await other.get(`/session-providers/${sessionProviderId}`),
        404,
        'not_found'
      );
      expectError(
        await other.patch(`/session-providers/${sessionProviderId}`, { tool_filters: null }),
        404,
        'not_found'
      );
      expectError(
        await other.delete(`/session-providers/${sessionProviderId}`),
        404,
        'not_found'
      );
      expectError(
        await other.post('/session-providers', {
          session_id: session.id,
          provider_deployment_id: otherDeployment.id
        }),
        404,
        'not_found'
      );

      let otherList = await listAll(other, '/session-providers', {
        query: { session_id: session.id }
      });
      expect(otherList).toEqual([]);

      let foreignDeployment = expectError(
        await addProvider({
          session_id: session.id,
          provider_deployment_id: otherDeployment.id
        }),
        404,
        'not_found'
      );
      expect(foreignDeployment.entity).toBe('provider.deployment');
    });
  });
});
