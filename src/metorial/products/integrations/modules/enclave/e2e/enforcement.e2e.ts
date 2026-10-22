import {
  createProviderSession,
  eventually,
  expectError,
  findTool,
  mcp,
  metorialEndpoints,
  rest,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { networkPolicyService } from '@metorial/module-networking';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  assignFirewall,
  createDeployableProvider,
  createDeploymentSession,
  createEnclave,
  createFirewallWithRules,
  facingFor,
  httpsEgress,
  officeIngress,
  readCompiledRules,
  rule,
  waitForReconciledEgress,
  workerTimeout,
  type Organization
} from './_fixtures';

let loopbackEgress = rule({ effect: 'allow', direction: 'egress', cidrs: ['127.0.0.0/8'] });
let anyIngress = rule({ effect: 'allow', direction: 'ingress', cidrs: ['0.0.0.0/0', '::/0'] });

let initializeMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'metorial-e2e', version: '1.0.0' }
  }
};

let initialize = (org: Organization, sessionId: string, sourceIp?: string) =>
  rest(`${metorialEndpoints().mcp}/connect/mcp/${sessionId}`, {
    apiKey: org.keys.instanceSecret,
    headers: {
      accept: 'application/json, text/event-stream',
      ...(sourceIp ? { 'x-forwarded-for': sourceIp } : {})
    }
  }).post('', initializeMessage);

let connect = (org: Organization, sessionId: string, sourceIp?: string) =>
  mcp(`${metorialEndpoints().mcp}/connect/mcp/${sessionId}`, {
    apiKey: org.keys.instanceSecret,
    headers: sourceIp ? { 'x-forwarded-for': sourceIp } : undefined
  });

let waitForIngress = (org: Organization, enclaveId: string, cidrs: string[]) =>
  eventually(async () => {
    let rules = await readCompiledRules(org, enclaveId);
    expect(rules.ingress.entries.map(entry => entry.cidr).sort()).toEqual([...cidrs].sort());
  }, workerTimeout);

describe('module-enclave ingress enforcement on MCP connections', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  let deploymentId: string;
  let enclaveId: string;
  let policy: Awaited<ReturnType<typeof createFirewallWithRules>>['policy'];

  beforeAll(async () => {
    let { providerId } = await createDeployableProvider(org, server.url);
    let { deployment, enclave } = await createEnclave(org, providerId);
    deploymentId = deployment.id;
    enclaveId = enclave.id;

    let created = await createFirewallWithRules(org, [officeIngress, loopbackEgress]);
    policy = created.policy;
    await assignFirewall(org, created.firewall.id, { targetType: 'enclave', enclaveId });
    await waitForIngress(org, enclaveId, ['203.0.113.0/24']);
  }, 180_000);

  it('rejects connections from sources outside the ingress allow list', async () => {
    let session = await createDeploymentSession(org, deploymentId);

    expectError(
      await initialize(org, session.id, '198.51.100.7'),
      403,
      'ingress_network_policy_blocked'
    );
    expectError(
      await initialize(org, session.id, '198.51.100.7, 203.0.113.5'),
      403,
      'ingress_network_policy_blocked'
    );
    expectError(await initialize(org, session.id), 403, 'ingress_network_policy_blocked');
  });

  it('serves allowed sources end to end', async () => {
    let session = await createDeploymentSession(org, deploymentId);
    let client = connect(org, session.id, '203.0.113.5');
    let text = uniqueId('ingress-allowed');

    let init = await client.initialize();
    expect(init.status).toBe(200);

    let echo = findTool((await client.listTools()).result.tools, 'echo');
    let call = await client.request('tools/call', { name: echo.name, arguments: { text } });

    expect(call.result.content).toEqual([{ type: 'text', text }]);
    expect(server.toolCalls()).toContainEqual({ name: 'echo', arguments: { text } });
  }, 120_000);

  it('applies policy changes to existing sessions once the cached rules expire', async () => {
    let session = await createDeploymentSession(org, deploymentId);
    expectError(
      await initialize(org, session.id, '198.51.100.7'),
      403,
      'ingress_network_policy_blocked'
    );

    let { facing } = await facingFor(org);
    await networkPolicyService.addNetworkPolicyRule({
      ...facing,
      networkPolicy: policy,
      input: { rule: { ...officeIngress, cidrs: ['198.51.100.0/24'] } }
    });
    await waitForIngress(org, enclaveId, ['198.51.100.0/24', '203.0.113.0/24']);

    await eventually(
      async () => {
        expect((await initialize(org, session.id, '198.51.100.7')).status).toBe(200);
      },
      { timeoutMs: 150_000, intervalMs: 5_000 }
    );
  }, 240_000);
});

