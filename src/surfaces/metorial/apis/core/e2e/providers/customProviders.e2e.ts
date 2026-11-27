import {
  createRemoteProvider,
  eventually,
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
  ids,
  instanceRoute,
  ownInstanceStatuses,
  ownResourceStatuses,
  tenantClients,
  waitForCustomProviderDeployment,
  withoutJsonSchemas
} from './_shared';

describe('api-core providers: custom providers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let remote: RemoteProvider;

  beforeAll(async () => {
    remote = await createRemoteProvider(org.clients.instance, {
      url: server.url,
      name: uniqueId('e2e-custom')
    });
  });

  let remoteFrom = () => ({
    type: 'remote',
    remote_url: server.url,
    protocol: 'streamable_http'
  });

  let createCustomProvider = async (body: Record<string, unknown> = {}) => {
    let created = expectOk(
      await org.clients.instance.post('/custom-providers', {
        name: uniqueId('e2e-custom'),
        from: remoteFrom(),
        ...body
      })
    );
    await waitForCustomProviderDeployment(org.clients.instance, created.id);
    return created;
  };

  it('authenticates custom provider routes per credential', async () => {
    let route = instanceRoute(org.ids.instanceId);
    let clients = tenantClients(org, otherOrg);
    let id = remote.customProvider.id;

    let lists = await expectAuthMatrix(
      clients,
      (client, name) => client.get(route(name, '/custom-providers')),
      { ...ownInstanceStatuses, otherInstance: 200 }
    );
    for (let name of ['session', 'management', 'instance'] as const) {
      expect(ids(lists[name].body.items)).toContain(id);
    }
    expect(ids(lists.otherInstance.body.items)).not.toContain(id);

    for (let path of [
      `/custom-providers/${id}`,
      `/custom-providers/${id}/env`,
      `/custom-provider-versions?custom_provider_id=${id}`,
      `/custom-provider-deployments/${remote.deployment.id}`,
      `/custom-provider-environments?custom_provider_id=${id}`
    ]) {
      let isList = path.includes('?');
      await expectAuthMatrix(
        clients,
        (client, name) => client.get(route(name, path)),
        isList ? ownInstanceStatuses : ownResourceStatuses
      );
    }

    await expectAuthMatrix(
      clients,
      (client, name) => client.patch(route(name, `/custom-providers/${id}`), {}),
      { none: 401, otherSession: 404, otherManagement: 404, otherInstance: 404 }
    );
  });

  it('presents remote custom providers per api version', async () => {
    let id = remote.customProvider.id;

    let fetched = expectOk(await org.clients.instance.get(`/custom-providers/${id}`));
    expectPresented(withoutJsonSchemas(fetched), 'custom_provider');
    expect(fetched).toMatchObject({
      id,
      status: 'active',
      type: 'remote',
      provider: { object: 'provider', id: remote.providerId, access: 'tenant' }
    });
    expect(fetched.draft.remote_mcp_server).toMatchObject({
      url: server.url,
      transport: 'streamable_http'
    });
    expect(fetched).not.toHaveProperty('draft_bucket');

    let dashboard = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}/custom-providers/${id}`
      )
    );
    expectPresented(withoutJsonSchemas(dashboard), 'custom_provider');
    expect(dashboard.id).toBe(id);
    expect(dashboard).toHaveProperty('draft_bucket');

    let env = expectOk(await org.clients.instance.get(`/custom-providers/${id}/env`));
    expectPresented(env, 'custom_provider.env');
    expect(env.env).toBeNull();
  });

  it('creates, updates and archives a custom provider', async () => {
    let name = uniqueId('e2e-lifecycle');
    let created = await createCustomProvider({
      name,
      description: 'Created over REST',
      metadata: { team: 'e2e' }
    });
    expectPresented(withoutJsonSchemas(created), 'custom_provider');
    expect(created).toMatchObject({
      name,
      description: 'Created over REST',
      metadata: { team: 'e2e' },
      status: 'active',
      type: 'remote'
    });

    let renamed = uniqueId('e2e-renamed');
    let updated = expectOk(
      await org.clients.instance.patch(`/custom-providers/${created.id}`, {
        name: renamed,
        metadata: { team: 'renamed' },
        readme: '# Readme'
      })
    );
    expect(updated).toMatchObject({
      id: created.id,
      name: renamed,
      description: 'Created over REST',
      metadata: { team: 'renamed' }
    });
    expect(
      expectOk(await org.clients.instance.get(`/custom-providers/${created.id}`)).name
    ).toBe(renamed);

    let archived = expectOk(
      await org.clients.instance.post(`/custom-providers/${created.id}/archive`)
    );
    expect(archived).toMatchObject({ id: created.id, status: 'archived' });

    let active = await listAll(org.clients.instance, '/custom-providers', {
      query: { status: 'active' }
    });
    expect(ids(active)).not.toContain(created.id);
    expect(ids(active)).toContain(remote.customProvider.id);

    let archivedList = await listAll(org.clients.instance, '/custom-providers', {
      query: { status: 'archived' }
    });
    expect(ids(archivedList)).toContain(created.id);
    expect(ids(archivedList)).not.toContain(remote.customProvider.id);
  });

  it('filters and pages custom providers', async () => {
    let created = [await createCustomProvider(), await createCustomProvider()];

    let paged = await listAll(org.clients.instance, '/custom-providers', { limit: 1 });
    let pagedIds = ids(paged);
    expect(new Set(pagedIds).size).toBe(pagedIds.length);
    expect(pagedIds).toEqual(
      expect.arrayContaining([...ids(created), remote.customProvider.id])
    );

    let byId = await listAll(org.clients.instance, '/custom-providers', {
      query: { id: created[0].id }
    });
    expect(ids(byId)).toEqual([created[0].id]);

    let remotes = await listAll(org.clients.instance, '/custom-providers', {
      query: { type: 'remote' }
    });
    expect(ids(remotes)).toEqual(expect.arrayContaining(ids(created)));

    let functions = await listAll(org.clients.instance, '/custom-providers', {
      query: { type: 'function' }
    });
    expect(ids(functions)).not.toContain(created[0].id);

    let searched = await eventually(
      async () => {
        let found = await listAll(org.clients.instance, '/custom-providers', {
          query: { search: created[1].name }
        });
        if (!ids(found).includes(created[1].id)) throw new Error('Not indexed yet');
        return found;
      },
      { timeoutMs: 30_000, intervalMs: 500 }
    );
    expect(ids(searched)).not.toContain(remote.customProvider.id);

    for (let query of [{ limit: 0 }, { status: 'deleted' }, { type: 'docker' }]) {
      expectError(
        await org.clients.instance.get('/custom-providers', { query }),
        400,
        'invalid_data'
      );
    }
  });

  it('validates custom provider bodies', async () => {
    let name = uniqueId('e2e-invalid');
    let invalidCreates: Record<string, unknown>[] = [
      {},
      { from: remoteFrom() },
      { name: 42, from: remoteFrom() },
      { name, from: { type: 'remote', remote_url: server.url } },
      { name, from: { ...remoteFrom(), protocol: 'websocket' } },
      { name, from: { type: 'ftp', url: server.url } },
      {
        name,
        from: {
          type: 'function',
          files: [],
          env: {},
          runtime: { identifier: 'nodejs', version: '18.x' }
        }
      },
      { name, from: remoteFrom(), config: { schema: {} } },
      { name, from: remoteFrom(), metadata: 'tags' }
    ];

    for (let body of invalidCreates) {
      expectError(
        await org.clients.instance.post('/custom-providers', body),
        400,
        'invalid_data'
      );
    }
    expectError(await rest(metorialEndpoints().api).post('/custom-providers', {}), 401);

    let path = `/custom-providers/${remote.customProvider.id}`;
    for (let body of [{ name: 42 }, { metadata: 'tags' }, { readme: ['# Readme'] }]) {
      expectError(await org.clients.instance.patch(path, body), 400, 'invalid_data');
    }

    for (let body of [{}, { custom_provider_id: remote.customProvider.id }]) {
      expectError(
        await org.clients.instance.post('/custom-provider-versions', body),
        400,
        'invalid_data'
      );
    }

    for (let body of [
      { action: { type: 'rollback_commit', environment_id: 'env', version_id: 'ver' } },
      { message: 'Promote', action: { type: 'squash' } },
      { message: 'Promote', action: { type: 'merge_version_into_environment' } }
    ]) {
      expectError(
        await org.clients.instance.post('/custom-provider-commits', body),
        400,
        'invalid_data'
      );
    }
  });

  it('serves the versions, deployments and environments of a custom provider', async () => {
    let id = remote.customProvider.id;
    let client = org.clients.instance;

    let versions = await listAll(client, '/custom-provider-versions', {
      query: { custom_provider_id: id }
    });
    let version = versions.find((item: any) => item.deployment.id === remote.deployment.id);
    expectPresented(withoutJsonSchemas(version), 'custom_provider.version');
    expect(version).toMatchObject({
      custom_provider_id: id,
      provider_id: remote.providerId,
      status: 'deployment_succeeded',
      deployment: { id: remote.deployment.id, status: 'succeeded' }
    });

    let fetchedVersion = expectOk(await client.get(`/custom-provider-versions/${version.id}`));
    expect(fetchedVersion).toMatchObject({ id: version.id, index: version.index });
    let versionEnv = expectOk(await client.get(`/custom-provider-versions/${version.id}/env`));
    expect(versionEnv).toEqual({ object: 'custom_provider.env', env: null });

    let deployments = await listAll(client, '/custom-provider-deployments', {
      query: { custom_provider_id: id }
    });
    expect(ids(deployments)).toContain(remote.deployment.id);
    let deployment = expectOk(
      await client.get(`/custom-provider-deployments/${remote.deployment.id}`)
    );
    expectPresented(deployment, 'custom_provider.deployment');
    expect(deployment).toMatchObject({
      status: 'succeeded',
      custom_provider_id: id,
      provider_id: remote.providerId,
      custom_provider_version_id: version.id
    });

    let logs = expectOk(
      await client.get(`/custom-provider-deployments/${remote.deployment.id}/logs`)
    );
    expectPresented(logs, 'custom_provider.deployment.logs');
    expect(logs.custom_provider_deployment_id).toBe(remote.deployment.id);
    expect(logs.steps.length).toBeGreaterThan(0);

    let failed = await listAll(client, '/custom-provider-deployments', {
      query: { custom_provider_id: id, status: 'failed' }
    });
    expect(failed).toEqual([]);

    let environments = await listAll(client, '/custom-provider-environments', {
      query: { custom_provider_id: id }
    });
    expect(environments.length).toBeGreaterThan(0);
    for (let environment of environments) {
      expectPresented(environment, 'custom_provider.environment');
      expect(environment.custom_provider_id).toBe(id);
    }
    let environment = expectOk(
      await client.get(`/custom-provider-environments/${environments[0].id}`)
    );
    expect(environment.id).toBe(environments[0].id);

    expectError(
      await client.get('/custom-provider-deployments', { query: { status: 'done' } }),
      400,
      'invalid_data'
    );
  });

  it('deploys a new version of a custom provider', async () => {
    let id = remote.customProvider.id;
    let client = org.clients.instance;

    let created = expectOk(
      await client.post('/custom-provider-versions', {
        custom_provider_id: id,
        from: remoteFrom()
      })
    );
    expectPresented(withoutJsonSchemas(created), 'custom_provider.version');
    expect(created.custom_provider_id).toBe(id);

    let deployed = await eventually(
      async () => {
        let version = expectOk(await client.get(`/custom-provider-versions/${created.id}`));
        if (version.deployment.status !== 'succeeded') {
          throw new Error(`Version ${created.id} deployment is ${version.deployment.status}`);
        }
        return version;
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );

    let versions = await listAll(client, '/custom-provider-versions', {
      query: { custom_provider_id: id }
    });
    let first = versions.find((item: any) => item.deployment.id === remote.deployment.id);
    expect(ids(versions)).toContain(created.id);
    expect(deployed.index).toBeGreaterThan(first.index);
  });

  it('hides custom providers of other organizations', async () => {
    let id = remote.customProvider.id;
    let other = otherOrg.clients.instance;
    let versions = await listAll(org.clients.instance, '/custom-provider-versions', {
      query: { custom_provider_id: id }
    });

    for (let path of [
      `/custom-providers/${id}`,
      `/custom-providers/${id}/env`,
      `/custom-provider-versions/${versions[0].id}`,
      `/custom-provider-deployments/${remote.deployment.id}`,
      `/custom-provider-deployments/${remote.deployment.id}/logs`,
      `/instances/${otherOrg.ids.instanceId}/custom-providers/${id}`
    ]) {
      expectError(await other.get(path), 404, 'not_found');
    }
    expectError(
      await otherOrg.clients.rest.get(
        `/dashboard/instances/${otherOrg.ids.instanceId}/custom-providers/${id}`
      ),
      404,
      'not_found'
    );

    expectError(
      await other.patch(`/custom-providers/${id}`, { name: 'Taken over' }),
      404,
      'not_found'
    );
    expectError(await other.post(`/custom-providers/${id}/archive`), 404, 'not_found');
    expectError(
      await other.post('/custom-provider-versions', {
        custom_provider_id: id,
        from: remoteFrom()
      }),
      404,
      'not_found'
    );

    let otherList = await listAll(other, '/custom-providers');
    expect(ids(otherList)).not.toContain(id);
    let otherVersions = await listAll(other, '/custom-provider-versions', {
      query: { custom_provider_id: id }
    });
    expect(otherVersions).toEqual([]);

    let fetched = expectOk(await org.clients.instance.get(`/custom-providers/${id}`));
    expect(fetched).toMatchObject({ status: 'active', name: remote.customProvider.name });
  });
});
