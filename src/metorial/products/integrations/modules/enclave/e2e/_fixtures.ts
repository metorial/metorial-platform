import {
  createRemoteProvider,
  eventually,
  expectOk,
  firstPage,
  uniqueId,
  type useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import {
  emptyCidr,
  firewallService,
  networkPolicyService,
  universeCidr,
  type CompiledNetworkAllowEntry,
  type NetworkPolicyRuleInput
} from '@metorial/module-networking';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { expect } from 'vitest';
import { integrationEnclaveService, integrationFirewallAssignmentService } from '../src';
import type { FirewallAssignmentInput } from '../src/services/integrationFirewallAssignment';

export type Organization = ReturnType<typeof useOrganization>;

export let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };
export let reconcileTimeout = { timeoutMs: 180_000, intervalMs: 2_000 };

export let rule = (
  input: Pick<NetworkPolicyRuleInput, 'effect' | 'direction' | 'cidrs'> &
    Partial<NetworkPolicyRuleInput>
): NetworkPolicyRuleInput => ({
  enabled: true,
  priority: 100,
  ...input
});

export let httpsEgress = rule({
  effect: 'allow',
  direction: 'egress',
  cidrs: ['10.0.0.0/8'],
  ports: [{ from: 443, to: 443 }]
});

export let officeIngress = rule({
  effect: 'allow',
  direction: 'ingress',
  cidrs: ['203.0.113.0/24']
});

export let facingFor = async (org: Organization) => {
  let fixture = await loadOrganizationFixture(org.ids);

  return {
    fixture,
    instance: fixture.instance,
    facing: {
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope
    }
  };
};

export let createFirewallWithRules = async (
  org: Organization,
  rules: NetworkPolicyRuleInput[]
) => {
  let { facing } = await facingFor(org);

  let policy = await networkPolicyService.createNetworkPolicy({
    ...facing,
    input: { name: uniqueId('policy'), rules }
  });
  let firewall = await firewallService.createFirewall({
    ...facing,
    input: { name: uniqueId('firewall'), networkPolicyIds: [policy.id] }
  });

  return { policy, firewall };
};

export let assignFirewall = async (
  org: Organization,
  firewallId: string,
  input: FirewallAssignmentInput
) => {
  let { instance } = await facingFor(org);

  return integrationFirewallAssignmentService.createFirewallAssignment({
    instance,
    firewallId,
    input
  });
};

export let unassignFirewall = async (org: Organization, assignmentId: string) => {
  let { instance } = await facingFor(org);
  let firewallAssignment =
    await integrationFirewallAssignmentService.getFirewallAssignmentById({
      instance,
      firewallAssignmentId: assignmentId
    });

  return integrationFirewallAssignmentService.deleteFirewallAssignment({
    instance,
    firewallAssignment
  });
};

export let createDeployableProvider = async (org: Organization, url: string) => {
  let remote = await createRemoteProvider(org.clients.instance, { url });

  await eventually(async () => {
    let provider = await subspaceDb.provider.findUniqueOrThrow({
      where: { id: remote.providerId },
      include: { defaultVariant: { include: { currentVersion: true } } }
    });
    if (!provider.defaultVariant?.currentVersion?.specificationOid) {
      throw new Error(`Provider ${remote.providerId} has no specification yet`);
    }
  }, workerTimeout);

  return remote;
};

export let createEnclave = async (org: Organization, providerId: string) => {
  let deployment = expectOk(
    await org.clients.instance.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('deployment')
    })
  );

  let { instance } = await facingFor(org);
  let [enclave] = await firstPage(
    await integrationEnclaveService.listEnclaves({
      instance,
      providerDeploymentIds: [deployment.id]
    })
  );
  if (!enclave) throw new Error(`Deployment ${deployment.id} has no enclave`);

  return { deployment, enclave };
};

export let waitForProviderUse = (org: Organization, providerId: string) =>
  eventually(async () => {
    let { instance } = await facingFor(org);
    let { tenant, environment } = await resolveMetorialFacing({ instance });
    let use = await subspaceDb.providerUse.findFirst({
      where: {
        provider: { id: providerId },
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      }
    });
    if (!use) throw new Error(`Provider ${providerId} is not in use yet`);
  }, workerTimeout);

export let createDeploymentSession = async (org: Organization, deploymentId: string) =>
  expectOk(
    await org.clients.instance.post('/sessions', {
      providers: [{ provider_deployment_id: deploymentId }]
    })
  );

type AllowList = {
  direction: 'ingress' | 'egress';
  entries: CompiledNetworkAllowEntry[];
};

export type CompiledRules = { ingress: AllowList; egress: AllowList };

let sortList = (list: AllowList) => ({
  direction: list.direction,
  entries: [...list.entries].sort((a, b) =>
    `${a.cidr}:${a.portRange?.from ?? ''}`.localeCompare(
      `${b.cidr}:${b.portRange?.from ?? ''}`
    )
  )
});

let sortRules = (rules: CompiledRules) => ({
  ingress: sortList(rules.ingress),
  egress: sortList(rules.egress)
});

let unrestrictedEntries = () => [
  { cidr: universeCidr('ipv4') },
  { cidr: universeCidr('ipv6') }
];

let denyAllEntries = () => [{ cidr: emptyCidr('ipv4') }, { cidr: emptyCidr('ipv6') }];

export let unrestrictedRules: CompiledRules = {
  ingress: { direction: 'ingress', entries: unrestrictedEntries() },
  egress: { direction: 'egress', entries: unrestrictedEntries() }
};

export let denyAllRules: CompiledRules = {
  ingress: { direction: 'ingress', entries: denyAllEntries() },
  egress: { direction: 'egress', entries: denyAllEntries() }
};

export let denyAllIngress: AllowList = { direction: 'ingress', entries: denyAllEntries() };

export let readCompiledRules = async (org: Organization, enclaveId: string) => {
  let { instance } = await facingFor(org);
  let enclave = await integrationEnclaveService.getEnclaveById({ instance, enclaveId });

  return (await integrationEnclaveService.getCompiledNetworkRules({
    instance,
    enclave
  })) as unknown as CompiledRules;
};

export let expectCompiledRules = (
  org: Organization,
  enclaveId: string,
  expected: CompiledRules
) =>
  eventually(async () => {
    expect(sortRules(await readCompiledRules(org, enclaveId))).toEqual(sortRules(expected));
  }, workerTimeout);

export let waitForReconciledEgress = (enclaveId: string, egressCidrs: string[]) =>
  eventually(async () => {
    let enclave = await subspaceDb.integrationEnclave.findUniqueOrThrow({
      where: { id: enclaveId },
      include: { providerDeployment: true }
    });
    let rules = enclave.compiledNetworkRules as unknown as CompiledRules | null;

    expect(enclave.needsEnclaveReconciliation).toBe(false);
    expect(enclave.providerDeployment.serverInstanceConfigurationOid).not.toBeNull();
    expect(rules?.egress.entries.map(entry => entry.cidr).sort()).toEqual(
      [...egressCidrs].sort()
    );
  }, reconcileTimeout);
