import {
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import {
  badRequest,
  createSkill,
  dashboardApi,
  dashboardOnlyResourceAuth,
  expectResponses,
  expectRoutesAuth,
  getRoute,
  ids,
  invalid,
  listAuth,
  memberApi,
  notFound,
  resourceAuth,
  seedMarketplace,
  seedPlugin,
  skillClients
} from './_shared';

describe('api-core skill marketplaces and plugins', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let seed = async (organization = org) => {
    let fixture = await loadOrganizationFixture(organization.ids);
    let marketplace = await seedMarketplace(fixture);
    let plugin = await seedPlugin(fixture);

    return { fixture, marketplace, plugin };
  };

  let seedMembership = async (
    marketplace: { oid: bigint },
    plugin: { oid: bigint; slug: string | null }
  ) =>
    await db.skillMarketplacePlugin.create({
      data: {
        id: await ID.generateId('skillMarketplacePlugin'),
        status: 'active',
        pluginSlug: plugin.slug!,
        skillMarketplaceOid: marketplace.oid,
        skillPluginOid: plugin.oid
      }
    });

  describe('marketplaces', () => {
    it('gets, lists, updates and archives a marketplace', async () => {
      let api = org.clients.instance;
      let { marketplace, plugin } = await seed();
      await seedMembership(marketplace, plugin);

      let fetched = expectOk(await api.get(`/skill-marketplaces/${marketplace.id}`));
      expectPresented(fetched, 'skill.marketplace');
      expect(fetched).toMatchObject({
        id: marketplace.id,
        status: 'active',
        name: marketplace.name,
        slug: marketplace.slug,
        skill_configuration_id: null
      });
      expect(fetched.plugins).toHaveLength(1);

      let listed = await listAll(api, '/skill-marketplaces', {
        query: { id: marketplace.id }
      });
      expect(ids(listed)).toEqual([marketplace.id]);

      let configuration = expectOk(await api.post('/skills/configurations', {}));
      let updated = expectOk(
        await api.patch(`/skill-marketplaces/${marketplace.id}`, {
          force_merge_or_push: true,
          merge_before_checks_pass: true,
          repository_access_mode: 'default_branch',
          skill_configuration_id: configuration.id
        })
      );
      expect(updated).toMatchObject({
        id: marketplace.id,
        force_merge_or_push: true,
        merge_before_checks_pass: true,
        repository_access_mode: 'default_branch',
        skill_configuration_id: configuration.id
      });

      let byConfiguration = await listAll(api, '/skill-marketplaces', {
        query: { skill_configuration_id: configuration.id }
      });
      expect(ids(byConfiguration)).toEqual([marketplace.id]);

      let archived = expectOk(await api.delete(`/skill-marketplaces/${marketplace.id}`));
      expectPresented(archived, 'skill.marketplace');
      expect(archived.status).toBe('archived');

      let active = await listAll(api, '/skill-marketplaces', {
        query: { id: marketplace.id, status: 'active' }
      });
      expect(active).toEqual([]);

      let memberships = await listAll(api, `/skill-marketplaces/${marketplace.id}/plugins`, {
        query: { status: 'active' }
      });
      expect(memberships).toEqual([]);
    });

    it('serves marketplaces to every instance credential and hides them from other organizations', async () => {
      let { marketplace } = await seed();
      let clients = skillClients(org, otherOrg, member);
      let base = `/skill-marketplaces/${marketplace.id}`;

      await expectRoutesAuth(org, clients, [
        getRoute('/skill-marketplaces', listAuth),
        getRoute(base, resourceAuth),
        getRoute(`${base}/plugins`, resourceAuth),
        getRoute(`${base}/repositories`, {
          ...dashboardOnlyResourceAuth,
          management: 403
        }),
        {
          label: 'PATCH /skill-marketplaces/:id',
          call: (client, route) => client.patch(route(base), { force_merge_or_push: false }),
          expected: resourceAuth
        },
        {
          label: 'POST /skill-marketplaces/:id/editor-url',
          call: (client, route) => client.post(route(`${base}/editor-url`), {}),
          expected: {
            none: 401,
            management: 403,
            instance: 404,
            otherSession: 404,
            otherManagement: 404,
            otherInstance: 404
          }
        }
      ]);

      let repositories = await listAll(dashboardApi(org), `${base}/repositories`);
      expect(repositories).toEqual([]);

      let otherList = await listAll(otherOrg.clients.instance, '/skill-marketplaces');
      expect(ids(otherList)).not.toContain(marketplace.id);

      let otherApi = otherOrg.clients.instance;
      await expectResponses([
        notFound('update another organization marketplace', () =>
          otherApi.patch(base, { force_merge_or_push: true })
        ),
        notFound('archive another organization marketplace', () => otherApi.delete(base)),
        notFound('sync another organization marketplace', () =>
          otherApi.post(`${base}/sync`, {})
        )
      ]);

      let untouched = expectOk(await org.clients.instance.get(base));
      expect(untouched).toMatchObject({ status: 'active', force_merge_or_push: false });
    });

    it('rejects invalid marketplace bodies and references outside the instance', async () => {
      let api = org.clients.instance;
      let { marketplace } = await seed();
      let foreignConfiguration = expectOk(
        await otherOrg.clients.instance.post('/skills/configurations', {})
      );

      await expectResponses([
        invalid('create without a name', () => api.post('/skill-marketplaces', {})),
        invalid('create with an unknown repository access mode', () =>
          api.post('/skill-marketplaces', { name: 'x', repository_access_mode: 'fork' })
        ),
        invalid('create with string force_merge_or_push', () =>
          api.post('/skill-marketplaces', { name: 'x', force_merge_or_push: 'yes' })
        ),
        invalid('update with a numeric name', () =>
          api.patch(`/skill-marketplaces/${marketplace.id}`, { name: 1 })
        ),
        invalid('list with an unknown status', () =>
          api.get('/skill-marketplaces', { query: { status: 'gone' } })
        ),
        badRequest('update without any field', () =>
          api.patch(`/skill-marketplaces/${marketplace.id}`, {})
        ),
        notFound('update with another organization configuration', () =>
          api.patch(`/skill-marketplaces/${marketplace.id}`, {
            skill_configuration_id: foreignConfiguration.id
          })
        ),
        notFound('create with another organization configuration', () =>
          api.post('/skill-marketplaces', {
            name: uniqueId('x'),
            skill_configuration_id: foreignConfiguration.id
          })
        ),
        notFound('unknown marketplace', () => api.get('/skill-marketplaces/skmkt_missing'))
      ]);

      let unchanged = expectOk(await api.get(`/skill-marketplaces/${marketplace.id}`));
      expect(unchanged.skill_configuration_id).toBeNull();
    });
  });

  describe('marketplace plugins', () => {
    it('adds, gets, lists and removes a plugin from a marketplace', async () => {
      let api = org.clients.instance;
      let { marketplace, plugin } = await seed();
      let base = `/skill-marketplaces/${marketplace.id}/plugins`;

      let added = expectOk(
        await api.post(base, { skill_plugin_id: plugin.id, identifier: 'e2e-plugin' })
      );
      expectPresented(added, 'skill.marketplace_plugin');
      expect(added).toMatchObject({
        status: 'active',
        identifier: 'e2e-plugin',
        skill_marketplace_id: marketplace.id,
        skill_plugin: { id: plugin.id }
      });

      let fetched = expectOk(await api.get(`${base}/${added.id}`));
      expect(fetched).toMatchObject({ id: added.id, identifier: 'e2e-plugin' });

      let byPlugin = await listAll(api, base, { query: { skill_plugin_id: plugin.id } });
      expect(ids(byPlugin)).toEqual([added.id]);

      let byMarketplace = await listAll(api, '/skill-plugins', {
        query: { skill_marketplace_id: marketplace.id }
      });
      expect(ids(byMarketplace)).toEqual([plugin.id]);

      let removed = expectOk(await api.delete(`${base}/${added.id}`));
      expectPresented(removed, 'skill.marketplace_plugin');
      expect(removed.status).toBe('archived');

      let active = await listAll(api, base, { query: { status: 'active' } });
      expect(active).toEqual([]);
    });

    it('rejects plugins and configurations from outside the instance', async () => {
      let api = org.clients.instance;
      let { marketplace, plugin } = await seed();
      let other = await seed();
      let foreign = await seed(otherOrg);
      let foreignConfiguration = expectOk(
        await otherOrg.clients.instance.post('/skills/configurations', {})
      );
      let membership = await seedMembership(other.marketplace, other.plugin);
      let base = `/skill-marketplaces/${marketplace.id}/plugins`;

      await expectResponses([
        invalid('add without a plugin id', () => api.post(base, {})),
        invalid('add with a numeric identifier', () =>
          api.post(base, { skill_plugin_id: plugin.id, identifier: 1 })
        ),
        notFound('add another organization plugin', () =>
          api.post(base, { skill_plugin_id: foreign.plugin.id })
        ),
        notFound('add with another organization configuration', () =>
          api.post(base, {
            skill_plugin_id: plugin.id,
            skill_configuration_id: foreignConfiguration.id
          })
        ),
        notFound('add to another organization marketplace', () =>
          api.post(`/skill-marketplaces/${foreign.marketplace.id}/plugins`, {
            skill_plugin_id: plugin.id
          })
        ),
        notFound('get a membership through another marketplace', () =>
          api.get(`${base}/${membership.id}`)
        ),
        notFound('remove a membership through another marketplace', () =>
          api.delete(`${base}/${membership.id}`)
        )
      ]);

      expect(await listAll(api, base)).toEqual([]);
      let stillActive = expectOk(
        await api.get(`/skill-marketplaces/${other.marketplace.id}/plugins/${membership.id}`)
      );
      expect(stillActive.status).toBe('active');
    });
  });

  describe('plugins', () => {
    it('gets, lists, updates and archives a plugin', async () => {
      let api = org.clients.instance;
      let { plugin } = await seed();

      let fetched = expectOk(await api.get(`/skill-plugins/${plugin.id}`));
      expectPresented(fetched, 'skill.plugin');
      expect(fetched).toMatchObject({
        id: plugin.id,
        status: 'active',
        name: plugin.name,
        category: 'testing',
        skills: []
      });

      let byCategory = await listAll(api, '/skill-plugins', {
        query: { id: plugin.id, category: 'testing' }
      });
      expect(ids(byCategory)).toEqual([plugin.id]);
      expect(
        await listAll(api, '/skill-plugins', { query: { id: plugin.id, category: 'other' } })
      ).toEqual([]);

      let configuration = expectOk(await api.post('/skills/configurations', {}));
      let updated = expectOk(
        await api.patch(`/skill-plugins/${plugin.id}`, {
          skill_configuration_id: configuration.id
        })
      );
      expect(updated).toMatchObject({
        id: plugin.id,
        skill_configuration_id: configuration.id
      });

      let archived = expectOk(await api.delete(`/skill-plugins/${plugin.id}`));
      expectPresented(archived, 'skill.plugin');
      expect(archived.status).toBe('archived');

      let active = await listAll(api, '/skill-plugins', {
        query: { id: plugin.id, status: 'active' }
      });
      expect(active).toEqual([]);
    });

    it('serves plugins to every instance credential and hides them from other organizations', async () => {
      let { plugin } = await seed();
      let clients = skillClients(org, otherOrg, member);
      let base = `/skill-plugins/${plugin.id}`;

      await expectRoutesAuth(org, clients, [
        getRoute('/skill-plugins', listAuth),
        getRoute(base, resourceAuth),
        getRoute(`${base}/skills`, resourceAuth),
        getRoute(`${base}/repositories`, { ...dashboardOnlyResourceAuth, management: 403 }),
        {
          label: 'POST /skill-plugins/:id/editor-url',
          call: (client, route) => client.post(route(`${base}/editor-url`), {}),
          expected: {
            none: 401,
            management: 403,
            instance: 404,
            otherSession: 404,
            otherManagement: 404,
            otherInstance: 404
          }
        }
      ]);

      expect(await listAll(memberApi(org, member), `${base}/repositories`)).toEqual([]);

      let otherApi = otherOrg.clients.instance;
      await expectResponses([
        notFound('update another organization plugin', () =>
          otherApi.patch(base, { description: 'hijacked' })
        ),
        notFound('archive another organization plugin', () => otherApi.delete(base)),
        notFound('sync another organization plugin', () => otherApi.post(`${base}/sync`, {}))
      ]);

      let untouched = expectOk(await org.clients.instance.get(base));
      expect(untouched).toMatchObject({ status: 'active', description: plugin.description });
    });

    it('rejects invalid plugin bodies and references outside the instance', async () => {
      let api = org.clients.instance;
      let { plugin } = await seed();
      let foreign = await seed(otherOrg);

      await expectResponses([
        invalid('create without a name', () => api.post('/skill-plugins', {})),
        invalid('create with a numeric category', () =>
          api.post('/skill-plugins', { name: 'x', category: 1 })
        ),
        invalid('update with a numeric description', () =>
          api.patch(`/skill-plugins/${plugin.id}`, { description: 1 })
        ),
        invalid('list with an unknown status', () =>
          api.get('/skill-plugins', { query: { status: 'gone' } })
        ),
        badRequest('update without any field', () =>
          api.patch(`/skill-plugins/${plugin.id}`, {})
        ),
        notFound('create in another organization marketplace', () =>
          api.post('/skill-plugins', {
            name: uniqueId('x'),
            skill_marketplace_id: foreign.marketplace.id
          })
        ),
        notFound('unknown plugin', () => api.get('/skill-plugins/skplg_missing'))
      ]);
    });
  });

  describe('plugin skills', () => {
    it('adds, gets, lists, updates and removes a skill from a plugin', async () => {
      let api = org.clients.instance;
      let { plugin } = await seed();
      let skill = await createSkill(api);
      let base = `/skill-plugins/${plugin.id}/skills`;

      let added = expectOk(
        await api.post(base, {
          skill_id: skill.id,
          identifier: 'e2e-skill',
          client_description: 'Shipped in the plugin'
        })
      );
      expectPresented(added, 'skill.plugin_skill');
      expect(added).toMatchObject({
        status: 'active',
        identifier: 'e2e-skill',
        skill_id: skill.id,
        client_description: 'Shipped in the plugin'
      });

      let fetched = expectOk(await api.get(`${base}/${added.id}`));
      expect(fetched).toMatchObject({ id: added.id, skill_id: skill.id });

      let bySkill = await listAll(api, base, { query: { skill_id: skill.id } });
      expect(ids(bySkill)).toEqual([added.id]);

      let updated = expectOk(
        await api.patch(`${base}/${added.id}`, { license: 'MIT', client_description: null })
      );
      expect(updated).toMatchObject({
        id: added.id,
        license: 'MIT',
        client_description: null
      });

      let withSkills = expectOk(await api.get(`/skill-plugins/${plugin.id}`));
      expect(withSkills.skills.map((entry: any) => entry.skill_id ?? entry.skill?.id)).toEqual(
        [skill.id]
      );

      let removed = expectOk(await api.delete(`${base}/${added.id}`));
      expectPresented(removed, 'skill.plugin_skill');
      expect(removed.status).toBe('archived');

      let active = await listAll(api, base, { query: { status: 'active' } });
      expect(active).toEqual([]);
    });

    it('rejects skills and memberships from outside the plugin or instance', async () => {
      let api = org.clients.instance;
      let { plugin } = await seed();
      let other = await seed();
      let foreign = await seed(otherOrg);
      let skill = await createSkill(api);
      let foreignSkill = await createSkill(otherOrg.clients.instance);
      let membership = expectOk(
        await api.post(`/skill-plugins/${other.plugin.id}/skills`, { skill_id: skill.id })
      );
      let base = `/skill-plugins/${plugin.id}/skills`;

      await expectResponses([
        invalid('add without a skill id', () => api.post(base, {})),
        invalid('add with a numeric identifier', () =>
          api.post(base, { skill_id: skill.id, identifier: 1 })
        ),
        invalid('update with string client metadata', () =>
          api.patch(`/skill-plugins/${other.plugin.id}/skills/${membership.id}`, {
            client_metadata: 'x'
          })
        ),
        notFound('add another organization skill', () =>
          api.post(base, { skill_id: foreignSkill.id })
        ),
        notFound('add to another organization plugin', () =>
          api.post(`/skill-plugins/${foreign.plugin.id}/skills`, { skill_id: skill.id })
        ),
        notFound('get a membership through another plugin', () =>
          api.get(`${base}/${membership.id}`)
        ),
        notFound('update a membership through another plugin', () =>
          api.patch(`${base}/${membership.id}`, { license: 'MIT' })
        ),
        notFound('remove a membership through another plugin', () =>
          api.delete(`${base}/${membership.id}`)
        )
      ]);

      expect(await listAll(api, base)).toEqual([]);
      let untouched = expectOk(
        await api.get(`/skill-plugins/${other.plugin.id}/skills/${membership.id}`)
      );
      expect(untouched).toMatchObject({ status: 'active', license: null });
    });
  });

  describe('syncs', () => {
    it('records a forced marketplace sync and serves it to dashboard sessions only', async () => {
      let { marketplace } = await seed();
      let dashboard = dashboardApi(org);

      let synced = expectOk(
        await org.clients.instance.post(`/skill-marketplaces/${marketplace.id}/sync`, {})
      );
      expectPresented(synced, 'skill.marketplace');
      expect(synced.id).toBe(marketplace.id);

      let syncs = await listAll(dashboard, '/skill-syncs', {
        query: { skill_marketplace_id: marketplace.id }
      });
      expect(syncs).toHaveLength(1);
      expectPresented(syncs[0], 'skill.sync');
      expect(syncs[0]).toMatchObject({
        skill_marketplace_id: marketplace.id,
        skill_plugin_id: null
      });

      let fetched = expectOk(await dashboard.get(`/skill-syncs/${syncs[0].id}`));
      expect(fetched).toMatchObject({ id: syncs[0].id, skill_marketplace_id: marketplace.id });

      let syncPath = `/dashboard/instances/${org.ids.instanceId}/skill-syncs`;
      let outsider = rest(metorialEndpoints().api, { session: otherOrg.session });
      let none = rest(metorialEndpoints().api);

      await expectResponses([
        { label: 'list without credentials', call: () => none.get(syncPath), status: 401 },
        {
          label: 'list with a management key',
          call: () => org.clients.management.get(syncPath),
          status: 403
        },
        {
          label: 'list as another organization',
          call: () => outsider.get(syncPath),
          status: 404
        },
        {
          label: 'get as another organization',
          call: () => outsider.get(`${syncPath}/${syncs[0].id}`),
          status: 404
        },
        {
          label: 'get with a management key',
          call: () => org.clients.management.get(`${syncPath}/${syncs[0].id}`),
          status: 403
        },
        {
          label: 'repository checks with a management key',
          call: () =>
            org.clients.management.get(`${syncPath}/${syncs[0].id}/repository-checks`),
          status: 403
        },
        {
          label: 'repository checks as another organization',
          call: () => outsider.get(`${syncPath}/${syncs[0].id}/repository-checks`),
          status: 404
        },
        {
          label: 'list with an unknown status',
          call: () => dashboard.get('/skill-syncs', { query: { status: 'gone' } }),
          status: 400,
          code: 'invalid_data'
        },
        {
          label: 'unknown sync',
          call: () => dashboard.get('/skill-syncs/sksyn_missing'),
          status: 404
        }
      ]);

      let viaMember = expectOk(
        await memberApi(org, member).get(`/skill-syncs/${syncs[0].id}`)
      );
      expect(viaMember.id).toBe(syncs[0].id);

      let foreignSyncs = await listAll(
        rest(metorialEndpoints().api, { session: otherOrg.session }),
        `/dashboard/instances/${otherOrg.ids.instanceId}/skill-syncs`,
        { query: { skill_marketplace_id: marketplace.id } }
      );
      expect(foreignSyncs).toEqual([]);
    });

    it('records a forced plugin sync', async () => {
      let { plugin } = await seed();

      let synced = expectOk(
        await org.clients.instance.post(`/skill-plugins/${plugin.id}/sync`, {})
      );
      expectPresented(synced, 'skill.plugin');

      let syncs = await listAll(dashboardApi(org), '/skill-syncs', {
        query: { skill_plugin_id: plugin.id }
      });
      expect(syncs.map(sync => sync.skill_plugin_id)).toEqual([plugin.id]);

      expectError(await org.clients.instance.get(`/skill-syncs/${syncs[0].id}`), 404);
    });
  });
});
