import {
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  expectResponses,
  expectRoutesAuth,
  ids,
  invalid,
  listAuth,
  managementApi,
  notFound,
  resourceAuth
} from './_shared';

let networkListAuth = { ...listAuth, instance: 403 };
let networkResourceAuth = { ...resourceAuth, instance: 403 };

let egressRule = {
  effect: 'allow',
  direction: 'egress',
  cidrs: ['10.0.0.0/8'],
  description: 'Internal HTTPS',
  enabled: true,
  priority: 10,
  ports: [{ from: 443, to: 443 }]
};

let ingressRule = {
  effect: 'deny',
  direction: 'ingress',
  cidrs: ['0.0.0.0/0'],
  enabled: true,
  priority: 20
};

describe('api-core integrations: networking', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createPolicy = async (body: Record<string, unknown> = {}, target = org) =>
    expectOk(
      await managementApi(target).post('/network-policies', {
        name: uniqueId('e2e-policy'),
        ...body
      })
    );

  let createFirewall = async (body: Record<string, unknown> = {}, target = org) =>
    expectOk(
      await managementApi(target).post('/firewalls', {
        name: uniqueId('e2e-firewall'),
        ...body
      })
    );

  it('authenticates every networking route per credential', async () => {
    let policy = await createPolicy({ rules: [egressRule] });
    let firewall = await createFirewall({ network_policy_ids: [policy.id] });

    await expectRoutesAuth(org, otherOrg, [
      { path: '/firewalls', expected: networkListAuth },
      { path: '/network-policies', expected: networkListAuth },
      { path: `/firewalls/${firewall.id}`, expected: networkResourceAuth },
      { path: `/network-policies/${policy.id}`, expected: networkResourceAuth }
    ]);
  });

  it('rejects invalid networking bodies', async () => {
    let management = managementApi(org);
    let policy = await createPolicy();
    let firewall = await createFirewall();

    await expectResponses([
      invalid('firewall without name', () => management.post('/firewalls', {})),
      invalid('firewall with string policy ids', () =>
        management.post('/firewalls', { name: 'x', network_policy_ids: policy.id })
      ),
      invalid('firewall update with numeric slug', () =>
        management.patch(`/firewalls/${firewall.id}`, { slug: 5 })
      ),
      invalid('policy link without policy', () =>
        management.post(`/firewalls/${firewall.id}/network-policies`, {})
      ),
      invalid('policy link with string position', () =>
        management.post(`/firewalls/${firewall.id}/network-policies`, {
          network_policy_id: policy.id,
          position: 'first'
        })
      ),
      invalid('policy without name', () => management.post('/network-policies', {})),
      invalid('policy with unknown rule effect', () =>
        management.post('/network-policies', {
          name: 'x',
          rules: [{ ...egressRule, effect: 'maybe' }]
        })
      ),
      invalid('policy with rule missing cidrs', () =>
        management.post('/network-policies', {
          name: 'x',
          rules: [{ ...ingressRule, cidrs: undefined }]
        })
      ),
      invalid('rule with string priority', () =>
        management.post(`/network-policies/${policy.id}/rules`, {
          ...ingressRule,
          priority: 'first'
        })
      ),
      invalid('rule with string port', () =>
        management.post(`/network-policies/${policy.id}/rules`, {
          ...egressRule,
          ports: [{ from: 'https', to: 443 }]
        })
      ),
      invalid('firewall list with unknown status', () =>
        management.get('/firewalls', { query: { status: 'burning' } })
      )
    ]);

    let rejected = (label: string, rule: Record<string, unknown>) => ({
      label,
      call: () => management.post(`/network-policies/${policy.id}/rules`, rule),
      status: 400,
      code: 'invalid_network_policy_rules'
    });

    await expectResponses([
      rejected('invalid cidr', { ...ingressRule, cidrs: ['10.0.0.300/8'] }),
      rejected('no cidrs', { ...ingressRule, cidrs: [] }),
      rejected('fractional priority', { ...ingressRule, priority: 1.5 }),
      rejected('ports on ingress', { ...ingressRule, ports: [{ from: 80, to: 80 }] }),
      {
        label: 'policy created with an invalid rule',
        call: () =>
          management.post('/network-policies', {
            name: 'x',
            rules: [{ ...ingressRule, cidrs: ['not-a-cidr'] }]
          }),
        status: 400,
        code: 'invalid_network_policy_rules'
      }
    ]);

    expect(expectOk(await management.get(`/network-policies/${policy.id}`)).rules).toEqual([]);
  });

  it('versions network policy rules and archives the policy', async () => {
    let management = managementApi(org);
    let name = uniqueId('e2e-policy');

    let policy = await createPolicy({ name, description: 'Policy', rules: [egressRule] });
    expectPresented(policy, 'networking.network_policy');
    expect(policy).toMatchObject({
      name,
      description: 'Policy',
      status: 'active',
      firewall_ids: [],
      rules: [
        {
          object: 'networking.network_policy.rule',
          effect: 'allow',
          direction: 'egress',
          cidrs: ['10.0.0.0/8'],
          description: 'Internal HTTPS',
          enabled: true,
          priority: 10,
          ports: [{ object: 'networking.network_policy.port_range', from: 443, to: 443 }]
        }
      ]
    });
    let [firstRule] = policy.rules;
    expect(firstRule.id).toEqual(expect.any(String));

    let added = expectOk(
      await management.post(`/network-policies/${policy.id}/rules`, ingressRule)
    );
    expectPresented(added, 'networking.network_policy.rule');
    expect(added).toMatchObject({ effect: 'deny', direction: 'ingress', ports: null });

    let withRule = expectOk(await management.get(`/network-policies/${policy.id}`));
    expect(withRule.version).toBeGreaterThan(policy.version);
    expect(ids(withRule.rules)).toEqual(expect.arrayContaining([firstRule.id, added.id]));

    let changed = expectOk(
      await management.patch(`/network-policies/${policy.id}/rules/${added.id}`, {
        ...ingressRule,
        enabled: false,
        priority: 30
      })
    );
    expect(changed).toMatchObject({ id: added.id, enabled: false, priority: 30 });

    let removed = expectOk(
      await management.delete(`/network-policies/${policy.id}/rules/${firstRule.id}`)
    );
    expectPresented(removed, 'networking.network_policy');
    expect(ids(removed.rules)).toEqual([added.id]);

    await expectResponses([
      notFound('update unknown rule', () =>
        management.patch(
          `/network-policies/${policy.id}/rules/${uniqueId('rule')}`,
          ingressRule
        )
      ),
      notFound('delete unknown rule', () =>
        management.delete(`/network-policies/${policy.id}/rules/${uniqueId('rule')}`)
      )
    ]);

    let renamed = expectOk(
      await management.patch(`/network-policies/${policy.id}`, { name: 'Renamed policy' })
    );
    expect(renamed).toMatchObject({ name: 'Renamed policy', description: 'Policy' });
    expect(ids(renamed.rules)).toEqual([added.id]);

    expect(
      ids(await listAll(management, '/network-policies', { query: { id: policy.id } }))
    ).toEqual([policy.id]);

    let archived = expectOk(await management.delete(`/network-policies/${policy.id}`));
    expect(archived.status).toBe('archived');
    expect(archived.archived_at).toEqual(expect.any(String));
    expect(
      await listAll(management, '/network-policies', { query: { id: policy.id } })
    ).toEqual([]);

    await expectResponses([
      {
        label: 'update archived policy',
        call: () => management.patch(`/network-policies/${policy.id}`, { name: 'x' }),
        status: 410,
        code: 'gone'
      },
      {
        label: 'add rule to archived policy',
        call: () => management.post(`/network-policies/${policy.id}/rules`, ingressRule),
        status: 410,
        code: 'gone'
      },
      {
        label: 'archive archived policy',
        call: () => management.delete(`/network-policies/${policy.id}`),
        status: 410,
        code: 'gone'
      },
      {
        label: 'firewall with archived policy',
        call: () =>
          management.post('/firewalls', { name: 'x', network_policy_ids: [policy.id] }),
        status: 400,
        code: 'use_after_delete'
      }
    ]);
  });

  it('links network policies to firewalls and archives the firewall', async () => {
    let management = managementApi(org);
    let policy = await createPolicy({ rules: [egressRule] });
    let second = await createPolicy();
    let otherPolicy = await createPolicy({}, otherOrg);
    let slug = uniqueId('e2e-fw').toLowerCase();

    let firewall = await createFirewall({
      description: 'Firewall',
      slug,
      network_policy_ids: [policy.id]
    });
    expectPresented(firewall, 'networking.firewall');
    expect(firewall).toMatchObject({ slug, description: 'Firewall', status: 'active' });
    expect(firewall.network_policies).toMatchObject([
      { object: 'networking.network_policy#preview', id: policy.id, rules: [{ priority: 10 }] }
    ]);

    let linked = expectOk(
      await management.post(`/firewalls/${firewall.id}/network-policies`, {
        network_policy_id: second.id
      })
    );
    expect(ids(linked.network_policies).sort()).toEqual([policy.id, second.id].sort());

    let again = expectOk(
      await management.post(`/firewalls/${firewall.id}/network-policies`, {
        network_policy_id: second.id
      })
    );
    expect(again.network_policies).toHaveLength(2);

    expect(
      expectOk(await management.get(`/network-policies/${second.id}`)).firewall_ids
    ).toEqual([firewall.id]);
    expect(
      ids(await listAll(management, '/firewalls', { query: { network_policy_id: second.id } }))
    ).toEqual([firewall.id]);
    expect(
      ids(
        await listAll(management, '/network-policies', { query: { firewall_id: firewall.id } })
      ).sort()
    ).toEqual([policy.id, second.id].sort());

    let unlinked = expectOk(
      await management.delete(`/firewalls/${firewall.id}/network-policies/${second.id}`)
    );
    expect(ids(unlinked.network_policies)).toEqual([policy.id]);

    await expectResponses([
      notFound('unlink a policy that is not linked', () =>
        management.delete(`/firewalls/${firewall.id}/network-policies/${second.id}`)
      ),
      notFound('link an unknown policy', () =>
        management.post(`/firewalls/${firewall.id}/network-policies`, {
          network_policy_id: uniqueId('npol')
        })
      ),
      notFound('link a foreign policy', () =>
        management.post(`/firewalls/${firewall.id}/network-policies`, {
          network_policy_id: otherPolicy.id
        })
      ),
      {
        label: 'firewall with a foreign policy',
        call: () =>
          management.post('/firewalls', { name: 'x', network_policy_ids: [otherPolicy.id] }),
        status: 400,
        code: 'invalid_firewall_network_policies'
      },
      {
        label: 'firewall with a duplicate slug',
        call: () => management.post('/firewalls', { name: 'x', slug }),
        status: 409
      }
    ]);

    let renamed = expectOk(
      await management.patch(`/firewalls/${firewall.id}`, { name: 'Renamed firewall' })
    );
    expect(renamed).toMatchObject({ name: 'Renamed firewall', slug });

    let archived = expectOk(await management.delete(`/firewalls/${firewall.id}`));
    expect(archived.status).toBe('archived');
    expect(expectOk(await management.get(`/firewalls/${firewall.id}`)).status).toBe(
      'archived'
    );
    expect(await listAll(management, '/firewalls', { query: { id: firewall.id } })).toEqual(
      []
    );

    await expectResponses([
      {
        label: 'update archived firewall',
        call: () => management.patch(`/firewalls/${firewall.id}`, { name: 'x' }),
        status: 410,
        code: 'gone'
      },
      {
        label: 'link policy to archived firewall',
        call: () =>
          management.post(`/firewalls/${firewall.id}/network-policies`, {
            network_policy_id: second.id
          }),
        status: 410,
        code: 'gone'
      },
      {
        label: 'archive archived firewall',
        call: () => management.delete(`/firewalls/${firewall.id}`),
        status: 410,
        code: 'gone'
      }
    ]);
  });

  it('pages through firewalls and policies', async () => {
    let management = managementApi(org);
    let firewalls = [await createFirewall(), await createFirewall(), await createFirewall()];
    let policies = [await createPolicy(), await createPolicy(), await createPolicy()];

    let listedFirewalls = await listAll(management, '/firewalls', { limit: 1 });
    expect(ids(listedFirewalls)).toEqual(expect.arrayContaining(ids(firewalls)));
    expect(new Set(ids(listedFirewalls)).size).toBe(listedFirewalls.length);

    let listedPolicies = await listAll(management, '/network-policies', { limit: 2 });
    expect(ids(listedPolicies)).toEqual(expect.arrayContaining(ids(policies)));
    for (let item of listedPolicies) expectPresented(item, 'networking.network_policy');

    let foreign = ids(await listAll(managementApi(otherOrg), '/firewalls'));
    for (let firewall of firewalls) expect(foreign).not.toContain(firewall.id);
  });

  it('does not let another organization read or change networking resources', async () => {
    let policy = await createPolicy({ rules: [ingressRule] });
    let firewall = await createFirewall({ network_policy_ids: [policy.id] });
    let other = managementApi(otherOrg);

    await expectResponses([
      notFound('read firewall', () => other.get(`/firewalls/${firewall.id}`)),
      notFound('update firewall', () =>
        other.patch(`/firewalls/${firewall.id}`, { name: 'x' })
      ),
      notFound('archive firewall', () => other.delete(`/firewalls/${firewall.id}`)),
      notFound('unlink policy', () =>
        other.delete(`/firewalls/${firewall.id}/network-policies/${policy.id}`)
      ),
      notFound('read policy', () => other.get(`/network-policies/${policy.id}`)),
      notFound('update policy', () =>
        other.patch(`/network-policies/${policy.id}`, { name: 'x' })
      ),
      notFound('add rule', () =>
        other.post(`/network-policies/${policy.id}/rules`, egressRule)
      ),
      notFound('archive policy', () => other.delete(`/network-policies/${policy.id}`))
    ]);

    let fetched = expectOk(await managementApi(org).get(`/firewalls/${firewall.id}`));
    expect(fetched).toMatchObject({ name: firewall.name, status: 'active' });
    expect(ids(fetched.network_policies)).toEqual([policy.id]);
    expectError(await org.clients.instance.get(`/firewalls/${firewall.id}`), 403);
  });
});
