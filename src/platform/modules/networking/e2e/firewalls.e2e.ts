import { slugify } from '@lowerdeck/slugify';
import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { describe, expect, it } from 'vitest';
import {
  firewallService,
  networkPolicyService,
  type CreateFirewallParams,
  type NetworkPolicyRuleInput
} from '../src';

let searchTimeout = { timeoutMs: 60_000, intervalMs: 500 };

let httpsEgress: NetworkPolicyRuleInput = {
  effect: 'allow',
  direction: 'egress',
  cidrs: ['10.0.0.0/8'],
  enabled: true,
  priority: 100,
  ports: [{ from: 443, to: 443 }]
};

type FirewallLinks = { position: number; networkPolicy: { id: string } }[];

let linkedPolicies = (links: FirewallLinks) =>
  links.map(link => [link.networkPolicy.id, link.position]);

describe('module-networking firewalls', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let facingFor = async (ids: { organizationId: string } = org.ids) => {
    let fixture = await loadOrganizationFixture(ids);

    return {
      fixture,
      facing: {
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope
      }
    };
  };

  let createPolicy = async (ids: { organizationId: string } = org.ids) => {
    let { facing } = await facingFor(ids);

    return networkPolicyService.createNetworkPolicy({
      ...facing,
      input: { name: uniqueId('policy'), rules: [httpsEgress] }
    });
  };

  let createFirewall = async (
    input: Partial<CreateFirewallParams['input']> = {},
    ids: { organizationId: string } = org.ids
  ) => {
    let { facing } = await facingFor(ids);

    return firewallService.createFirewall({
      ...facing,
      input: { name: uniqueId('firewall'), ...input }
    });
  };

  let getSource = (firewallId: string) =>
    db.firewall.findUniqueOrThrow({
      where: { id: firewallId },
      include: {
        networkPolicyLinks: { include: { networkPolicy: true }, orderBy: { position: 'asc' } }
      }
    });

  let getMirroredLinks = async (firewallId: string) => {
    let links = await subspaceDb.firewallNetworkPolicy.findMany({
      where: { firewall: { id: firewallId } },
      include: { networkPolicy: true },
      orderBy: { position: 'asc' }
    });

    return links.map(link => [link.networkPolicy.id, link.position]);
  };

  it('creates a firewall with ordered policies on the instance internet gateway', async () => {
    let first = await createPolicy();
    let second = await createPolicy();
    let slug = uniqueId('edge');

    let firewall = await createFirewall({
      name: '  Edge firewall  ',
      description: '  Blocks things  ',
      slug,
      networkPolicyIds: [second.id, first.id]
    });

    expect(firewall).toMatchObject({
      status: 'active',
      name: 'Edge firewall',
      description: 'Blocks things',
      slug,
      archivedAt: null
    });
    expect(linkedPolicies(firewall.networkPolicyLinks)).toEqual([
      [second.id, 0],
      [first.id, 1]
    ]);

    let { fixture } = await facingFor();
    let { tenant, environment } = await resolveMetorialFacing({ instance: fixture.instance });
    let gateway = await subspaceDb.integrationInternetGateway.findUniqueOrThrow({
      where: {
        tenantOid_environmentOid: { tenantOid: tenant.oid, environmentOid: environment.oid }
      }
    });
    expect(firewall.internetGateway).toEqual({
      id: gateway.id,
      name: 'Metorial Magic Network'
    });
    expect(firewall).toMatchObject({
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      internetGatewayOid: gateway.oid
    });

    let source = await getSource(firewall.id);
    expect(source).toMatchObject({
      status: 'active',
      slug,
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      needsSubspaceSync: false,
      subspaceSyncedRevision: source.revision
    });
    expect(source.networkPolicyLinks.map(link => link.networkPolicy.id)).toEqual([
      second.id,
      first.id
    ]);
    expect(firewall.sourceRevision).toBe(source.revision);

    let policy = await networkPolicyService.getNetworkPolicyById({
      instance: fixture.instance,
      networkPolicyId: first.id
    });
    expect(policy.firewallLinks.map(link => link.firewall.id)).toEqual([firewall.id]);
  });

  it('derives a unique slug from the name when none is given', async () => {
    let name = uniqueId('Shared Name');

    let first = await createFirewall({ name });
    let second = await createFirewall({ name });

    expect(first.slug.startsWith(`${slugify(name)}-`)).toBe(true);
    expect(second.slug.startsWith(`${slugify(name)}-`)).toBe(true);
    expect(first.slug).not.toBe(second.slug);
    expect(first.networkPolicyLinks).toEqual([]);
  });

  it('updates metadata, replaces policy links and keeps the mirror in sync', async () => {
    let first = await createPolicy();
    let second = await createPolicy();
    let firewall = await createFirewall({
      description: 'Original',
      networkPolicyIds: [first.id, second.id]
    });
    let { facing } = await facingFor();
    let initialRevision = (await getSource(firewall.id)).revision;
    let slug = uniqueId('renamed');

    let updated = await firewallService.updateFirewall({
      ...facing,
      firewall,
      input: { name: ' Renamed ', description: '', slug, networkPolicyIds: [second.id] }
    });
    expect(updated).toMatchObject({ name: 'Renamed', description: null, slug });
    expect(linkedPolicies(updated.networkPolicyLinks)).toEqual([[second.id, 0]]);
    expect(await getMirroredLinks(firewall.id)).toEqual([[second.id, 0]]);

    let source = await getSource(firewall.id);
    expect(source).toMatchObject({
      name: 'Renamed',
      description: null,
      slug,
      revision: initialRevision + 1,
      subspaceSyncedRevision: initialRevision + 1
    });

    let renamedOnly = await firewallService.updateFirewall({
      ...facing,
      firewall: updated,
      input: { name: 'Renamed again' }
    });
    expect(renamedOnly).toMatchObject({ name: 'Renamed again', slug, description: null });
    expect(linkedPolicies(renamedOnly.networkPolicyLinks)).toEqual([[second.id, 0]]);

    let cleared = await firewallService.updateFirewall({
      ...facing,
      firewall: renamedOnly,
      input: { networkPolicyIds: [] }
    });
    expect(cleared.networkPolicyLinks).toEqual([]);
    expect(await getMirroredLinks(firewall.id)).toEqual([]);
    expect((await getSource(firewall.id)).networkPolicyLinks).toEqual([]);
  });

  it('adds and removes single policies, appending by default', async () => {
    let first = await createPolicy();
    let second = await createPolicy();
    let third = await createPolicy();
    let firewall = await createFirewall({ networkPolicyIds: [first.id] });
    let { facing } = await facingFor();

    let added = await firewallService.addFirewallNetworkPolicy({
      ...facing,
      firewall,
      networkPolicyId: second.id
    });
    expect(linkedPolicies(added.networkPolicyLinks)).toEqual([
      [first.id, 0],
      [second.id, 1]
    ]);

    let positioned = await firewallService.addFirewallNetworkPolicy({
      ...facing,
      firewall: added,
      networkPolicyId: third.id,
      position: 5
    });
    expect(linkedPolicies(positioned.networkPolicyLinks)).toEqual([
      [first.id, 0],
      [second.id, 1],
      [third.id, 5]
    ]);

    let revision = (await getSource(firewall.id)).revision;
    let again = await firewallService.addFirewallNetworkPolicy({
      ...facing,
      firewall: positioned,
      networkPolicyId: first.id,
      position: 9
    });
    expect(linkedPolicies(again.networkPolicyLinks)).toEqual(
      linkedPolicies(positioned.networkPolicyLinks)
    );
    expect((await getSource(firewall.id)).revision).toBe(revision);

    let removed = await firewallService.removeFirewallNetworkPolicy({
      ...facing,
      firewall: again,
      networkPolicyId: second.id
    });
    expect(linkedPolicies(removed.networkPolicyLinks)).toEqual([
      [first.id, 0],
      [third.id, 5]
    ]);
    expect(await getMirroredLinks(firewall.id)).toEqual([
      [first.id, 0],
      [third.id, 5]
    ]);

    await expectServiceError(
      firewallService.removeFirewallNetworkPolicy({
        ...facing,
        firewall: removed,
        networkPolicyId: second.id
      }),
      'not_found'
    );
  });

  it('rejects missing, foreign and archived policies', async () => {
    let { facing } = await facingFor();
    let own = await createPolicy();
    let foreign = await createPolicy(otherOrg.ids);
    let archived = await networkPolicyService.archiveNetworkPolicy({
      ...facing,
      networkPolicy: await createPolicy()
    });

    for (let networkPolicyId of [uniqueId('npol'), foreign.id]) {
      let name = uniqueId('rejected-firewall');
      await expectServiceError(
        createFirewall({ name, networkPolicyIds: [own.id, networkPolicyId] }),
        'invalid_firewall_network_policies'
      );
      expect(await db.firewall.count({ where: { name } })).toBe(0);
    }

    let archivedName = uniqueId('rejected-firewall');
    await expectServiceError(
      createFirewall({ name: archivedName, networkPolicyIds: [archived.id] }),
      'use_after_delete'
    );
    expect(await db.firewall.count({ where: { name: archivedName } })).toBe(0);

    let firewall = await createFirewall({ networkPolicyIds: [own.id] });

    for (let networkPolicyId of [uniqueId('npol'), foreign.id]) {
      await expectServiceError(
        firewallService.addFirewallNetworkPolicy({ ...facing, firewall, networkPolicyId }),
        'not_found'
      );
    }
    await expectServiceError(
      firewallService.addFirewallNetworkPolicy({
        ...facing,
        firewall,
        networkPolicyId: archived.id
      }),
      'use_after_delete'
    );
    await expectServiceError(
      firewallService.updateFirewall({
        ...facing,
        firewall,
        input: { name: 'Should not apply', networkPolicyIds: [foreign.id] }
      }),
      'invalid_firewall_network_policies'
    );

    let source = await getSource(firewall.id);
    expect(source.name).toBe(firewall.name);
    expect(source.networkPolicyLinks.map(link => link.networkPolicy.id)).toEqual([own.id]);
  });

  it('collapses duplicate policy ids into one link', async () => {
    let first = await createPolicy();
    let second = await createPolicy();

    let firewall = await createFirewall({ networkPolicyIds: [first.id, first.id, second.id] });
    expect(linkedPolicies(firewall.networkPolicyLinks)).toEqual([
      [first.id, 0],
      [second.id, 1]
    ]);

    let { facing } = await facingFor();
    let updated = await firewallService.updateFirewall({
      ...facing,
      firewall,
      input: { networkPolicyIds: [second.id, second.id] }
    });
    expect(linkedPolicies(updated.networkPolicyLinks)).toEqual([[second.id, 0]]);
    expect(await getMirroredLinks(firewall.id)).toEqual([[second.id, 0]]);
  });

  it('keeps slugs unique per instance, including archived firewalls', async () => {
    let slug = uniqueId('taken');
    let { facing } = await facingFor();
    let owner = await createFirewall({ slug });

    await expectServiceError(createFirewall({ slug }), 'conflict');
    await expectServiceError(createFirewall({ slug: `  ${slug}  ` }), 'conflict');

    let other = await createFirewall();
    await expectServiceError(
      firewallService.updateFirewall({ ...facing, firewall: other, input: { slug } }),
      'conflict'
    );
    expect((await getSource(other.id)).slug).toBe(other.slug);

    let unchanged = await firewallService.updateFirewall({
      ...facing,
      firewall: owner,
      input: { slug, name: 'Same slug' }
    });
    expect(unchanged.slug).toBe(slug);

    let foreign = await createFirewall({ slug }, otherOrg.ids);
    expect(foreign.slug).toBe(slug);

    await firewallService.archiveFirewall({ ...facing, firewall: unchanged });
    await expectServiceError(createFirewall({ slug }), 'conflict');
  });

  it('lists and filters firewalls, and finds them by search once indexed', async () => {
    let token = uniqueId('fwsearch').replace(/-/g, '');
    let policy = await createPolicy();
    let linked = await createFirewall({
      name: `Linked ${token}`,
      networkPolicyIds: [policy.id]
    });
    let plain = await createFirewall({ description: `Plain ${token}` });
    let { facing } = await facingFor();

    let byIds = await firstPage(
      await firewallService.listFirewalls({ ...facing, ids: [linked.id, plain.id] })
    );
    expect(byIds.map(item => item.id).sort()).toEqual([linked.id, plain.id].sort());

    let bySlug = await firstPage(
      await firewallService.listFirewalls({ ...facing, slugs: [plain.slug] })
    );
    expect(bySlug.map(item => item.id)).toEqual([plain.id]);

    let byPolicy = await firstPage(
      await firewallService.listFirewalls({ ...facing, networkPolicyIds: [policy.id] })
    );
    expect(byPolicy.map(item => item.id)).toEqual([linked.id]);

    let fetched = await firewallService.getFirewallById({ ...facing, firewallId: linked.id });
    expect(fetched.id).toBe(linked.id);
    await expectServiceError(
      firewallService.getFirewallById({ ...facing, firewallId: uniqueId('fw') }),
      'not_found'
    );

    await eventually(async () => {
      let found = await firstPage(
        await firewallService.listFirewalls({ ...facing, search: token })
      );
      expect(found.map(item => item.id).sort()).toEqual([linked.id, plain.id].sort());
    }, searchTimeout);

    let { facing: otherFacing } = await facingFor(otherOrg.ids);
    expect(
      await firstPage(await firewallService.listFirewalls({ ...otherFacing, search: token }))
    ).toEqual([]);
  });

  it('archives a firewall, keeps it readable and rejects further changes', async () => {
    let policy = await createPolicy();
    let firewall = await createFirewall({ networkPolicyIds: [policy.id] });
    let { facing } = await facingFor();

    let archived = await firewallService.archiveFirewall({ ...facing, firewall });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let source = await getSource(firewall.id);
    expect(source).toMatchObject({ status: 'archived', needsSubspaceSync: false });
    expect(source.archivedAt).toBeInstanceOf(Date);

    let fetched = await firewallService.getFirewallById({
      ...facing,
      firewallId: firewall.id
    });
    expect(fetched.status).toBe('archived');
    expect(
      await firstPage(await firewallService.listFirewalls({ ...facing, ids: [firewall.id] }))
    ).toEqual([]);
    let archivedList = await firstPage(
      await firewallService.listFirewalls({
        ...facing,
        ids: [firewall.id],
        status: ['archived']
      })
    );
    expect(archivedList.map(item => item.id)).toEqual([firewall.id]);

    let linkedPolicy = await networkPolicyService.getNetworkPolicyById({
      ...facing,
      networkPolicyId: policy.id
    });
    expect(linkedPolicy.firewallLinks.map(link => link.firewall.id)).toEqual([firewall.id]);

    await expectServiceError(
      firewallService.updateFirewall({
        ...facing,
        firewall: archived,
        input: { name: 'Nope' }
      }),
      'gone'
    );
    await expectServiceError(
      firewallService.addFirewallNetworkPolicy({
        ...facing,
        firewall: archived,
        networkPolicyId: (await createPolicy()).id
      }),
      'gone'
    );
    await expectServiceError(
      firewallService.removeFirewallNetworkPolicy({
        ...facing,
        firewall: archived,
        networkPolicyId: policy.id
      }),
      'gone'
    );
    await expectServiceError(
      firewallService.archiveFirewall({ ...facing, firewall: archived }),
      'gone'
    );
  });

  it("isolates firewalls from another organization's instance", async () => {
    let policy = await createPolicy();
    let firewall = await createFirewall({ networkPolicyIds: [policy.id] });
    let { facing: otherFacing } = await facingFor(otherOrg.ids);
    let otherPolicy = await createPolicy(otherOrg.ids);

    await expectServiceError(
      firewallService.getFirewallById({ ...otherFacing, firewallId: firewall.id }),
      'not_found'
    );
    expect(
      await firstPage(
        await firewallService.listFirewalls({ ...otherFacing, ids: [firewall.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await firewallService.listFirewalls({ ...otherFacing, networkPolicyIds: [policy.id] })
      )
    ).toEqual([]);

    await expect(
      firewallService.updateFirewall({
        ...otherFacing,
        firewall,
        input: { name: 'Hijacked', networkPolicyIds: [otherPolicy.id] }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      firewallService.archiveFirewall({ ...otherFacing, firewall })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      firewallService.removeFirewallNetworkPolicy({
        ...otherFacing,
        firewall,
        networkPolicyId: policy.id
      })
    ).rejects.toThrow('Tenant mismatch');

    let source = await getSource(firewall.id);
    expect(source).toMatchObject({ status: 'active', name: firewall.name });
    expect(source.networkPolicyLinks.map(link => link.networkPolicy.id)).toEqual([policy.id]);
  });
});
