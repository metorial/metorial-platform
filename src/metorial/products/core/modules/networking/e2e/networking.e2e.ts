import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { firewallService, networkPolicyService, type NetworkPolicyRuleInput } from '../src';

let egressRule: NetworkPolicyRuleInput = {
  effect: 'allow',
  direction: 'egress',
  cidrs: ['10.0.0.0/8'],
  enabled: true,
  priority: 100,
  ports: [{ from: 443, to: 443 }]
};

describe('module-networking', () => {
  let org = useOrganization();

  it('creates a network policy with a first rules version', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('policy');

    let policy = await networkPolicyService.createNetworkPolicy({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name, rules: [egressRule] }
    });
    expect(policy.name).toBe(name);
    expect(policy.currentVersion?.rules).toHaveLength(1);
    expect(policy.currentVersion?.rules[0]).toMatchObject({
      ...egressRule,
      id: expect.any(String)
    });

    let fetched = await networkPolicyService.getNetworkPolicyById({
      instance: fixture.instance,
      networkPolicyId: policy.id
    });
    expect(fetched.id).toBe(policy.id);

    let policies = await firstPage(
      await networkPolicyService.listNetworkPolicies({
        instance: fixture.instance,
        ids: [policy.id]
      })
    );
    expect(policies.map(item => item.id)).toEqual([policy.id]);
  });

  it('rejects network policy rules with invalid CIDRs', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    await expect(
      networkPolicyService.createNetworkPolicy({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        input: { name: uniqueId('policy'), rules: [{ ...egressRule, cidrs: ['not-a-cidr'] }] }
      })
    ).rejects.toThrow(/invalid CIDR/);
  });

  it('creates a firewall linked to a network policy and archives it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let policy = await networkPolicyService.createNetworkPolicy({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('policy'), rules: [egressRule] }
    });

    let name = uniqueId('firewall');
    let firewall = await firewallService.createFirewall({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name, networkPolicyIds: [policy.id] }
    });
    expect(firewall.name).toBe(name);
    expect(firewall.networkPolicyLinks.map(link => link.networkPolicy.id)).toEqual([
      policy.id
    ]);

    let firewalls = await firstPage(
      await firewallService.listFirewalls({
        instance: fixture.instance,
        networkPolicyIds: [policy.id]
      })
    );
    expect(firewalls.map(item => item.id)).toEqual([firewall.id]);

    await firewallService.archiveFirewall({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      firewall
    });
    let archived = await firewallService.getFirewallById({
      instance: fixture.instance,
      firewallId: firewall.id,
      allowDeleted: true
    });
    expect(archived.status).toBe('archived');
  });
});
