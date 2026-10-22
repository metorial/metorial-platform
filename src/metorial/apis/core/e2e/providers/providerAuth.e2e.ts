import {
  createRemoteProvider,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useMember,
  useOrganization,
  type RemoteProvider
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  dashboardOnlyStatuses,
  ids,
  instanceRoute,
  ownInstanceStatuses,
  ownResourceStatuses,
  tenantClients,
  waitForSpecification
} from './_shared';

let listPaths = [
  '/provider-auth-configs',
  '/provider-auth-credentials',
  '/provider-setup-sessions',
  '/provider-auth-config-exports',
  '/provider-auth-config-imports'
];

describe('api-core providers: auth configs, credentials and setup sessions', () => {
  let org = useOrganization();
  let member = useMember(org);
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let remote: RemoteProvider;
  let foreign: RemoteProvider;

  beforeAll(async () => {
    remote = await createRemoteProvider(org.clients.instance, { url: server.url });
    await waitForSpecification(org.clients.instance, remote.providerId);

    foreign = await createRemoteProvider(otherOrg.clients.instance, { url: server.url });
    await waitForSpecification(otherOrg.clients.instance, foreign.providerId);
  }, 240_000);

  let createSetupSession = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/provider-setup-sessions', {
        name: uniqueId('e2e-setup'),
        ...body
      })
    );

  it('authenticates auth routes per credential', async () => {
    let route = instanceRoute(org.ids.instanceId);
    let clients = tenantClients(org, otherOrg, { member: member.clients.rest });

    for (let path of listPaths) {
      await expectAuthMatrix(clients, (client, name) => client.get(route(name, path)), {
        ...ownInstanceStatuses,
        member: 200,
        otherInstance: 200
      });
    }

    let setupSession = await createSetupSession();
    await expectAuthMatrix(
      clients,
      (client, name) => client.get(route(name, `/provider-setup-sessions/${setupSession.id}`)),
      { ...ownResourceStatuses, member: 200 }
    );

    for (let path of [
      '/provider-auth-config-events',
      '/provider-auth-config-errors',
      '/provider-auth-config-error-groups'
    ]) {
      await expectAuthMatrix(clients, (client, name) => client.get(route(name, path)), {
        ...dashboardOnlyStatuses,
        management: 403,
        member: 200
      });
    }
  });

  it('restricts auth exports and imports to admins', async () => {
    let route = instanceRoute(org.ids.instanceId);
    let clients = tenantClients(org, otherOrg, { member: member.clients.rest });

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.post(route(name, '/provider-auth-config-exports'), {
          provider_auth_config_id: 'pauc_unknown',
          note: 'Export for e2e'
        }),
      { none: 401, member: 403, session: 404, management: 404, instance: 404 }
    );

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.post(route(name, '/provider-auth-config-imports'), {
          provider_id: 'pro_unknown',
          note: 'Import for e2e',
          value: { token: 'imported' }
        }),
      { none: 401, member: 403, session: 404, management: 404, instance: 404 }
    );
  });

  it('lists no auth configs, credentials, exports or imports for a provider without auth', async () => {
    let client = org.clients.instance;

    for (let path of listPaths.filter(path => path !== '/provider-setup-sessions')) {
      let items = await listAll(client, path, { query: { provider_id: remote.providerId } });
      expect(items).toEqual([]);
    }
  });

  it('creates, updates and lists setup sessions', async () => {
    let client = org.clients.instance;
    let name = uniqueId('e2e-setup');

    let setupSession = await createSetupSession({
      name,
      description: 'Setup over REST',
      metadata: { team: 'e2e' },
      redirect_url: 'https://example.com/callback',
      configuration: { ui: { layout: 'side' }, tool_filters: { enabled: true } }
    });
    expectPresented(setupSession, 'provider.setup_session');
    expect(setupSession).toMatchObject({
      type: 'auto',
      status: 'pending',
      name,
      description: 'Setup over REST',
      metadata: { team: 'e2e' },
      redirect_url: 'https://example.com/callback',
      provider_id: null,
      auth_method: null,
      auth_config: null,
      credentials: null,
      configuration: { ui: { layout: 'side' }, tool_filters: { enabled: true } }
    });
    expect(setupSession.url).toContain(`/setup-session/${setupSession.id}?client_secret=`);

    let dashboardSession = expectOk(
      await org.clients.rest.post(
        `/dashboard/instances/${org.ids.instanceId}/provider-setup-sessions`,
        {}
      )
    );
    expect(dashboardSession).toMatchObject({ type: 'auth_only', name: 'Setup Session' });
    expect(dashboardSession).toHaveProperty('public_mcp_server_id', null);

    let withProvider = await createSetupSession({ provider_id: remote.providerId });
    expect(withProvider.provider_id).toBe(remote.providerId);

    let path = `/provider-setup-sessions/${setupSession.id}`;
    expect(expectOk(await client.get(path))).toMatchObject({ id: setupSession.id, name });

    let updated = expectOk(
      await client.patch(path, {
        name: 'Renamed setup',
        description: 'Updated',
        metadata: { team: 'renamed' }
      })
    );
    expect(updated).toMatchObject({
      name: 'Renamed setup',
      description: 'Updated',
      metadata: { team: 'renamed' }
    });

    let paged = await listAll(client, '/provider-setup-sessions', { limit: 1 });
    let pagedIds = ids(paged);
    expect(new Set(pagedIds).size).toBe(pagedIds.length);
    expect(pagedIds).toEqual(
      expect.arrayContaining([setupSession.id, withProvider.id, dashboardSession.id])
    );

    let byProvider = await listAll(client, '/provider-setup-sessions', {
      query: { provider_id: remote.providerId }
    });
    expect(ids(byProvider)).toEqual([withProvider.id]);

    let byId = await listAll(client, '/provider-setup-sessions', {
      query: { id: setupSession.id }
    });
    expect(ids(byId)).toEqual([setupSession.id]);
  });

  it.fails(
    'archives a setup session on delete (bug: the delete handler only presents the session)',
    async () => {
      let setupSession = await createSetupSession();
      let path = `/provider-setup-sessions/${setupSession.id}`;
      expectOk(await org.clients.instance.delete(path));

      let after = await org.clients.instance.get(path);
      expect(
        after.status === 404 || ['archived', 'deleted'].includes(after.body?.status)
      ).toBe(true);
    }
  );

  it('validates auth bodies and rejects unknown references', async () => {
    let client = org.clients.instance;

    for (let body of [
      { value: { token: 'x' } },
      { provider_auth_method_id: 42, value: {} },
      { provider_auth_method_id: 'pam_unknown' },
      { provider_auth_method_id: 'pam_unknown', value: 'token' },
      { provider_auth_method_id: 'pam_unknown', value: {}, metadata: 'tags' }
    ]) {
      expectError(await client.post('/provider-auth-configs', body), 400, 'invalid_data');
    }
    expectError(
      await client.post('/provider-auth-configs', {
        provider_auth_method_id: 'pam_unknown',
        value: { token: 'x' }
      }),
      404,
      'not_found'
    );

    let credentials = { client_id: 'client', client_secret: 'secret', scopes: ['read'] };
    for (let body of [
      { config: credentials },
      { provider_id: remote.providerId },
      { provider_id: remote.providerId, config: { ...credentials, client_secret: undefined } },
      { provider_id: remote.providerId, config: { ...credentials, scopes: 'read' } },
      { provider_id: remote.providerId, config: { ...credentials, type: 'api_key' } }
    ]) {
      expectError(await client.post('/provider-auth-credentials', body), 400, 'invalid_data');
    }
    expectError(
      await client.post('/provider-auth-credentials', {
        provider_id: 'pro_unknown',
        config: credentials
      }),
      404,
      'not_found'
    );
    expectError(
      await client.post('/provider-auth-credentials', {
        provider_id: remote.providerId,
        config: credentials
      }),
      400
    );

    for (let body of [
      { type: 'magic' },
      { provider_id: 42 },
      { metadata: 'tags' },
      { configuration: { ui: { layout: 'grid' } } },
      { configuration: { tool_filters: { enabled: 'yes' } } },
      { configuration: { provider_search: { groups: [{ id: 'grp' }] } } }
    ]) {
      expectError(await client.post('/provider-setup-sessions', body), 400, 'invalid_data');
    }
    for (let body of [
      { provider_id: 'pro_unknown' },
      { provider_deployment_id: 'pdp_unknown' },
      { provider_auth_credentials_id: 'pac_unknown' },
      { identity_id: 'idn_unknown' }
    ]) {
      expectError(await client.post('/provider-setup-sessions', body), 404, 'not_found');
    }
    let setupSession = await createSetupSession();
    expectError(
      await client.patch(`/provider-setup-sessions/${setupSession.id}`, { name: 42 }),
      400,
      'invalid_data'
    );

    for (let body of [{ provider_auth_config_id: 'pauc_unknown' }, { note: 'Export' }]) {
      expectError(
        await client.post('/provider-auth-config-exports', body),
        400,
        'invalid_data'
      );
    }
    for (let body of [
      { note: 'Import' },
      { value: { token: 'x' } },
      { note: 'Import', value: 'token' }
    ]) {
      expectError(
        await client.post('/provider-auth-config-imports', body),
        400,
        'invalid_data'
      );
    }

    for (let path of [
      '/provider-auth-configs/pauc_unknown',
      '/provider-auth-credentials/pac_unknown',
      '/provider-setup-sessions/pas_unknown',
      '/provider-auth-config-exports/paex_unknown',
      '/provider-auth-config-imports/paim_unknown'
    ]) {
      expectError(await client.get(path), 404, 'not_found');
    }

    expectError(
      await client.get('/provider-auth-configs', { query: { status: 'deleted' } }),
      400,
      'invalid_data'
    );
  });

  it('hides setup sessions and providers of other organizations', async () => {
    let other = otherOrg.clients.instance;
    let setupSession = await createSetupSession({ metadata: { owner: 'org' } });
    let path = `/provider-setup-sessions/${setupSession.id}`;

    expectError(await other.get(path), 404, 'not_found');
    expectError(await other.patch(path, { name: 'Taken over' }), 404, 'not_found');
    expectError(await other.delete(path), 404, 'not_found');
    expectError(await other.get(`/instances/${org.ids.instanceId}${path}`), 404, 'not_found');

    let otherSessions = await listAll(other, '/provider-setup-sessions');
    expect(ids(otherSessions)).not.toContain(setupSession.id);

    expectError(
      await org.clients.instance.post('/provider-setup-sessions', {
        provider_id: foreign.providerId
      }),
      404,
      'not_found'
    );
    let foreignDeployment = expectOk(
      await other.post('/provider-deployments', { provider_id: foreign.providerId })
    );
    expectError(
      await org.clients.instance.post('/provider-setup-sessions', {
        provider_deployment_id: foreignDeployment.id
      }),
      404,
      'not_found'
    );
    expectError(
      await org.clients.instance.post('/provider-auth-credentials', {
        provider_id: foreign.providerId,
        config: { client_id: 'client', client_secret: 'secret', scopes: [] }
      }),
      404,
      'not_found'
    );
    for (let listPath of listPaths) {
      let listed = await listAll(org.clients.instance, listPath, {
        query: { provider_id: foreign.providerId }
      });
      expect(listed).toEqual([]);
    }

    expect(expectOk(await org.clients.instance.get(path))).toMatchObject({
      id: setupSession.id,
      metadata: { owner: 'org' }
    });
  });
});
