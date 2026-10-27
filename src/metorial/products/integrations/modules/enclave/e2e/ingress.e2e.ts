import {
  createProviderSession,
  eventually,
  expectServiceError,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  enclaveIngressPolicyService,
  integrationInternetGatewayNetworkLogService
} from '../src';
import { flushBufferedIngressNetworkLogsToRedis } from '../src/lib/ingressNetworkLogBuffer';
import { ingressNetworkLogPersistManyQueue } from '../src/queues/networkLog/ingress';
import {
  assignFirewall,
  createDeployableProvider,
  createDeploymentSession,
  createEnclave,
  createFirewallWithRules,
  denyAllRules,
  expectCompiledRules,
  facingFor,
  rule
} from './_fixtures';

let logTimeout = { timeoutMs: 120_000, intervalMs: 2_000 };

describe('module-enclave ingress policy evaluation', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;
  let enclaveId: string;
  let sessionId: string;

  beforeAll(async () => {
    ({ providerId } = await createDeployableProvider(org, server.url));
    let { deployment, enclave } = await createEnclave(org, providerId);
    enclaveId = enclave.id;

    let { firewall } = await createFirewallWithRules(org, [
      rule({ effect: 'allow', direction: 'ingress', cidrs: ['203.0.113.0/24'], priority: 10 }),
      rule({
        effect: 'deny',
        direction: 'ingress',
        cidrs: ['203.0.113.128/25'],
        priority: 20
      }),
      rule({ effect: 'allow', direction: 'ingress', cidrs: ['2001:db8::/32'], priority: 10 })
    ]);
    await assignFirewall(org, firewall.id, { targetType: 'enclave', enclaveId });

    await expectCompiledRules(org, enclaveId, {
      ingress: {
        direction: 'ingress',
        entries: [{ cidr: '203.0.113.0/25' }, { cidr: '2001:db8::/32' }]
      },
      egress: denyAllRules.egress
    });

    sessionId = (await createDeploymentSession(org, deployment.id)).id;
  }, 180_000);

  let check = async (sourceIp: string, sessionIds = [sessionId]) => {
    let { instance } = await facingFor(org);

    return enclaveIngressPolicyService.checkSessionIngressAccess({
      instance,
      sessionIds,
      sourceIp
    });
  };

  it('evaluates source addresses against the compiled ingress rules', async () => {
    let allowed = { sessionId, resolvedSessionId: sessionId, enclaveIds: [enclaveId] };

    for (let sourceIp of [
      '203.0.113.5',
      '203.0.113.127',
      '2001:db8::1',
      '::ffff:203.0.113.5'
    ]) {
      expect(await check(sourceIp), sourceIp).toEqual({
        object: 'enclave.ingress_check',
        results: [{ ...allowed, allowed: true, deniedEnclaveIds: [] }]
      });
    }

    for (let sourceIp of [
      '203.0.113.128',
      '203.0.113.200',
      '198.51.100.7',
      '2001:db9::1',
      '0.0.0.0',
      'not-an-ip'
    ]) {
      expect(await check(sourceIp), sourceIp).toEqual({
        object: 'enclave.ingress_check',
        results: [{ ...allowed, allowed: false, deniedEnclaveIds: [enclaveId] }]
      });
    }
  });

  it('denies unknown and foreign sessions and deduplicates requested ids', async () => {
    let missing = uniqueId('missing');
    let result = await check('203.0.113.5', [sessionId, missing, sessionId]);

    expect(result.results).toEqual([
      expect.objectContaining({ sessionId, allowed: true }),
      { sessionId: missing, allowed: false, enclaveIds: [], deniedEnclaveIds: [] }
    ]);

    let { instance: otherInstance } = await facingFor(otherOrg);
    let foreign = await enclaveIngressPolicyService.checkSessionIngressAccess({
      instance: otherInstance,
      sessionIds: [sessionId],
      sourceIp: '203.0.113.5'
    });
    expect(foreign.results).toEqual([
      { sessionId, allowed: false, enclaveIds: [], deniedEnclaveIds: [] }
    ]);
  });

  it('does not restrict sessions on ephemeral deployments', async () => {
    let ephemeral = await createProviderSession(org.clients.instance, [providerId]);

    let result = await check('198.51.100.7', [ephemeral.id]);

    expect(result.results).toEqual([
      {
        sessionId: ephemeral.id,
        resolvedSessionId: ephemeral.id,
        allowed: true,
        enclaveIds: [],
        deniedEnclaveIds: []
      }
    ]);
  });

  it('asserts ingress access and rejects blocked sources', async () => {
    let { instance } = await facingFor(org);

    let allowed = await enclaveIngressPolicyService.assertSessionIngressAccess({
      instance,
      sessionId,
      sourceIp: '203.0.113.5'
    });
    expect(allowed).toMatchObject({ sessionId, allowed: true, enclaveIds: [enclaveId] });

    await expectServiceError(
      enclaveIngressPolicyService.assertSessionIngressAccess({
        instance,
        sessionId,
        sourceIp: '203.0.113.200'
      }),
      'ingress_network_policy_blocked'
    );
    await expectServiceError(
      enclaveIngressPolicyService.assertSessionIngressAccess({
        instance,
        sessionId: uniqueId('missing'),
        sourceIp: '203.0.113.5'
      }),
      'ingress_network_policy_blocked'
    );
  });

  it('records ingress decisions as network logs for the enclave', async () => {
    let { instance } = await facingFor(org);
    let hostname = `${uniqueId('ingress')}.e2e.test`;

    for (let sourceIp of ['203.0.113.5', '203.0.113.5', '198.51.100.7']) {
      await enclaveIngressPolicyService.checkSessionIngressAccess({
        instance,
        sessionIds: [sessionId],
        sourceIp,
        hostname,
        port: 443,
        recordLog: true
      });
    }
    await enclaveIngressPolicyService.checkSessionIngressAccess({
      instance,
      sessionIds: [sessionId],
      sourceIp: '203.0.113.6',
      hostname
    });

    await flushBufferedIngressNetworkLogsToRedis();
    await ingressNetworkLogPersistManyQueue.add({});

    let list = (filters: { hostnames?: string[]; ips?: string[] }) =>
      integrationInternetGatewayNetworkLogService.listNetworkLogs({
        instance,
        direction: 'ingress',
        enclaveIds: [enclaveId],
        filters
      });

    let logs = await eventually(async () => {
      let response = await list({ hostnames: [hostname] });
      expect(response.records.reduce((sum, record) => sum + record.count, 0)).toBe(3);
      return response;
    }, logTimeout);

    expect(logs).toMatchObject({
      object: 'enclave.network_logs',
      direction: 'ingress',
      enclaveIds: [enclaveId]
    });
    expect(
      logs.records
        .map(record => ({
          object: record.object,
          enclaveId: record.enclaveId,
          hostname: record.hostname,
          ip: record.ip,
          port: record.port,
          result: record.result,
          count: record.count
        }))
        .sort((a, b) => a.ip.localeCompare(b.ip))
    ).toEqual([
      {
        object: 'enclave.network_log',
        enclaveId,
        hostname,
        ip: '198.51.100.7',
        port: 443,
        result: 'denied',
        count: 1
      },
      {
        object: 'enclave.network_log',
        enclaveId,
        hostname,
        ip: '203.0.113.5',
        port: 443,
        result: 'allowed',
        count: 2
      }
    ]);

    let denied = await list({ hostnames: [hostname], ips: ['198.51.100.7'] });
    expect(denied.records.map(record => record.result)).toEqual(['denied']);
    expect((await list({ hostnames: [uniqueId('other')] })).records).toEqual([]);

    let egress = await integrationInternetGatewayNetworkLogService.listNetworkLogs({
      instance,
      direction: 'egress',
      enclaveIds: [enclaveId],
      filters: {}
    });
    expect(egress).toEqual({
      object: 'enclave.network_logs',
      direction: 'egress',
      enclaveIds: [],
      records: []
    });

    let { instance: otherInstance } = await facingFor(otherOrg);
    await expectServiceError(
      integrationInternetGatewayNetworkLogService.listNetworkLogs({
        instance: otherInstance,
        direction: 'ingress',
        enclaveIds: [enclaveId],
        filters: {}
      }),
      'not_found'
    );
    expect(
      (
        await integrationInternetGatewayNetworkLogService.listNetworkLogs({
          instance: otherInstance,
          direction: 'ingress',
          filters: { hostnames: [hostname] }
        })
      ).records
    ).toEqual([]);
  }, 180_000);
});
