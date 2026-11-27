import {
  createProviderSession,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { firewallService, networkPolicyService } from '@metorial/module-networking';
import { describe, expect, it } from 'vitest';
import { integrationEnclaveService, integrationInternetGatewayService } from '../src';
import {
  assignFirewall,
  createDeployableProvider,
  createEnclave,
  createFirewallWithRules,
  denyAllIngress,
  denyAllRules,
  expectCompiledRules,
  facingFor,
  httpsEgress,
  officeIngress,
  readCompiledRules,
  rule,
  unassignFirewall,
  unrestrictedRules,
  waitForProviderUse,
  type CompiledRules
} from './_fixtures';

let officeHttpsRules: CompiledRules = {
  ingress: { direction: 'ingress', entries: [{ cidr: '203.0.113.0/24' }] },
  egress: {
    direction: 'egress',
    entries: [{ cidr: '10.0.0.0/8', portRange: { from: 443, to: 443 } }]
  }
};

let docsHttpEgress = rule({
  effect: 'allow',
  direction: 'egress',
  cidrs: ['192.0.2.0/24'],
  ports: [{ from: 80, to: 80 }]
});

describe('module-enclave compiled rules for enclave assignments', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  let providerPromise: ReturnType<typeof createDeployableProvider> | undefined;
  let provider = () => (providerPromise ??= createDeployableProvider(org, server.url));

  it('gives a new enclave unrestricted rules on the instance internet gateway', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let gateway = await integrationInternetGatewayService.get({ instance });

    let { deployment, enclave } = await createEnclave(org, providerId);

    expect(enclave).toMatchObject({
      internetGateway: { id: gateway.id },
      providerDeployment: { id: deployment.id, provider: { id: providerId } },
      firewallAssignments: [],
      hasFunctionBayBacking: false
    });
    expect(
      (await integrationInternetGatewayService.get({ instance })).enclaves.map(e => e.id)
    ).toContain(enclave.id);

    expect(await readCompiledRules(org, enclave.id)).toEqual(unrestrictedRules);
    let stored = await subspaceDb.integrationEnclave.findUniqueOrThrow({
      where: { id: enclave.id }
    });
    expect(stored.compiledNetworkRules).toEqual(unrestrictedRules);
  });

  it('creates no enclave for sessions on ephemeral deployments', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let countEnclaves = async () =>
      (
        await firstPage(
          await integrationEnclaveService.listEnclaves({ instance, providerIds: [providerId] })
        )
      ).length;

    let before = await countEnclaves();
    await createProviderSession(org.clients.instance, [providerId]);

    expect(await countEnclaves()).toBe(before);
  });

  it('restricts an enclave with an assigned firewall and follows core policy changes', async () => {
    let { facing } = await facingFor(org);
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);
    let { policy, firewall } = await createFirewallWithRules(org, [
      httpsEgress,
      officeIngress
    ]);

    await assignFirewall(org, firewall.id, { targetType: 'enclave', enclaveId: enclave.id });
    await expectCompiledRules(org, enclave.id, officeHttpsRules);

    let docsEgress: CompiledRules['egress'] = {
      direction: 'egress',
      entries: [{ cidr: '192.0.2.0/24', portRange: { from: 443, to: 443 } }]
    };

    let updated = await networkPolicyService.updateNetworkPolicy({
      ...facing,
      networkPolicy: policy,
      input: { rules: [{ ...httpsEgress, cidrs: ['192.0.2.0/24'] }] }
    });
    await expectCompiledRules(org, enclave.id, {
      ingress: denyAllIngress,
      egress: docsEgress
    });

    let { networkPolicy: withIngress } = await networkPolicyService.addNetworkPolicyRule({
      ...facing,
      networkPolicy: updated,
      input: { rule: officeIngress }
    });
    await expectCompiledRules(org, enclave.id, {
      ingress: officeHttpsRules.ingress,
      egress: docsEgress
    });

    await networkPolicyService.archiveNetworkPolicy({ ...facing, networkPolicy: withIngress });
    await expectCompiledRules(org, enclave.id, denyAllRules);

    await firewallService.archiveFirewall({ ...facing, firewall });
    await expectCompiledRules(org, enclave.id, unrestrictedRules);
  });

  it('lifts the restriction when the assignment is deleted', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress, officeIngress]);

    let assignment = await assignFirewall(org, firewall.id, {
      targetType: 'enclave',
      enclaveId: enclave.id
    });
    await expectCompiledRules(org, enclave.id, officeHttpsRules);

    await unassignFirewall(org, assignment.id);
    await expectCompiledRules(org, enclave.id, unrestrictedRules);

    let refreshed = await integrationEnclaveService.getEnclaveById({
      instance,
      enclaveId: enclave.id
    });
    expect(refreshed.firewallAssignments).toEqual([]);
  });

  it('combines every assigned firewall and honours rule priority across firewalls', async () => {
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);
    let { firewall: https } = await createFirewallWithRules(org, [httpsEgress]);
    let { firewall: docs } = await createFirewallWithRules(org, [
      docsHttpEgress,
      officeIngress
    ]);

    await assignFirewall(org, https.id, { targetType: 'enclave', enclaveId: enclave.id });
    await assignFirewall(org, docs.id, { targetType: 'enclave', enclaveId: enclave.id });

    await expectCompiledRules(org, enclave.id, {
      ingress: officeHttpsRules.ingress,
      egress: {
        direction: 'egress',
        entries: [
          { cidr: '10.0.0.0/8', portRange: { from: 443, to: 443 } },
          { cidr: '192.0.2.0/24', portRange: { from: 80, to: 80 } }
        ]
      }
    });

    let { firewall: blockPrivate } = await createFirewallWithRules(org, [
      rule({ effect: 'deny', direction: 'egress', cidrs: ['10.0.0.0/8'], priority: 500 })
    ]);
    await assignFirewall(org, blockPrivate.id, {
      targetType: 'enclave',
      enclaveId: enclave.id
    });

    await expectCompiledRules(org, enclave.id, {
      ingress: officeHttpsRules.ingress,
      egress: {
        direction: 'egress',
        entries: [{ cidr: '192.0.2.0/24', portRange: { from: 80, to: 80 } }]
      }
    });
  });

  it('denies all traffic when assigned firewalls have no active rules', async () => {
    let { facing } = await facingFor(org);
    let { providerId } = await provider();

    let { enclave: withoutPolicies } = await createEnclave(org, providerId);
    let empty = await firewallService.createFirewall({
      ...facing,
      input: { name: uniqueId('firewall') }
    });
    await assignFirewall(org, empty.id, {
      targetType: 'enclave',
      enclaveId: withoutPolicies.id
    });
    await expectCompiledRules(org, withoutPolicies.id, denyAllRules);

    let { enclave: withDisabledRules } = await createEnclave(org, providerId);
    let { firewall: disabled } = await createFirewallWithRules(org, [
      { ...httpsEgress, enabled: false },
      { ...officeIngress, enabled: false }
    ]);
    await assignFirewall(org, disabled.id, {
      targetType: 'enclave',
      enclaveId: withDisabledRules.id
    });
    await expectCompiledRules(org, withDisabledRules.id, denyAllRules);
  });
});

