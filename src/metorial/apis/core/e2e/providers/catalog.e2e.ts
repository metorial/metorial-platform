import {
  createRemoteProvider,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  useMcpTestServer,
  useOrganization,
  type RemoteProvider
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createPublishableClient,
  discoverTools,
  ids,
  instanceRoute,
  ownInstanceStatuses,
  ownResourceStatuses,
  tenantClients,
  withoutJsonSchemas
} from './_shared';

describe('api-core providers: catalog', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let remote: RemoteProvider;
  let version: any;
  let tools: any[];

  beforeAll(async () => {
    remote = await createRemoteProvider(org.clients.instance, { url: server.url });
    ({ version, tools } = await discoverTools(org, remote.providerId));
  }, 180_000);

  let toolNamed = (name: string) => tools.find(tool => tool.name === name);

  it('authenticates catalog routes per credential', async () => {
    let route = instanceRoute(org.ids.instanceId);
    let clients = tenantClients(org, otherOrg);
    let echo = toolNamed('echo');

    let listPaths = [
      '/providers',
      `/provider-versions?provider_id=${remote.providerId}`,
      `/provider-specifications?provider_id=${remote.providerId}`,
      '/provider-listings'
    ];
    let resourcePaths = [
      `/providers/${remote.providerId}`,
      `/provider-versions/${version.id}`,
      `/provider-specifications/${version.specification_id}`,
      `/provider-tools?provider_version_id=${version.id}`,
      `/provider-tools/${echo.id}`,
      `/provider-auth-methods?provider_version_id=${version.id}`
    ];

    for (let path of listPaths) {
      await expectAuthMatrix(
        clients,
        (client, name) => client.get(route(name, path)),
        ownInstanceStatuses
      );
    }
    for (let path of resourcePaths) {
      await expectAuthMatrix(
        clients,
        (client, name) => client.get(route(name, path)),
        ownResourceStatuses
      );
    }
  });

  it('limits publishable keys to the catalog read scopes', async () => {
    let publishable = await createPublishableClient(org);

    expect(expectOk(await publishable.get(`/providers/${remote.providerId}`)).id).toBe(
      remote.providerId
    );
    expect(
      expectOk(
        await publishable.get('/provider-tools', {
          query: { provider_version_id: version.id }
        })
      ).items.length
    ).toBe(tools.length);

    for (let path of [
      `/provider-versions/${version.id}`,
      '/provider-deployments',
      '/provider-configs',
      '/provider-auth-configs',
      '/custom-providers'
    ]) {
      expectError(await publishable.get(path), 403, 'forbidden');
    }
    expectError(
      await publishable.post('/provider-deployments', { provider_id: remote.providerId }),
      403,
      'forbidden'
    );
  });

  it('presents a provider with its current version and specification', async () => {
    let provider = expectOk(await org.clients.instance.get(`/providers/${remote.providerId}`));
    expectPresented(withoutJsonSchemas(provider), 'provider');
    expect(provider).toMatchObject({
      id: remote.providerId,
      access: 'tenant',
      status: 'active',
      current_version: { id: version.id, provider_id: remote.providerId, is_current: true }
    });

    let fetchedVersion = expectOk(
      await org.clients.instance.get(`/provider-versions/${version.id}`)
    );
    expectPresented(fetchedVersion, 'provider.version');
    expect(fetchedVersion).toMatchObject({
      id: version.id,
      provider_id: remote.providerId,
      specification_id: version.specification_id
    });

    let specification = expectOk(
      await org.clients.instance.get(`/provider-specifications/${version.specification_id}`)
    );
    expectPresented(withoutJsonSchemas(specification), 'provider.specification');
    expect(specification.id).toBe(version.specification_id);
    expect(specification.tools.map((tool: any) => tool.name)).toEqual(
      expect.arrayContaining(['echo', 'add'])
    );
    expect(specification.auth_methods).toEqual([]);

    let authMethods = await listAll(org.clients.instance, '/provider-auth-methods', {
      query: { provider_version_id: version.id }
    });
    expect(authMethods).toEqual([]);
  });

  it('presents the tools of a provider version', async () => {
    let echo = toolNamed('echo');
    let add = toolNamed('add');

    for (let tool of tools) expectPresented(withoutJsonSchemas(tool), 'provider.tool');
    expect(echo).toMatchObject({
      key: 'tool_echo',
      description: 'Returns the given text',
      specification_id: version.specification_id
    });
    expect(echo.input_schema).toMatchObject({
      type: 'json_schema',
      schema: { properties: { text: { type: 'string' } } }
    });
    expect(add.input_schema.schema.required).toEqual(['a', 'b']);

    let fetched = expectOk(await org.clients.instance.get(`/provider-tools/${echo.id}`));
    expect(fetched).toMatchObject({ id: echo.id, name: 'echo', key: 'tool_echo' });

    let legacy = expectOk(await org.clients.instance.get(`/providers-tools/${echo.id}`));
    expect(legacy.id).toBe(echo.id);
  });

  it('filters and pages catalog lists', async () => {
    let paged = await listAll(org.clients.instance, '/provider-tools', {
      query: { provider_version_id: version.id },
      limit: 1
    });
    expect(ids(paged).sort()).toEqual(ids(tools).sort());

    let providers = await listAll(org.clients.instance, '/providers', {
      query: { id: remote.providerId }
    });
    expect(ids(providers)).toEqual([remote.providerId]);

    let versions = await listAll(org.clients.instance, '/provider-versions', {
      query: { provider_id: remote.providerId }
    });
    expect(ids(versions)).toContain(version.id);
    expect(versions.every((item: any) => item.provider_id === remote.providerId)).toBe(true);

    let byVersion = await listAll(org.clients.instance, '/provider-specifications', {
      query: { provider_version_id: version.id }
    });
    expect(ids(byVersion)).toContain(version.specification_id);
  });

  it('validates catalog queries', async () => {
    let client = org.clients.instance;

    for (let [path, query] of [
      ['/provider-tools', {}],
      ['/provider-auth-methods', {}],
      ['/providers', { limit: 0 }],
      ['/providers', { auth_setup: 'maybe' }],
      ['/provider-specifications', { limit: 'many' }]
    ] as const) {
      expectError(await client.get(path, { query }), 400, 'invalid_data');
    }

    expectError(
      await client.get('/provider-tools', { query: { provider_version_id: 'prv_unknown' } }),
      404,
      'not_found'
    );
    expectError(await client.get('/providers/pro_unknown'), 404, 'not_found');
  });

  it('hides the providers of other organizations', async () => {
    let other = otherOrg.clients.instance;
    let echo = toolNamed('echo');

    for (let path of [
      `/providers/${remote.providerId}`,
      `/provider-versions/${version.id}`,
      `/provider-specifications/${version.specification_id}`,
      `/provider-tools/${echo.id}`
    ]) {
      expectError(await other.get(path), 404, 'not_found');
    }
    for (let path of ['/provider-tools', '/provider-auth-methods']) {
      expectError(
        await other.get(path, { query: { provider_version_id: version.id } }),
        404,
        'not_found'
      );
    }

    let providers = await listAll(other, '/providers', { query: { id: remote.providerId } });
    expect(providers).toEqual([]);
    let versions = await listAll(other, '/provider-versions', {
      query: { provider_id: remote.providerId }
    });
    expect(versions).toEqual([]);
  });

  it.fails(
    "rejects instance keys on another instance's path (bug: instanceGroup ignores :instanceId for instance-restricted keys)",
    async () => {
      let response = await org.clients.instance.get(
        `/instances/${otherOrg.ids.instanceId}/providers/${remote.providerId}`
      );
      expectError(response, 404, 'not_found');
    }
  );
});
