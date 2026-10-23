import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { describe, expect, it } from 'vitest';
import {
  firewallService,
  networkPolicyService,
  type CreateNetworkPolicyParams,
  type NetworkPolicyRuleInput
} from '../src';

let httpsEgress: NetworkPolicyRuleInput = {
  effect: 'allow',
  direction: 'egress',
  cidrs: ['10.0.0.0/8'],
  enabled: true,
  priority: 100,
  ports: [{ from: 443, to: 443 }]
};

let dnsEgress: NetworkPolicyRuleInput = {
  effect: 'allow',
  direction: 'egress',
  cidrs: ['192.0.2.53/32'],
  enabled: true,
  priority: 50,
  ports: [{ from: 53, to: 53 }]
};

let officeIngress: NetworkPolicyRuleInput = {
  effect: 'allow',
  direction: 'ingress',
  cidrs: ['203.0.113.0/24'],
  description: 'Office',
  enabled: true,
  priority: 10
};

let invalidRules: [string, NetworkPolicyRuleInput][] = [
  ['an out-of-range prefix', { ...httpsEgress, cidrs: ['10.0.0.0/33'] }],
  ['a hostname instead of a CIDR', { ...httpsEgress, cidrs: ['example.com'] }],
  ['a bare IP without a prefix', { ...httpsEgress, cidrs: ['10.0.0.1'] }],
  ['no CIDRs', { ...httpsEgress, cidrs: [] }],
  ['ports on an ingress rule', { ...officeIngress, ports: [{ from: 443, to: 443 }] }],
  ['an empty port list', { ...httpsEgress, ports: [] }],
  ['port 0', { ...httpsEgress, ports: [{ from: 0, to: 80 }] }],
  ['a port above 65535', { ...httpsEgress, ports: [{ from: 443, to: 65536 }] }],
  ['an inverted port range', { ...httpsEgress, ports: [{ from: 444, to: 443 }] }],
  ['a fractional port', { ...httpsEgress, ports: [{ from: 80.5, to: 81 }] }],
  ['a fractional priority', { ...httpsEgress, priority: 1.5 }],
  ['an unknown effect', { ...httpsEgress, effect: 'block' as any }],
  ['an unknown direction', { ...httpsEgress, direction: 'both' as any }],
  ['a non-boolean enabled flag', { ...httpsEgress, enabled: 'yes' as any }]
];