describe('module-enclave egress enforcement on upstream calls', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  it('blocks tool calls to upstream addresses outside the egress allow list', async () => {
    let { providerId } = await createDeployableProvider(org, server.url);
    let allowed = await createEnclave(org, providerId);
    let blocked = await createEnclave(org, providerId);

    let { firewall: loopback } = await createFirewallWithRules(org, [
      anyIngress,
      loopbackEgress
    ]);
    let { firewall: privateHttps } = await createFirewallWithRules(org, [
      anyIngress,
      httpsEgress
    ]);
    await assignFirewall(org, loopback.id, {
      targetType: 'enclave',
      enclaveId: allowed.enclave.id
    });
    await assignFirewall(org, privateHttps.id, {
      targetType: 'enclave',
      enclaveId: blocked.enclave.id
    });

    await waitForReconciledEgress(allowed.enclave.id, ['127.0.0.0/8']);
    await waitForReconciledEgress(blocked.enclave.id, ['10.0.0.0/8']);

    let allowedClient = connect(
      org,
      (await createDeploymentSession(org, allowed.deployment.id)).id
    );
    let allowedText = uniqueId('egress-allowed');
    expect((await allowedClient.initialize()).status).toBe(200);
    let echo = findTool((await allowedClient.listTools()).result.tools, 'echo');
    let allowedCall = await allowedClient.request('tools/call', {
      name: echo.name,
      arguments: { text: allowedText }
    });
    expect(allowedCall.result.content).toEqual([{ type: 'text', text: allowedText }]);

    let blockedClient = connect(
      org,
      (await createDeploymentSession(org, blocked.deployment.id)).id
    );
    let blockedText = uniqueId('egress-blocked');
    await blockedClient.initialize();
    let blockedTools = await blockedClient.listTools();
    let blockedEcho = blockedTools.result?.tools
      ? findTool(blockedTools.result.tools, 'echo')
      : echo;
    let blockedCall = await blockedClient.request('tools/call', {
      name: blockedEcho.name,
      arguments: { text: blockedText }
    });

    expect(blockedCall.result?.content).not.toEqual([{ type: 'text', text: blockedText }]);
    expect(JSON.stringify(blockedCall)).toMatch(/egress/i);
    expect(server.toolCalls().map(call => call.arguments.text)).toContain(allowedText);
    expect(server.toolCalls().map(call => call.arguments.text)).not.toContain(blockedText);
  }, 360_000);
});

describe('module-enclave instance-wide enforcement', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;

  beforeAll(async () => {
    ({ providerId } = await createDeployableProvider(org, server.url));
    let { firewall } = await createFirewallWithRules(org, [officeIngress, loopbackEgress]);
    await assignFirewall(org, firewall.id, { targetType: 'internet_gateway' });
  }, 120_000);

  it('blocks sessions on deployments behind an internet gateway firewall', async () => {
    let { deployment, enclave } = await createEnclave(org, providerId);
    await waitForIngress(org, enclave.id, ['203.0.113.0/24']);
    let session = await createDeploymentSession(org, deployment.id);

    expectError(
      await initialize(org, session.id, '198.51.100.7'),
      403,
      'ingress_network_policy_blocked'
    );
    expect((await initialize(org, session.id, '203.0.113.5')).status).toBe(200);
  }, 120_000);

  it.fails(
    'blocks sessions on ephemeral deployments behind an internet gateway firewall (bug: ephemeral deployments get no enclave, so no network policy applies to them)',
    async () => {
      let session = await createProviderSession(org.clients.instance, [providerId]);

      expectError(
        await initialize(org, session.id, '198.51.100.7'),
        403,
        'ingress_network_policy_blocked'
      );
    },
    120_000
  );
});