describe('module-enclave compiled rules for provider assignments', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  it('applies a provider assignment to every enclave of that provider only', async () => {
    let assigned = await createDeployableProvider(org, server.url);
    let unrelated = await createDeployableProvider(org, server.url);
    let { enclave: first } = await createEnclave(org, assigned.providerId);
    let { enclave: second } = await createEnclave(org, assigned.providerId);
    let { enclave: other } = await createEnclave(org, unrelated.providerId);
    await waitForProviderUse(org, assigned.providerId);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress, officeIngress]);

    let assignment = await assignFirewall(org, firewall.id, {
      targetType: 'provider',
      providerId: assigned.providerId
    });

    await expectCompiledRules(org, first.id, officeHttpsRules);
    await expectCompiledRules(org, second.id, officeHttpsRules);
    expect(await readCompiledRules(org, other.id)).toEqual(unrestrictedRules);

    let { enclave: later } = await createEnclave(org, assigned.providerId);
    expect(await readCompiledRules(org, later.id)).toEqual(officeHttpsRules);

    await unassignFirewall(org, assignment.id);
    for (let enclave of [first, second, later]) {
      await expectCompiledRules(org, enclave.id, unrestrictedRules);
    }
  });
});

describe('module-enclave compiled rules for internet gateway assignments', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  it('applies an internet gateway assignment to every enclave of the instance', async () => {
    let { instance } = await facingFor(org);
    let gateway = await integrationInternetGatewayService.get({ instance });
    let mine = await createDeployableProvider(org, server.url);
    let theirs = await createDeployableProvider(otherOrg, server.url);
    let { enclave: first } = await createEnclave(org, mine.providerId);
    let { enclave: second } = await createEnclave(org, mine.providerId);
    let { enclave: foreign } = await createEnclave(otherOrg, theirs.providerId);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress, officeIngress]);

    expect(
      (
        await firstPage(
          await integrationEnclaveService.listEnclaves({
            instance,
            internetGatewayIds: [gateway.id]
          })
        )
      )
        .map(enclave => enclave.id)
        .sort()
    ).toEqual([first.id, second.id].sort());

    let assignment = await assignFirewall(org, firewall.id, {
      targetType: 'internet_gateway'
    });

    await expectCompiledRules(org, first.id, officeHttpsRules);
    await expectCompiledRules(org, second.id, officeHttpsRules);

    let { enclave: later } = await createEnclave(org, mine.providerId);
    expect(await readCompiledRules(org, later.id)).toEqual(officeHttpsRules);
    expect(await readCompiledRules(otherOrg, foreign.id)).toEqual(unrestrictedRules);

    await unassignFirewall(org, assignment.id);
    for (let enclave of [first, second, later]) {
      await expectCompiledRules(org, enclave.id, unrestrictedRules);
    }
  });
});
