import {
  connectSession,
  createRemoteProvider,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  findTool,
  listAll,
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
  waitForSpecification,
  withoutJsonSchemas
} from './_shared';

let apiKeyHeader = (secret: string) => ({ headers: { 'x-api-key': secret } });

describe('api-core providers: deployments, configs and config vaults', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let configuredProviderId: string;
  let configuredVersion: any;
  let plain: RemoteProvider;
  let plainVersion: any;
  let foreign: RemoteProvider;

  beforeAll(async () => {
    ({ providerId: configuredProviderId } = await createRemoteProvider(org.clients.instance, {
      url: server.url,
      name: uniqueId('e2e-configured')
    }));
    ({ version: configuredVersion } = await waitForSpecification(
      org.clients.instance,
      configuredProviderId
    ));

    plain = await createRemoteProvider(org.clients.instance, { url: server.url });
    ({ version: plainVersion } = await waitForSpecification(
      org.clients.instance,
      plain.providerId
    ));

    foreign = await createRemoteProvider(otherOrg.clients.instance, { url: server.url });
    await waitForSpecification(otherOrg.clients.instance, foreign.providerId);
  }, 240_000);

  let createDeployment = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/provider-deployments', {
        provider_id: plain.providerId,
        name: uniqueId('e2e-deployment'),
        ...body
      })
    );

  let createConfig = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/provider-configs', {
        provider_id: plain.providerId,
        name: uniqueId('e2e-config'),
        value: {},
        ...body
      })
    );

  let createVault = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/provider-config-vaults', {
        provider_id: plain.providerId,
        name: uniqueId('e2e-vault'),
        value: {},
        ...body
      })
    );

  let expectNoSecret = (body: unknown, secret: string) =>
    expect(JSON.stringify(body)).not.toContain(secret);

  it('authenticates deployment and config routes per credential', async () => {
    let route = instanceRoute(org.ids.instanceId);
    let clients = tenantClients(org, otherOrg);
    let deployment = await createDeployment();
    let config = await createConfig();
    let vault = await createVault();

    for (let [path, id] of [
      ['/provider-deployments', deployment.id],
      ['/provider-configs', config.id],
      ['/provider-config-vaults', vault.id]
    ]) {
      let lists = await expectAuthMatrix(
        clients,
        (client, name) => client.get(route(name, path)),
        { ...ownInstanceStatuses, otherInstance: 200 }
      );
      for (let name of ['session', 'management', 'instance'] as const) {
        expect(ids(lists[name].body.items)).toContain(id);
      }
      expect(ids(lists.otherInstance.body.items)).not.toContain(id);

      await expectAuthMatrix(
        clients,
        (client, name) => client.get(route(name, `${path}/${id}`)),
        ownResourceStatuses
      );
    }

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(route(name, `/provider-config-schema?provider_id=${plain.providerId}`)),
      ownResourceStatuses
    );

    let created = await expectAuthMatrix(
      clients,
      (client, name) =>
        client.post(route(name, '/provider-deployments'), { provider_id: plain.providerId }),
      ownResourceStatuses
    );
    expect(created.session.body.provider_id).toBe(plain.providerId);
    expect(created.management.body.provider_id).toBe(plain.providerId);
  });

  it('creates, updates and deletes a provider deployment', async () => {
    let name = uniqueId('e2e-deployment');
    let deployment = await createDeployment({
      name,
      description: 'Deployment over REST',
      metadata: { team: 'e2e' },
      tool_filters: { type: 'tool_keys', keys: ['tool_echo'] }
    });
    expectPresented(deployment, 'provider.deployment');
    expect(deployment).toMatchObject({
      status: 'active',
      is_default: false,
      name,
      description: 'Deployment over REST',
      metadata: { team: 'e2e' },
      provider_id: plain.providerId,
      locked_version: null,
      default_config: null,
      tool_filter: {
        type: 'filter',
        filters: [{ type: 'tool_keys', keys: ['tool_echo'] }]
      }
    });

    let path = `/provider-deployments/${deployment.id}`;
    let updated = expectOk(
      await org.clients.instance.patch(path, {
        name: 'Renamed deployment',
        metadata: { team: 'renamed' },
        tool_filters: null
      })
    );
    expect(updated).toMatchObject({
      name: 'Renamed deployment',
      description: 'Deployment over REST',
      metadata: { team: 'renamed' },
      tool_filter: { type: 'allow_all' }
    });

    let locked = expectOk(
      await org.clients.instance.patch(path, { locked_provider_version_id: plainVersion.id })
    );
    expect(locked.locked_version).toMatchObject({
      object: 'provider.version',
      id: plainVersion.id
    });
    expect(expectOk(await org.clients.instance.get(path)).locked_version.id).toBe(
      plainVersion.id
    );

    let error = expectError(
      await org.clients.instance.patch(path, {
        locked_provider_version_id: configuredVersion.id
      }),
      400,
      'bad_request'
    );
    expect(error.message).toContain('does not belong');

    let unlocked = expectOk(
      await org.clients.instance.patch(path, { locked_provider_version_id: null })
    );
    expect(unlocked.locked_version).toBeNull();

    let deleted = expectOk(await org.clients.instance.delete(path));
    expect(deleted).toMatchObject({ id: deployment.id, status: 'archived' });

    let active = await listAll(org.clients.instance, '/provider-deployments', {
      query: { provider_id: plain.providerId, status: 'active' }
    });
    expect(ids(active)).not.toContain(deployment.id);
    let archived = await listAll(org.clients.instance, '/provider-deployments', {
      query: { provider_id: plain.providerId, status: 'archived' }
    });
    expect(ids(archived)).toContain(deployment.id);
  });

  it('creates deployments from inline, vault and referenced configs without echoing values', async () => {
    let inlineSecret = uniqueId('sk-inline');
    let inline = await createDeployment({
      provider_id: configuredProviderId,
      provider_config: { value: apiKeyHeader(inlineSecret) }
    });
    expectPresented(inline, 'provider.deployment');
    expect(inline.default_config).toMatchObject({ object: 'provider.config#preview' });
    expectNoSecret(inline, inlineSecret);

    let vaultSecret = uniqueId('sk-vault');
    let vault = await createVault({
      provider_id: configuredProviderId,
      description: 'Vault over REST',
      value: apiKeyHeader(vaultSecret)
    });
    expectPresented(vault, 'provider.config_vault');
    expect(vault).toMatchObject({
      status: 'active',
      provider_id: configuredProviderId,
      description: 'Vault over REST',
      deployment: null
    });
    expectNoSecret(vault, vaultSecret);
    expectNoSecret(
      expectOk(await org.clients.instance.get(`/provider-config-vaults/${vault.id}`)),
      vaultSecret
    );

    let fromVault = await createDeployment({
      provider_id: configuredProviderId,
      provider_config: { provider_config_vault_id: vault.id }
    });
    expectNoSecret(fromVault, vaultSecret);

    let configSecret = uniqueId('sk-config');
    let config = await createConfig({
      provider_id: configuredProviderId,
      value: apiKeyHeader(configSecret)
    });
    expectPresented(config, 'provider.config');
    expect(config).toMatchObject({
      status: 'active',
      provider_id: configuredProviderId,
      specification_id: expect.any(String),
      deployment: null,
      from_vault: null
    });
    expect(config).not.toHaveProperty('public_mcp_server_id');
    expectNoSecret(config, configSecret);

    let dashboardConfig = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}/provider-configs/${config.id}`
      )
    );
    expectPresented(dashboardConfig, 'provider.config');
    expect(dashboardConfig).toHaveProperty('public_mcp_server_id', null);
    expectNoSecret(dashboardConfig, configSecret);

    let referencing = await createDeployment({
      provider_id: configuredProviderId,
      provider_config_id: config.id
    });
    expect(referencing.default_config?.id).toBe(config.id);

    let vaultConfig = await createConfig({
      provider_id: configuredProviderId,
      value: undefined,
      provider_config_vault_id: vault.id
    });
    expect(vaultConfig.from_vault).toMatchObject({ id: vault.id });
    expectNoSecret(vaultConfig, vaultSecret);

    let configs = await listAll(org.clients.instance, '/provider-configs', {
      query: { provider_id: configuredProviderId }
    });
    expect(ids(configs)).toEqual(expect.arrayContaining([config.id, vaultConfig.id]));

    let everything = JSON.stringify([
      configs,
      await listAll(org.clients.instance, '/provider-config-vaults'),
      await listAll(org.clients.instance, '/provider-deployments')
    ]);
    for (let secret of [inlineSecret, vaultSecret, configSecret]) {
      expect(everything).not.toContain(secret);
    }
  });

  it('uses a vault as the default config of a new deployment', async () => {
    let vault = await createVault({ value: apiKeyHeader(uniqueId('sk-default')) });
    let deployment = await createDeployment({
      provider_config: { provider_config_vault_id: vault.id }
    });

    expect(deployment.default_config).toMatchObject({ object: 'provider.config#preview' });
  });

  it('filters configs by config vault', async () => {
    let vault = await createVault();
    let fromVault = await createConfig({
      value: undefined,
      provider_config_vault_id: vault.id
    });
    let inline = await createConfig();

    let byVault = await listAll(org.clients.instance, '/provider-configs', {
      query: { provider_config_vault_id: vault.id }
    });
    expect(ids(byVault)).toContain(fromVault.id);
    expect(ids(byVault)).not.toContain(inline.id);
  });

  it('forwards the deployment config to the MCP server', async () => {
    let secret = uniqueId('sk-forwarded');
    let deployment = await createDeployment({
      provider_id: configuredProviderId,
      provider_config: { value: apiKeyHeader(secret) }
    });

    let session = expectOk(
      await org.clients.instance.post('/sessions', {
        providers: [{ provider_deployment_id: deployment.id }]
      })
    );
    expectNoSecret(session, secret);

    let client = connectSession(session.id, org.keys.instanceSecret);
    expect((await client.initialize()).status).toBe(200);
    let tools = await client.listTools();
    let echo = findTool(tools.result.tools, 'echo');
    let call = await client.request('tools/call', {
      name: echo.name,
      arguments: { text: 'configured' }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: 'configured' }]);

    expect(server.requests.some(request => request.headers['x-api-key'] === secret)).toBe(
      true
    );
  }, 120_000);

  it('serves the config schema of a provider', async () => {
    let client = org.clients.instance;
    let config = await createConfig({
      provider_id: configuredProviderId,
      value: apiKeyHeader(uniqueId('sk-schema'))
    });
    let deployment = await createDeployment({ provider_id: configuredProviderId });

    for (let query of [
      { provider_id: configuredProviderId },
      { provider_version_id: configuredVersion.id },
      { provider_config_id: config.id },
      { provider_deployment_id: deployment.id }
    ]) {
      let schema = expectOk(await client.get('/provider-config-schema', { query }));
      expectPresented(withoutJsonSchemas(schema), 'provider.capabilities.config.schema');
      expect(schema).toMatchObject({ provider_id: configuredProviderId });
      expect(JSON.stringify(schema)).toContain('"headers"');
    }

    expectError(await client.get('/provider-config-schema'), 400, 'bad_request');
  });

  it('updates and deletes configs and config vaults', async () => {
    let client = org.clients.instance;

    let config = await createConfig({ description: 'Config over REST' });
    let configPath = `/provider-configs/${config.id}`;
    let updatedConfig = expectOk(
      await client.patch(configPath, {
        name: 'Renamed config',
        metadata: { team: 'renamed' },
        tool_filters: [{ type: 'tool_regex', pattern: '^tool_' }]
      })
    );
    expect(updatedConfig).toMatchObject({
      name: 'Renamed config',
      description: 'Config over REST',
      metadata: { team: 'renamed' },
      tool_filter: { type: 'filter', filters: [{ type: 'tool_regex', pattern: '^tool_' }] }
    });
    let deletedConfig = expectOk(await client.delete(configPath));
    expect(deletedConfig).toMatchObject({ id: config.id, status: 'archived' });
    let activeConfigs = await listAll(client, '/provider-configs', {
      query: { provider_id: plain.providerId, status: 'active' }
    });
    expect(ids(activeConfigs)).not.toContain(config.id);

    let vault = await createVault();
    let vaultPath = `/provider-config-vaults/${vault.id}`;
    let updatedVault = expectOk(
      await client.patch(vaultPath, { name: 'Renamed vault', description: 'Updated' })
    );
    expect(updatedVault).toMatchObject({ name: 'Renamed vault', description: 'Updated' });
    let deletedVault = expectOk(await client.delete(vaultPath));
    expect(deletedVault).toMatchObject({ id: vault.id, status: 'archived' });
    let activeVaults = await listAll(client, '/provider-config-vaults', {
      query: { provider_id: plain.providerId, status: 'active' }
    });
    expect(ids(activeVaults)).not.toContain(vault.id);
  });

  it('validates deployment, config and vault bodies', async () => {
    let client = org.clients.instance;
    let providerId = plain.providerId;

    for (let body of [
      {},
      { provider_id: 42 },
      { provider_id: providerId, provider_config: { name: 'Neither value nor vault' } },
      { provider_id: providerId, provider_config: { value: 'not-an-object' } },
      { provider_id: providerId, provider_config: { provider_config_vault_id: 42 } },
      { provider_id: providerId, provider_config_id: 42 },
      { provider_id: providerId, locked_provider_version_id: 42 },
      { provider_id: providerId, tool_filters: { type: 'tool_names', keys: ['echo'] } },
      { provider_id: providerId, metadata: 'tags' }
    ]) {
      expectError(await client.post('/provider-deployments', body), 400, 'invalid_data');
    }

    let deployment = await createDeployment();
    for (let body of [
      { locked_provider_version_id: 42 },
      { name: 42 },
      { tool_filters: 'everything' }
    ]) {
      expectError(
        await client.patch(`/provider-deployments/${deployment.id}`, body),
        400,
        'invalid_data'
      );
    }

    for (let body of [
      { provider_id: providerId },
      { value: {} },
      { provider_id: providerId, value: 'not-an-object' },
      { provider_id: providerId, provider_config_vault_id: 42 }
    ]) {
      expectError(await client.post('/provider-configs', body), 400, 'invalid_data');
    }

    for (let body of [
      { provider_id: providerId, value: {} },
      { name: 'Vault', value: {} },
      { provider_id: providerId, name: 'Vault', value: 'not-an-object' },
      { provider_id: providerId, name: 'Vault' }
    ]) {
      expectError(await client.post('/provider-config-vaults', body), 400, 'invalid_data');
    }

    let config = await createConfig();
    expectError(
      await client.patch(`/provider-configs/${config.id}`, { metadata: 'tags' }),
      400,
      'invalid_data'
    );
    let vault = await createVault();
    expectError(
      await client.patch(`/provider-config-vaults/${vault.id}`, { name: 42 }),
      400,
      'invalid_data'
    );

    for (let body of [
      { provider_id: 'pro_unknown' },
      { provider_id: providerId, provider_config_id: 'pcf_unknown' },
      {
        provider_id: providerId,
        provider_config: { provider_config_vault_id: 'pcvt_unknown' }
      },
      { provider_id: providerId, locked_provider_version_id: 'prv_unknown' }
    ]) {
      expectError(await client.post('/provider-deployments', body), 404, 'not_found');
    }
  });

  it('pages and filters deployments, configs and vaults', async () => {
    let client = org.clients.instance;
    let deployments = [
      await createDeployment(),
      await createDeployment(),
      await createDeployment()
    ];
    let configs = [
      await createConfig({ provider_deployment_id: deployments[0].id }),
      await createConfig()
    ];
    let vaults = [await createVault(), await createVault()];

    for (let [path, created] of [
      ['/provider-deployments', deployments],
      ['/provider-configs', configs],
      ['/provider-config-vaults', vaults]
    ] as const) {
      let paged = await listAll(client, path, {
        query: { provider_id: plain.providerId },
        limit: 1
      });
      let pagedIds = ids(paged);
      expect(new Set(pagedIds).size).toBe(pagedIds.length);
      expect(pagedIds).toEqual(expect.arrayContaining(ids(created)));
      expect(paged.every((item: any) => item.provider_id === plain.providerId)).toBe(true);

      let byId = await listAll(client, path, { query: { id: created[0].id } });
      expect(ids(byId)).toEqual([created[0].id]);

      expectError(
        await client.get(path, { query: { status: 'deleted' } }),
        400,
        'invalid_data'
      );
    }

    let byDeployment = await listAll(client, '/provider-configs', {
      query: { provider_deployment_id: deployments[0].id }
    });
    expect(ids(byDeployment)).toContain(configs[0].id);
    expect(ids(byDeployment)).not.toContain(configs[1].id);
    expect(configs[0].deployment).toMatchObject({
      object: 'provider.deployment#preview',
      id: deployments[0].id
    });
  });

  it('hides deployments, configs and vaults of other organizations', async () => {
    let other = otherOrg.clients.instance;
    let deployment = await createDeployment();
    let config = await createConfig();
    let vault = await createVault();

    for (let path of [
      `/provider-deployments/${deployment.id}`,
      `/provider-configs/${config.id}`,
      `/provider-config-vaults/${vault.id}`
    ]) {
      expectError(await other.get(path), 404, 'not_found');
      expectError(await other.patch(path, { name: 'Taken over' }), 404, 'not_found');
      expectError(await other.delete(path), 404, 'not_found');
    }

    let foreignProviderId = foreign.providerId;
    for (let body of [
      { provider_id: plain.providerId },
      { provider_id: foreignProviderId, provider_config_id: config.id },
      {
        provider_id: foreignProviderId,
        provider_config: { provider_config_vault_id: vault.id }
      },
      { provider_id: foreignProviderId, locked_provider_version_id: plainVersion.id }
    ]) {
      expectError(await other.post('/provider-deployments', body), 404, 'not_found');
    }
    for (let body of [
      { provider_id: foreignProviderId, provider_deployment_id: deployment.id, value: {} },
      { provider_id: foreignProviderId, provider_config_vault_id: vault.id }
    ]) {
      expectError(await other.post('/provider-configs', body), 404, 'not_found');
    }
    expectError(
      await other.post('/provider-config-vaults', {
        provider_id: foreignProviderId,
        provider_deployment_id: deployment.id,
        name: 'Vault',
        value: {}
      }),
      404,
      'not_found'
    );

    let foreignDeployment = expectOk(
      await other.post('/provider-deployments', { provider_id: foreignProviderId })
    );
    expectError(
      await other.patch(`/provider-deployments/${foreignDeployment.id}`, {
        locked_provider_version_id: plainVersion.id
      }),
      404,
      'not_found'
    );
    expectError(
      await other.get('/provider-config-schema', {
        query: { provider_deployment_id: deployment.id }
      }),
      404,
      'not_found'
    );

    for (let path of [
      '/provider-deployments',
      '/provider-configs',
      '/provider-config-vaults'
    ]) {
      let listed = ids(await listAll(other, path));
      for (let id of [deployment.id, config.id, vault.id]) {
        expect(listed).not.toContain(id);
      }
    }

    expect(
      expectOk(await org.clients.instance.get(`/provider-deployments/${deployment.id}`))
    ).toMatchObject({ status: 'active', name: deployment.name });
  });
});