describe('module-networking network policies', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createPolicy = async (
    input: Partial<CreateNetworkPolicyParams['input']> = {},
    ids: { organizationId: string } = org.ids
  ) => {
    let fixture = await loadOrganizationFixture(ids);

    let policy = await networkPolicyService.createNetworkPolicy({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('policy'), ...input }
    });

    return { fixture, policy };
  };

  let getPolicy = async (networkPolicyId: string) => {
    let { instance } = await loadOrganizationFixture(org.ids);
    return networkPolicyService.getNetworkPolicyById({ instance, networkPolicyId });
  };

  let getSource = (networkPolicyId: string) =>
    db.networkPolicy.findUniqueOrThrow({
      where: { id: networkPolicyId },
      include: { currentVersion: true, versions: true }
    });

  it('lists no network policies or firewalls for a fresh instance', async () => {
    let { instance } = await loadOrganizationFixture(otherOrg.ids);

    expect(
      await firstPage(await networkPolicyService.listNetworkPolicies({ instance }))
    ).toEqual([]);
    expect(await firstPage(await firewallService.listFirewalls({ instance }))).toEqual([]);
  });

  it('creates a policy with a first version and mirrors it into the integrations database', async () => {
    let { fixture, policy } = await createPolicy({
      name: '  Egress policy  ',
      description: '  Allows HTTPS  ',
      rules: [httpsEgress, officeIngress]
    });

    expect(policy).toMatchObject({
      status: 'active',
      name: 'Egress policy',
      description: 'Allows HTTPS',
      currentVersionNumber: 1,
      archivedAt: null,
      firewallLinks: []
    });
    expect(policy.currentVersion).toMatchObject({
      version: 1,
      rules: [
        { ...httpsEgress, id: expect.any(String) },
        { ...officeIngress, id: expect.any(String) }
      ]
    });
    let ruleIds = policy.currentVersion!.rules.map(rule => rule.id);
    expect(new Set(ruleIds).size).toBe(2);

    let { tenant, environment } = await resolveMetorialFacing({ instance: fixture.instance });
    expect(policy).toMatchObject({ tenantOid: tenant.oid, environmentOid: environment.oid });

    let source = await getSource(policy.id);
    expect(source).toMatchObject({
      status: 'active',
      name: 'Egress policy',
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      currentVersionNumber: 1,
      needsSubspaceSync: false,
      subspaceSyncedRevision: source.revision
    });
    expect(source.versions).toHaveLength(1);
    expect(source.currentVersion?.id).toBe(policy.currentVersion?.id);
    expect(policy.sourceRevision).toBe(source.revision);
  });

  it('creates a policy without rules as an empty first version', async () => {
    let { policy } = await createPolicy();

    expect(policy.currentVersionNumber).toBe(1);
    expect(policy.currentVersion).toMatchObject({ version: 1, rules: [] });
  });

  it('gets, lists, filters and searches policies of the instance', async () => {
    let token = uniqueId('netpol').toUpperCase();
    let { fixture, policy: named } = await createPolicy({ name: `Named ${token}` });
    let { policy: described } = await createPolicy({ description: `About ${token}` });
    let { policy: unrelated } = await createPolicy();

    let fetched = await getPolicy(named.id);
    expect(fetched.id).toBe(named.id);

    let byIds = await firstPage(
      await networkPolicyService.listNetworkPolicies({
        instance: fixture.instance,
        ids: [named.id, described.id, unrelated.id]
      })
    );
    expect(byIds.map(item => item.id).sort()).toEqual(
      [named.id, described.id, unrelated.id].sort()
    );

    let bySearch = await firstPage(
      await networkPolicyService.listNetworkPolicies({
        instance: fixture.instance,
        search: `  ${token.toLowerCase()} `
      })
    );
    expect(bySearch.map(item => item.id).sort()).toEqual([named.id, described.id].sort());

    await expectServiceError(
      networkPolicyService.getNetworkPolicyById({
        instance: fixture.instance,
        networkPolicyId: uniqueId('npol')
      }),
      'not_found'
    );
  });

  it('publishes a new version only when the rules change and keeps ids of unchanged rules', async () => {
    let { fixture, policy } = await createPolicy({ rules: [httpsEgress, dnsEgress] });
    let [httpsRule, dnsRule] = policy.currentVersion!.rules;
    let initialRevision = (await getSource(policy.id)).revision;

    let reordered = await networkPolicyService.updateNetworkPolicy({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      networkPolicy: policy,
      input: { rules: [dnsEgress, httpsEgress, officeIngress] }
    });
    expect(reordered.currentVersionNumber).toBe(2);
    let reorderedRules = reordered.currentVersion!.rules;
    expect(reorderedRules.map(rule => rule.id).slice(0, 2)).toEqual([
      dnsRule!.id,
      httpsRule!.id
    ]);
    expect([httpsRule!.id, dnsRule!.id]).not.toContain(reorderedRules[2]!.id);

    let afterRules = await getSource(policy.id);
    expect(afterRules.revision).toBeGreaterThan(initialRevision);

    let unchanged = await networkPolicyService.updateNetworkPolicy({
      instance: fixture.instance,
      networkPolicy: reordered,
      input: { rules: [dnsEgress, httpsEgress, officeIngress], name: reordered.name }
    });
    expect(unchanged.currentVersionNumber).toBe(2);
    expect(unchanged.currentVersion!.rules.map(rule => rule.id)).toEqual(
      reorderedRules.map(rule => rule.id)
    );
    expect((await getSource(policy.id)).revision).toBe(afterRules.revision);

    let renamed = await networkPolicyService.updateNetworkPolicy({
      instance: fixture.instance,
      networkPolicy: unchanged,
      input: { name: '  Renamed policy ', description: 'Now described' }
    });
    expect(renamed).toMatchObject({
      name: 'Renamed policy',
      description: 'Now described',
      currentVersionNumber: 2
    });

    let source = await getSource(policy.id);
    expect(source).toMatchObject({
      name: 'Renamed policy',
      revision: afterRules.revision + 1,
      needsSubspaceSync: false,
      subspaceSyncedRevision: afterRules.revision + 1
    });
    expect(source.versions).toHaveLength(2);

    let cleared = await networkPolicyService.updateNetworkPolicy({
      instance: fixture.instance,
      networkPolicy: renamed,
      input: { description: '' }
    });
    expect(cleared.description).toBeNull();

    let versions = await firstPage(
      await networkPolicyService.listNetworkPolicyVersions({
        instance: fixture.instance,
        networkPolicy: cleared
      })
    );
    expect(versions.map(version => version.version)).toEqual([2, 1]);

    let first = await networkPolicyService.getNetworkPolicyVersion({
      instance: fixture.instance,
      networkPolicy: cleared,
      version: 1
    });
    expect(first.rules.map(rule => rule.id)).toEqual([httpsRule!.id, dnsRule!.id]);

    await expectServiceError(
      networkPolicyService.getNetworkPolicyVersion({
        instance: fixture.instance,
        networkPolicy: cleared,
        version: 3
      }),
      'not_found'
    );
  });

  it('adds, updates and removes single rules, one version per change', async () => {
    let { fixture, policy } = await createPolicy({ rules: [httpsEgress] });
    let facing = {
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope
    };

    let added = await networkPolicyService.addNetworkPolicyRule({
      ...facing,
      networkPolicy: policy,
      input: { rule: officeIngress }
    });
    expect(added.rule).toMatchObject({ ...officeIngress, id: expect.any(String) });
    expect(added.networkPolicy.currentVersionNumber).toBe(2);
    expect(added.networkPolicy.currentVersion!.rules.map(rule => rule.id)).toEqual([
      policy.currentVersion!.rules[0]!.id,
      added.rule.id
    ]);

    let updated = await networkPolicyService.updateNetworkPolicyRule({
      ...facing,
      networkPolicy: added.networkPolicy,
      ruleId: added.rule.id,
      input: { rule: { ...officeIngress, priority: 20, cidrs: ['198.51.100.0/24'] } }
    });
    expect(updated.rule).toMatchObject({
      id: added.rule.id,
      priority: 20,
      cidrs: ['198.51.100.0/24']
    });
    expect(updated.networkPolicy.currentVersionNumber).toBe(3);

    let same = await networkPolicyService.updateNetworkPolicyRule({
      ...facing,
      networkPolicy: updated.networkPolicy,
      ruleId: added.rule.id,
      input: { rule: { ...officeIngress, priority: 20, cidrs: ['198.51.100.0/24'] } }
    });
    expect(same.networkPolicy.currentVersionNumber).toBe(3);

    await expectServiceError(
      networkPolicyService.updateNetworkPolicyRule({
        ...facing,
        networkPolicy: updated.networkPolicy,
        ruleId: uniqueId('npr'),
        input: { rule: officeIngress }
      }),
      'not_found'
    );
    await expectServiceError(
      networkPolicyService.removeNetworkPolicyRule({
        ...facing,
        networkPolicy: updated.networkPolicy,
        ruleId: uniqueId('npr')
      }),
      'not_found'
    );

    let removed = await networkPolicyService.removeNetworkPolicyRule({
      ...facing,
      networkPolicy: updated.networkPolicy,
      ruleId: added.rule.id
    });
    expect(removed.currentVersionNumber).toBe(4);
    expect(removed.currentVersion!.rules.map(rule => rule.id)).toEqual([
      policy.currentVersion!.rules[0]!.id
    ]);

    let source = await getSource(policy.id);
    expect(source.versions.map(version => version.version).sort()).toEqual([1, 2, 3, 4]);
    expect(source.currentVersion?.id).toBe(removed.currentVersion?.id);
  });

  it('rejects malformed rules on create without persisting anything', async () => {
    let { instance, actor, auditScope } = await loadOrganizationFixture(org.ids);

    for (let [label, rule] of invalidRules) {
      let name = uniqueId('invalid-policy');

      let error = await expectServiceError(
        networkPolicyService.createNetworkPolicy({
          instance,
          organizationActor: actor,
          auditScope,
          input: { name, rules: [httpsEgress, rule] }
        }),
        'invalid_network_policy_rules'
      );
      expect(error.message, label).toBeTruthy();
      expect(await db.networkPolicy.count({ where: { name } }), label).toBe(0);
    }
  });

  it('rejects malformed rules on updates without publishing a version', async () => {
    let { fixture, policy } = await createPolicy({ rules: [httpsEgress] });
    let rule = { ...httpsEgress, cidrs: ['not-a-cidr'] };

    await expectServiceError(
      networkPolicyService.updateNetworkPolicy({
        instance: fixture.instance,
        networkPolicy: policy,
        input: { rules: [rule] }
      }),
      'invalid_network_policy_rules'
    );
    await expectServiceError(
      networkPolicyService.addNetworkPolicyRule({
        instance: fixture.instance,
        networkPolicy: policy,
        input: { rule }
      }),
      'invalid_network_policy_rules'
    );
    await expectServiceError(
      networkPolicyService.updateNetworkPolicyRule({
        instance: fixture.instance,
        networkPolicy: policy,
        ruleId: policy.currentVersion!.rules[0]!.id,
        input: { rule: { ...httpsEgress, ports: [{ from: 0, to: 0 }] } }
      }),
      'invalid_network_policy_rules'
    );

    let source = await getSource(policy.id);
    expect(source.currentVersionNumber).toBe(1);
    expect(source.versions).toHaveLength(1);
  });

  it('stores duplicate, overlapping, disabled and IPv6 rules as written', async () => {
    let rules: NetworkPolicyRuleInput[] = [
      httpsEgress,
      httpsEgress,
      { ...httpsEgress, effect: 'deny', cidrs: ['10.1.0.0/16'], priority: 200 },
      { ...httpsEgress, cidrs: ['0.0.0.0/0'], enabled: false, ports: undefined },
      { ...httpsEgress, cidrs: ['2001:db8::/32'] }
    ];

    let { policy } = await createPolicy({ rules });

    let stored = policy.currentVersion!.rules;
    expect(stored).toHaveLength(5);
    expect(new Set(stored.map(rule => rule.id)).size).toBe(5);
    expect(stored.map(rule => [rule.effect, rule.cidrs[0], rule.enabled])).toEqual([
      ['allow', '10.0.0.0/8', true],
      ['allow', '10.0.0.0/8', true],
      ['deny', '10.1.0.0/16', true],
      ['allow', '0.0.0.0/0', false],
      ['allow', '2001:db8::/32', true]
    ]);
  });

  it('archives a policy, keeps it readable and rejects further changes', async () => {
    let { fixture, policy } = await createPolicy({ rules: [httpsEgress] });
    let facing = {
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope
    };

    let archived = await networkPolicyService.archiveNetworkPolicy({
      ...facing,
      networkPolicy: policy
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let source = await getSource(policy.id);
    expect(source).toMatchObject({ status: 'archived', needsSubspaceSync: false });
    expect(source.archivedAt).toBeInstanceOf(Date);

    expect((await getPolicy(policy.id)).status).toBe('archived');

    let active = await firstPage(
      await networkPolicyService.listNetworkPolicies({ ...facing, ids: [policy.id] })
    );
    expect(active).toEqual([]);
    let archivedList = await firstPage(
      await networkPolicyService.listNetworkPolicies({
        ...facing,
        ids: [policy.id],
        status: ['archived']
      })
    );
    expect(archivedList.map(item => item.id)).toEqual([policy.id]);

    await expectServiceError(
      networkPolicyService.updateNetworkPolicy({
        ...facing,
        networkPolicy: archived,
        input: { name: 'Nope' }
      }),
      'gone'
    );
    await expectServiceError(
      networkPolicyService.addNetworkPolicyRule({
        ...facing,
        networkPolicy: archived,
        input: { rule: officeIngress }
      }),
      'gone'
    );
    await expectServiceError(
      networkPolicyService.removeNetworkPolicyRule({
        ...facing,
        networkPolicy: archived,
        ruleId: archived.currentVersion!.rules[0]!.id
      }),
      'gone'
    );
    await expectServiceError(
      networkPolicyService.archiveNetworkPolicy({ ...facing, networkPolicy: archived }),
      'gone'
    );

    expect((await getSource(policy.id)).currentVersionNumber).toBe(1);
  });

  it("isolates policies from another organization's instance", async () => {
    let { policy } = await createPolicy({ rules: [httpsEgress] });
    let other = await loadOrganizationFixture(otherOrg.ids);

    await expectServiceError(
      networkPolicyService.getNetworkPolicyById({
        instance: other.instance,
        networkPolicyId: policy.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await networkPolicyService.listNetworkPolicies({
          instance: other.instance,
          ids: [policy.id]
        })
      )
    ).toEqual([]);

    await expect(
      networkPolicyService.updateNetworkPolicy({
        instance: other.instance,
        organizationActor: other.actor,
        auditScope: other.auditScope,
        networkPolicy: policy,
        input: { name: 'Hijacked', rules: [] }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      networkPolicyService.archiveNetworkPolicy({
        instance: other.instance,
        networkPolicy: policy
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      networkPolicyService.listNetworkPolicyVersions({
        instance: other.instance,
        networkPolicy: policy
      })
    ).rejects.toThrow('Tenant mismatch');

    let source = await getSource(policy.id);
    expect(source).toMatchObject({
      status: 'active',
      name: policy.name,
      currentVersionNumber: 1
    });
  });
});
