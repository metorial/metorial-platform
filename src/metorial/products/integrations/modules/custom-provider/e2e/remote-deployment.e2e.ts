import {
  connectSession,
  createProviderSession,
  eventually,
  findTool,
  firstPage,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  customProviderDeploymentService,
  customProviderEnvironmentService,
  customProviderService,
  customProviderVersionService
} from '../src';
import {
  createDeployedCustomProvider,
  createRemoteCustomProvider,
  expectVersionDeployed,
  type RemoteProtocol,
  scopeOf
} from './helpers';

describe('module-custom-provider remote deployments', () => {
  let org = useOrganization();
  let server = useMcpTestServer({
    serverName: 'custom-provider-e2e',
    tools: [
      {
        name: 'forecast',
        description: 'Returns the weather forecast for a city',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city']
        },
        handler: args => `Sunny in ${args.city}`
      },
      {
        name: 'multiply',
        description: 'Multiplies two numbers',
        inputSchema: {
          type: 'object',
          properties: { a: { type: 'number' }, b: { type: 'number' } },
          required: ['a', 'b']
        },
        handler: args => String(Number(args.a) * Number(args.b))
      }
    ]
  });

  it('deploys a remote MCP server into a provider, provider version and environment', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { tenant, environment } = await scopeOf(fixture);

    let created = await createRemoteCustomProvider(fixture, { url: server.url });
    expect(created.providerOid).toBeNull();
    expect(
      await subspaceDb.customProvider.findUniqueOrThrow({ where: { oid: created.oid } })
    ).toMatchObject({ maxVersionIndex: 1 });

    let version = await expectVersionDeployed(created.id, 1);
    expect(version.status).toBe('deployment_succeeded');
    expect(version.providerVersionOid).not.toBeNull();
    expect(version.deployment.trigger).toBe('manual');
    expect(version.deployment.startedAt).toBeInstanceOf(Date);
    expect(version.deployment.endedAt).toBeInstanceOf(Date);
    expect(version.deployment.commitOid).not.toBeNull();

    let commit = await eventually(async () => {
      let commit = await subspaceDb.customProviderCommit.findUniqueOrThrow({
        where: { oid: version.deployment.commitOid! }
      });
      if (commit.status === 'pending') throw new Error('Initial commit is still pending');
      return commit;
    });
    expect(commit).toMatchObject({
      type: 'create_version',
      status: 'applied',
      trigger: 'manual',
      message: 'Initial commit',
      targetCustomProviderVersionOid: version.oid,
      customProviderOid: created.oid
    });
    expect(commit.appliedAt).toBeInstanceOf(Date);

    let customProvider = await customProviderService.getCustomProviderById({
      instance: fixture.instance,
      customProviderId: created.id
    });
    expect(customProvider.status).toBe('active');
    expect(customProvider.provider).toMatchObject({
      name: created.name,
      access: 'tenant',
      ownerTenantOid: tenant.oid,
      hasEnvironments: true
    });
    expect(customProvider).toMatchObject({
      remoteUrl: server.url,
      remoteProtocol: 'streamable_http'
    });

    let providerVersion = await subspaceDb.providerVersion.findUniqueOrThrow({
      where: { oid: version.providerVersionOid! },
      include: { providerVariant: true }
    });
    expect(providerVersion.providerOid).toBe(customProvider.providerOid);
    expect(providerVersion.isCurrent).toBe(true);
    expect(providerVersion.providerVariant.currentVersionOid).toBe(providerVersion.oid);

    let environments = await firstPage(
      await customProviderEnvironmentService.listCustomProviderEnvironments({
        instance: fixture.instance,
        customProviderIds: [created.id]
      })
    );
    expect(environments).toHaveLength(1);
    expect(environments[0]!.environmentOid).toBe(environment.oid);
    expect(environments[0]!.providerEnvironment?.currentVersionOid).toBe(providerVersion.oid);
    expect(version.deployment.sourceEnvironmentOid).toBe(environments[0]!.oid);

    expect(
      await subspaceDb.upcomingCustomProvider.count({
        where: { customProviderOid: created.oid }
      })
    ).toBe(0);
  }, 180_000);

  it('discovers the tools of the upstream MCP server', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { customProvider } = await createDeployedCustomProvider(fixture, { url: server.url });
    let provider = customProvider.provider!;

    let session = await createProviderSession(org.clients.instance, [provider.id]);
    let client = connectSession(session.id, org.keys.instanceSecret);

    expect((await client.initialize()).status).toBe(200);

    let tools = await client.listTools();
    let forecast = findTool(tools.result.tools, 'forecast');
    findTool(tools.result.tools, 'multiply');

    let call = await client.request('tools/call', {
      name: forecast.name,
      arguments: { city: 'Vienna' }
    });
    expect(call).toMatchObject({
      result: { content: [{ type: 'text', text: 'Sunny in Vienna' }] }
    });
    expect(server.requests.map(request => request.method)).toContain('tools/list');
    expect(server.toolCalls()).toContainEqual({
      name: 'forecast',
      arguments: { city: 'Vienna' }
    });

    let providerTools = await eventually(async () => {
      let rows = await subspaceDb.providerTool.findMany({
        where: { providerOid: provider.oid, callableId: { in: ['forecast', 'multiply'] } },
        include: { specification: true }
      });
      if (rows.length < 2) throw new Error(`Only ${rows.length} provider tools discovered`);
      return rows;
    });
    expect(providerTools.every(tool => tool.specification.type === 'full')).toBe(true);

    let specificationOids = [...new Set(providerTools.map(tool => tool.specificationOid))];
    for (let specificationOid of specificationOids) {
      let specificationTools = providerTools
        .filter(tool => tool.specificationOid === specificationOid)
        .map(tool => ({
          callableId: tool.callableId,
          key: tool.key,
          description: tool.description
        }))
        .sort((a, b) => a.callableId.localeCompare(b.callableId));

      expect(specificationTools).toEqual([
        {
          callableId: 'forecast',
          key: 'tool_forecast',
          description: 'Returns the weather forecast for a city'
        },
        { callableId: 'multiply', key: 'tool_multiply', description: 'Multiplies two numbers' }
      ]);
    }
  }, 180_000);

  it.each<RemoteProtocol>(['streamable_http', 'sse', 'stateless'])(
    'deploys a remote MCP server over %s',
    async protocol => {
      let fixture = await loadOrganizationFixture(org.ids);
      let { customProvider, version } = await createDeployedCustomProvider(fixture, {
        url: server.url,
        protocol
      });

      expect(customProvider.payload.from).toEqual({
        type: 'remote',
        remoteUrl: server.url,
        protocol
      });
      expect(customProvider).toMatchObject({
        remoteUrl: server.url,
        remoteProtocol: protocol
      });

      let fetchedVersion = await customProviderVersionService.getCustomProviderVersionById({
        instance: fixture.instance,
        customProviderVersionId: version.id
      });
      expect(fetchedVersion).toMatchObject({
        remoteUrl: server.url,
        remoteProtocol: protocol
      });
    },
    180_000
  );

  it('records the steps and logs of a deployment', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { version } = await createDeployedCustomProvider(fixture, { url: server.url });

    let deployment = await customProviderDeploymentService.getCustomProviderDeploymentById({
      instance: fixture.instance,
      customProviderDeploymentId: version.deployment.id
    });
    expect(deployment.status).toBe('succeeded');
    expect(deployment.customProviderVersion?.id).toBe(version.id);

    let logs = await eventually(async () => {
      let logs = await customProviderDeploymentService.getLogs({
        instance: fixture.instance,
        customProviderDeployment: deployment
      });
      if (logs.steps.length < 2) throw new Error(`Only ${logs.steps.length} steps recorded`);
      return logs;
    });
    expect(logs.object).toBe('custom_provider.deployment.logs');
    expect(logs.customProviderDeploymentId).toBe(deployment.id);
    for (let step of logs.steps) {
      expect(step.object).toBe('custom_provider.deployment.step');
      expect(step.id).toMatch(/^cpds_/);
      for (let log of step.logs) expect(log.object).toBe('custom_provider.deployment.log');
    }
    expect(logs.steps.flatMap(step => step.logs).length).toBeGreaterThan(0);
  }, 180_000);

  it('finds a custom provider by its id, provider id and provider slug', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { customProvider } = await createDeployedCustomProvider(fixture, { url: server.url });

    for (let customProviderId of [
      customProvider.id,
      customProvider.provider!.id,
      customProvider.provider!.slug
    ]) {
      let found = await customProviderService.getCustomProviderById({
        instance: fixture.instance,
        customProviderId
      });
      expect(found.id).toBe(customProvider.id);
    }

    let listed = await firstPage(
      await customProviderService.listCustomProviders({
        instance: fixture.instance,
        providerIds: [customProvider.provider!.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([customProvider.id]);

    expect(
      (
        await firstPage(
          await customProviderService.listCustomProviders({
            instance: fixture.instance,
            type: ['container']
          })
        )
      ).map(item => item.id)
    ).not.toContain(customProvider.id);
  }, 180_000);

  it('filters custom provider deployments', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createDeployedCustomProvider(fixture, { url: server.url });
    let second = await createDeployedCustomProvider(fixture, { url: server.url });

    let list = (
      input: Parameters<
        typeof customProviderDeploymentService.listCustomProviderDeployments
      >[0]
    ) =>
      customProviderDeploymentService
        .listCustomProviderDeployments(input)
        .then(paginator => firstPage(paginator))
        .then(items => items.map(item => item.id));

    expect(
      await list({ instance: fixture.instance, customProviderIds: [first.customProvider.id] })
    ).toEqual([first.version.deployment.id]);
    expect(
      await list({ instance: fixture.instance, customProviderVersionIds: [second.version.id] })
    ).toEqual([second.version.deployment.id]);
    expect(
      await list({
        instance: fixture.instance,
        customProviderIds: [first.customProvider.id, second.customProvider.id],
        status: ['succeeded']
      })
    ).toHaveLength(2);
    expect(
      await list({
        instance: fixture.instance,
        customProviderIds: [first.customProvider.id],
        status: ['failed', 'queued', 'deploying']
      })
    ).toEqual([]);
  }, 240_000);
});
