import {
  createRemoteProvider,
  defaultMcpTestTools,
  eventually,
  expectOk,
  findTool,
  type McpTestTool,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listSessionTools,
  loadCurrentVersion,
  scopeOf,
  setTools,
  textTool,
  toolKeys
} from './_fixtures';

let hasTool = (names: string[], name: string) => names.some(n => n.endsWith(`_tool_${name}`));

let waitForVersionTools = (providerId: string, keys: string[]) =>
  eventually(
    async () => {
      let version = await loadCurrentVersion(providerId);
      expect(version.specification?.type).toBe('full');
      expect(toolKeys(version.specification)).toEqual(expect.arrayContaining(keys));
      return version;
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );

let loadConnectionSpecification = async (connectionToken: string) => {
  let connection = await subspaceDb.sessionConnection.findUniqueOrThrow({
    where: { token: connectionToken }
  });

  return await subspaceDb.sessionConnectionProviderSpecification.findFirstOrThrow({
    where: { connectionOid: connection.oid },
    include: { specification: true }
  });
};

describe('module-provider-internal specification discovery from a live server', () => {
  let org = useOrganization();
  let tools: McpTestTool[] = [...defaultMcpTestTools];
  let server = useMcpTestServer({ tools });
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  afterEach(() => setTools(tools, defaultMcpTestTools));

  it('pairs the session deployment and promotes the discovered full specification to the version', async () => {
    let { tenant, environment } = await scopeOf(org);
    let { session, client, tools: listed } = await listSessionTools(org, remote.providerId);
    findTool(listed, 'echo');
    findTool(listed, 'add');

    let version = await waitForVersionTools(remote.providerId, ['tool_add', 'tool_echo']);
    expect(version.specificationDiscoveryStatus).toBe('discovered');

    let sessionRow = await subspaceDb.session.findUniqueOrThrow({
      where: { id: session.id },
      include: { providers: { include: { deployment: true, config: true } } }
    });
    let sessionProvider = sessionRow.providers[0]!;
    let deploymentVersionOid = sessionProvider.deployment.currentVersionOid!;
    let configVersionOid = sessionProvider.config.currentVersionOid!;

    let pair = await eventually(async () => {
      let pair = await subspaceDb.providerDeploymentConfigPair.findUniqueOrThrow({
        where: {
          identifier: `${deploymentVersionOid.toString(36)}.${configVersionOid.toString(36)}.$`
        },
        include: { versions: { include: { specification: true } } }
      });
      expect(pair.lastUsedPairVersionOid).not.toBeNull();
      return pair;
    });
    expect(pair).toMatchObject({
      providerDeploymentVersionOid: deploymentVersionOid,
      providerConfigVersionOid: configVersionOid,
      providerAuthConfigVersionOid: null,
      tenantOid: tenant.oid,
      environmentOid: environment.oid
    });

    let pairVersion = pair.versions.find(v => v.versionOid === version.oid)!;
    expect(pairVersion.specificationDiscoveryStatus).toBe('discovered');
    expect(pairVersion.specification?.type).toBe('full');
    expect(toolKeys(pairVersion.specification)).toEqual(
      expect.arrayContaining(['tool_add', 'tool_echo'])
    );
    expect(pair.lastUsedPairVersionOid).toBe(pairVersion.oid);

    let connectionSpecification = await loadConnectionSpecification(client.sessionId!);
    expect(connectionSpecification).toMatchObject({
      status: 'discovered',
      sessionProviderOid: sessionProvider.oid,
      providerVersionOid: version.oid
    });
    expect(toolKeys(connectionSpecification.specification)).toEqual(
      expect.arrayContaining(['tool_add', 'tool_echo'])
    );
  }, 180_000);

  it('merges a tool that a later connection discovers into the version specification', async () => {
    await listSessionTools(org, remote.providerId);
    let before = await waitForVersionTools(remote.providerId, ['tool_add', 'tool_echo']);

    setTools(tools, [...defaultMcpTestTools, textTool('multiply')]);
    let { tools: listed } = await listSessionTools(org, remote.providerId);
    findTool(listed, 'multiply');

    let after = await waitForVersionTools(remote.providerId, [
      'tool_add',
      'tool_echo',
      'tool_multiply'
    ]);
    expect(after.oid).toBe(before.oid);
    expect(after.specificationOid).not.toBe(before.specificationOid);
    expect(after.specificationDiscoveryStatus).toBe('discovered');

    let change = await subspaceDb.providerVersionSpecificationChange.findFirstOrThrow({
      where: {
        fromVersionOid: after.oid,
        toVersionOid: after.oid,
        toSpecificationOid: after.specificationOid!
      },
      include: { providerSpecificationChangeNotifications: true }
    });
    expect(change.providerSpecificationChangeNotifications).toEqual([
      expect.objectContaining({ target: 'version', versionOid: after.oid })
    ]);

    let tool = await subspaceDb.providerTool.findUniqueOrThrow({
      where: {
        specificationOid_key: {
          specificationOid: after.specificationOid!,
          key: 'tool_multiply'
        }
      }
    });
    await eventually(async () => {
      let global = await subspaceDb.providerToolGlobal.findUniqueOrThrow({
        where: { oid: tool.globalOid }
      });
      expect(global).toMatchObject({ key: 'tool_multiply', providerOid: after.providerOid });
      expect(global.currentInstanceOid).not.toBeNull();
    });
  }, 180_000);

  it('keeps a tool the server dropped in the version specification but not in the new connection', async () => {
    setTools(tools, [...defaultMcpTestTools, textTool('divide')]);
    await listSessionTools(org, remote.providerId);
    let before = await waitForVersionTools(remote.providerId, ['tool_divide']);
    let changeCount = await subspaceDb.providerVersionSpecificationChange.count({
      where: { toVersionOid: before.oid }
    });

    setTools(tools, defaultMcpTestTools);
    let { client, names } = await listSessionTools(org, remote.providerId);
    expect(hasTool(names, 'divide')).toBe(false);
    expect(hasTool(names, 'echo')).toBe(true);

    let connectionSpecification = await loadConnectionSpecification(client.sessionId!);
    expect(connectionSpecification.status).toBe('discovered');
    expect(toolKeys(connectionSpecification.specification)).not.toContain('tool_divide');

    let after = await loadCurrentVersion(remote.providerId);
    expect(after.specificationOid).toBe(before.specificationOid);
    expect(toolKeys(after.specification)).toContain('tool_divide');
    expect(
      await subspaceDb.providerVersionSpecificationChange.count({
        where: { toVersionOid: before.oid }
      })
    ).toBe(changeCount);
  }, 180_000);
});

describe('module-provider-internal new provider versions', () => {
  let org = useOrganization();
  let tools: McpTestTool[] = [...defaultMcpTestTools];
  let server = useMcpTestServer({ tools });
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  it('a new server version becomes the current provider version with its own tools and a recorded change', async () => {
    await listSessionTools(org, remote.providerId);
    let first = await waitForVersionTools(remote.providerId, ['tool_add', 'tool_echo']);

    setTools(tools, [defaultMcpTestTools[0]!, textTool('subtract')]);
    expectOk(
      await org.clients.instance.post('/custom-provider-versions', {
        custom_provider_id: remote.customProvider.id,
        from: {
          type: 'remote',
          remote_url: `${server.url}?release=2`,
          protocol: 'streamable_http'
        }
      })
    );

    let second = await eventually(
      async () => {
        let version = await loadCurrentVersion(remote.providerId);
        expect(version.oid).not.toBe(first.oid);
        return version;
      },
      { timeoutMs: 90_000, intervalMs: 500 }
    );
    expect(second).toMatchObject({
      isCurrent: true,
      previousVersionOid: first.oid,
      providerOid: first.providerOid,
      providerVariantOid: first.providerVariantOid,
      shuttleServerOid: first.shuttleServerOid
    });
    expect(second.shuttleServerVersionOid).not.toBe(first.shuttleServerVersionOid);
    expect(
      (await subspaceDb.providerVersion.findUniqueOrThrow({ where: { oid: first.oid } }))
        .isCurrent
    ).toBe(false);

    let { names } = await listSessionTools(org, remote.providerId);
    expect(hasTool(names, 'subtract')).toBe(true);
    expect(hasTool(names, 'add')).toBe(false);

    let discovered = await waitForVersionTools(remote.providerId, [
      'tool_echo',
      'tool_subtract'
    ]);
    expect(discovered.oid).toBe(second.oid);
    expect(toolKeys(discovered.specification)).not.toContain('tool_add');

    let firstAfter = await subspaceDb.providerVersion.findUniqueOrThrow({
      where: { oid: first.oid },
      include: { specification: true }
    });
    expect(toolKeys(firstAfter.specification)).toContain('tool_add');

    await eventually(async () => {
      let change = await subspaceDb.providerVersionSpecificationChange.findFirst({
        where: {
          fromVersionOid: first.oid,
          toVersionOid: second.oid,
          toSpecificationOid: discovered.specificationOid!
        }
      });
      expect(change).not.toBeNull();
    });
  }, 300_000);
});
