import {
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  addDocument,
  badRequest,
  createIntegration,
  createSkill,
  dashboardApi,
  expectResponses,
  expectRoutesAuth,
  forbidden,
  getRoute,
  ids,
  invalid,
  listAuth,
  managementApi,
  memberApi,
  notFound,
  resourceAuth,
  skillClients,
  snapshotSkill,
  uniquePath
} from './_shared';

describe('api-core skills', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  describe('skills', () => {
    it('creates, gets, lists, updates and archives a skill', async () => {
      let api = org.clients.instance;
      let name = uniqueId('e2e-skill');

      let created = await createSkill(api, {
        name,
        description: 'A skill created over REST',
        metadata: { source: 'e2e' },
        client_description: 'Used by the api-core suite'
      });
      expectPresented(created, 'skill');
      expect(created).toMatchObject({
        status: 'active',
        name,
        description: 'A skill created over REST',
        client_description: 'Used by the api-core suite',
        metadata: { source: 'e2e' },
        hierarchy: { object: 'skill.hierarchy', type: 'root', parent_skill_id: null },
        integrations: [],
        providers: []
      });
      expect(created.store_id).toEqual(expect.any(String));
      expect(created.client_name).toEqual(expect.any(String));

      let fetched = expectOk(await api.get(`/skills/${created.id}`));
      expectPresented(fetched, 'skill');
      expect(fetched).toMatchObject({ id: created.id, name, store_id: created.store_id });

      let updated = expectOk(
        await api.patch(`/skills/${created.id}`, {
          name: `${name}-renamed`,
          client_name: 'renamed-skill',
          license: 'MIT'
        })
      );
      expect(updated).toMatchObject({
        id: created.id,
        name: `${name}-renamed`,
        client_name: 'renamed-skill',
        license: 'MIT',
        description: 'A skill created over REST'
      });

      let archived = expectOk(await api.delete(`/skills/${created.id}`));
      expectPresented(archived, 'skill');
      expect(archived).toMatchObject({ id: created.id, status: 'archived' });

      let afterArchive = expectOk(await api.get(`/skills/${created.id}`));
      expect(afterArchive.status).toBe('archived');

      let active = await listAll(api, '/skills', {
        query: { id: created.id, status: 'active' }
      });
      expect(active).toEqual([]);

      let archivedList = await listAll(api, '/skills', {
        query: { id: created.id, status: 'archived' }
      });
      expect(ids(archivedList)).toEqual([created.id]);
    });

    it('serves the same skill to every credential of the instance and hides it from other organizations', async () => {
      let skill = await createSkill(org.clients.instance);
      let clients = skillClients(org, otherOrg, member);

      await expectRoutesAuth(org, clients, [
        getRoute('/skills', listAuth),
        getRoute(`/skills/${skill.id}`, resourceAuth),
        getRoute(`/skills/${skill.id}/items`, resourceAuth),
        getRoute(`/skills/${skill.id}/versions`, resourceAuth),
        getRoute(`/skills/${skill.id}/participants`, resourceAuth),
        getRoute(`/skills/${skill.id}/access`, resourceAuth),
        getRoute(`/skills/${skill.id}/agents`, resourceAuth),
        {
          label: 'PATCH /skills/:id',
          call: (client, route) =>
            client.patch(route(`/skills/${skill.id}`), { description: uniqueId('desc') }),
          expected: resourceAuth
        },
        {
          label: 'POST /skills/:id/duplicate',
          call: (client, route) =>
            client.post(route(`/skills/${skill.id}/duplicate`), { name: uniqueId('dup') }),
          expected: resourceAuth
        }
      ]);

      for (let client of [clients.session, clients.member]) {
        let viaDashboard = expectOk(
          await client.get(`/dashboard/instances/${org.ids.instanceId}/skills/${skill.id}`)
        );
        expect(viaDashboard.id).toBe(skill.id);
      }

      let viaManagement = expectOk(await managementApi(org).get(`/skills/${skill.id}`));
      expect(viaManagement.id).toBe(skill.id);

      let otherList = await listAll(otherOrg.clients.instance, '/skills');
      expect(ids(otherList)).not.toContain(skill.id);
    });

    it('serves deduplicated participants and the access grants of a skill', async () => {
      let created = expectOk(
        await memberApi(org, member).post('/skills', { name: uniqueId('participant-skill') })
      );
      let api = org.clients.instance;

      let participants = await listAll(api, `/skills/${created.id}/participants`, {
        limit: 1
      });
      expect(participants).toHaveLength(1);
      expectPresented(participants[0], 'skill.participant');
      expect(participants[0]).toMatchObject({
        skill_id: created.id,
        roles: ['creator', 'editor']
      });
      expect(participants[0].actor.organization_actor).not.toBeNull();
      expect(participants[0].last_active_at).toEqual(expect.any(String));
      expect(participants[0].surfaces).toHaveLength(1);
      expect(participants[0].surfaces[0]).toMatchObject({ roles: ['creator', 'editor'] });

      let fetched = expectOk(
        await api.get(`/skills/${created.id}/participants/${participants[0].id}`)
      );
      expect(fetched.id).toBe(participants[0].id);

      let access = expectOk(await api.get(`/skills/${created.id}/access`));
      expectPresented(access, 'skill.access');
      expect(access).toEqual({ object: 'skill.access', skill_id: created.id, grants: [] });

      let other = await createSkill(api);
      expectError(
        await api.get(`/skills/${other.id}/participants/${participants[0].id}`),
        404
      );
      expectError(await otherOrg.clients.instance.get(`/skills/${created.id}/access`), 404);
    });

    it('lets a non-admin member create, update and archive skills', async () => {
      let api = memberApi(org, member);

      let created = expectOk(await api.post('/skills', { name: uniqueId('member-skill') }));
      expect(created.status).toBe('active');

      let updated = expectOk(
        await api.patch(`/skills/${created.id}`, { description: 'Edited by a member' })
      );
      expect(updated.description).toBe('Edited by a member');

      let archived = expectOk(await api.delete(`/skills/${created.id}`));
      expect(archived.status).toBe('archived');

      let fromAdmin = expectOk(await org.clients.instance.get(`/skills/${created.id}`));
      expect(fromAdmin.status).toBe('archived');
    });

    it('filters skills by id, status, skill group and integration', async () => {
      let api = org.clients.instance;
      let integration = await createIntegration(api);
      let group = expectOk(await api.post('/skill-groups', { name: uniqueId('e2e-group') }));

      let inGroup = await createSkill(api, { skill_group_id: group.id });
      let withIntegration = await createSkill(api);
      let archived = await createSkill(api);
      expectOk(
        await api.post(`/skills/${withIntegration.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        })
      );
      expectOk(await api.delete(`/skills/${archived.id}`));

      let byGroup = await listAll(api, '/skills', { query: { skill_group_id: group.id } });
      expect(ids(byGroup)).toEqual([inGroup.id]);

      let byIntegration = await listAll(api, '/skills', {
        query: { integration_id: integration.id }
      });
      expect(ids(byIntegration)).toEqual([withIntegration.id]);
      expect(byIntegration[0].integrations.map((item: any) => item.id)).toEqual([
        integration.id
      ]);

      let active = await listAll(api, '/skills', { query: { status: 'active' } });
      expect(ids(active)).toEqual(expect.arrayContaining([inGroup.id, withIntegration.id]));
      expect(ids(active)).not.toContain(archived.id);

      let byId = await listAll(api, '/skills', { query: { id: archived.id } });
      expect(byId.map(skill => [skill.id, skill.status])).toEqual([[archived.id, 'archived']]);
    });

    it('paginates skills without gaps or duplicates', async () => {
      let api = org.clients.instance;
      let created: string[] = [];
      for (let index = 0; index < 5; index++) created.push((await createSkill(api)).id);

      let all = await listAll(api, '/skills', { limit: 2 });
      let listed = ids(all);

      expect(new Set(listed).size).toBe(listed.length);
      expect(listed).toEqual(expect.arrayContaining(created));
      for (let skill of all) expectPresented(skill, 'skill');
    });

    it('rejects invalid skill bodies and queries', async () => {
      let api = org.clients.instance;
      let skill = await createSkill(api);

      await expectResponses([
        invalid('create without a name', () => api.post('/skills', {})),
        invalid('create with a numeric name', () => api.post('/skills', { name: 1 })),
        invalid('create with an uppercase client name', () =>
          api.post('/skills', { name: 'x', client_name: 'Not-Valid' })
        ),
        invalid('create with a dash-leading client name', () =>
          api.post('/skills', { name: 'x', client_name: '-skill' })
        ),
        invalid('create with a double-dash client name', () =>
          api.post('/skills', { name: 'x', client_name: 'my--skill' })
        ),
        invalid('create with an empty license', () =>
          api.post('/skills', { name: 'x', license: '' })
        ),
        invalid('create with string metadata', () =>
          api.post('/skills', { name: 'x', metadata: 'x' })
        ),
        invalid('update with an empty compatibility', () =>
          api.patch(`/skills/${skill.id}`, { compatibility: '' })
        ),
        invalid('duplicate without a name', () =>
          api.post(`/skills/${skill.id}/duplicate`, {})
        ),
        invalid('fork without a name', () => api.post(`/skills/${skill.id}/fork`, {})),
        invalid('share with an unknown permission', () =>
          api.post(`/skills/${skill.id}/shares`, { permission: 'admin' })
        ),
        invalid('list with an unknown status', () =>
          api.get('/skills', { query: { status: 'gone' } })
        ),
        badRequest('update without any field', () => api.patch(`/skills/${skill.id}`, {}))
      ]);
    });

    it('resolves skill group and template references in the instance only', async () => {
      let foreignGroup = expectOk(
        await otherOrg.clients.instance.post('/skill-groups', { name: uniqueId('foreign') })
      );
      let foreignTemplate = expectOk(
        await otherOrg.clients.instance.post('/skill-templates', { name: uniqueId('foreign') })
      );
      let foreignSkill = await createSkill(otherOrg.clients.instance);
      let api = org.clients.instance;

      await expectResponses([
        notFound('create with another organization skill group', () =>
          api.post('/skills', { name: uniqueId('x'), skill_group_id: foreignGroup.id })
        ),
        notFound('create with another organization template', () =>
          api.post('/skills', { name: uniqueId('x'), template_id: foreignTemplate.id })
        ),
        notFound('create with an unknown template', () =>
          api.post('/skills', { name: uniqueId('x'), template_id: 'sktpl_missing' })
        ),
        notFound('get another organization skill', () =>
          api.get(`/skills/${foreignSkill.id}`)
        ),
        notFound('update another organization skill', () =>
          api.patch(`/skills/${foreignSkill.id}`, { name: 'hijacked' })
        ),
        notFound('archive another organization skill', () =>
          api.delete(`/skills/${foreignSkill.id}`)
        ),
        notFound('duplicate another organization skill', () =>
          api.post(`/skills/${foreignSkill.id}/duplicate`, { name: 'x' })
        ),
        notFound('fork another organization skill', () =>
          api.post(`/skills/${foreignSkill.id}/fork`, { name: 'x' })
        ),
        notFound('get an unknown skill', () => api.get('/skills/skl_missing'))
      ]);

      let untouched = expectOk(
        await otherOrg.clients.instance.get(`/skills/${foreignSkill.id}`)
      );
      expect(untouched).toMatchObject({ status: 'active', name: foreignSkill.name });
    });

    it('duplicates a skill with its integrations, and forks duplicate for non-consumers', async () => {
      let api = org.clients.instance;
      let integration = await createIntegration(api);
      let original = await createSkill(api);
      expectOk(
        await api.post(`/skills/${original.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        })
      );

      let duplicateName = uniqueId('duplicate');
      let duplicate = expectOk(
        await api.post(`/skills/${original.id}/duplicate`, {
          name: duplicateName,
          description: 'Duplicated over REST'
        })
      );
      expectPresented(duplicate, 'skill');
      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate).toMatchObject({
        status: 'active',
        name: duplicateName,
        description: 'Duplicated over REST',
        hierarchy: { type: 'duplicated', parent_skill_id: original.id }
      });
      expect(duplicate.store_id).not.toBe(original.store_id);
      expect(duplicate.integrations.map((item: any) => item.id)).toEqual([integration.id]);

      let forked = expectOk(
        await dashboardApi(org).post(`/skills/${original.id}/fork`, { name: uniqueId('fork') })
      );
      expect(forked.hierarchy).toMatchObject({
        type: 'duplicated',
        parent_skill_id: original.id
      });
      expect(forked.integrations.map((item: any) => item.id)).toEqual([integration.id]);
    });

    it('keeps consumer-only publishing and member sharing away from organization credentials', async () => {
      let skill = await createSkill(org.clients.instance);
      let api = org.clients.instance;

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        {
          label: 'POST /skills/:id/publish',
          call: (client, route) => client.post(route(`/skills/${skill.id}/publish`)),
          expected: { none: 401, session: 403, member: 403, management: 403, instance: 403 }
        }
      ]);

      await expectResponses([
        badRequest('share without any target', () =>
          api.post(`/skills/${skill.id}/shares`, { permission: 'read' })
        ),
        forbidden('share with organization members', () =>
          api.post(`/skills/${skill.id}/shares`, {
            permission: 'read',
            organization_member_ids: [member.member.id]
          })
        ),
        notFound('share with an unknown consumer profile', () =>
          api.post(`/skills/${skill.id}/shares`, {
            permission: 'read',
            consumer_profile_ids: ['cpr_missing']
          })
        )
      ]);
    });
  });

  describe('skill items', () => {
    it('adds, gets, lists and archives an integration item', async () => {
      let api = org.clients.instance;
      let skill = await createSkill(api);
      let integration = await createIntegration(api);

      let item = expectOk(
        await api.post(`/skills/${skill.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        })
      );
      expectPresented(item, 'skill.item');
      expect(item).toMatchObject({
        status: 'active',
        type: 'integration',
        skill_id: skill.id,
        integration: { id: integration.id },
        provider: null
      });

      let fetched = expectOk(await api.get(`/skills/${skill.id}/items/${item.id}`));
      expect(fetched).toMatchObject({ id: item.id, integration: { id: integration.id } });

      let byType = await listAll(api, `/skills/${skill.id}/items`, {
        query: { type: 'integration' }
      });
      expect(ids(byType)).toEqual([item.id]);

      let byProvider = await listAll(api, `/skills/${skill.id}/items`, {
        query: { type: 'provider' }
      });
      expect(byProvider).toEqual([]);

      let withSkill = expectOk(await api.get(`/skills/${skill.id}`));
      expect(withSkill.integrations.map((entry: any) => entry.id)).toEqual([integration.id]);

      let duplicate = await api.post(`/skills/${skill.id}/items`, {
        type: 'integration',
        integration_id: integration.id
      });
      expectError(duplicate, 400, 'skill_item_exists');

      let archived = expectOk(await api.delete(`/skills/${skill.id}/items/${item.id}`));
      expectPresented(archived, 'skill.item');
      expect(archived.status).toBe('archived');

      let active = await listAll(api, `/skills/${skill.id}/items`, {
        query: { status: 'active' }
      });
      expect(active).toEqual([]);
    });

    it('rejects invalid items and references outside the instance', async () => {
      let api = org.clients.instance;
      let skill = await createSkill(api);
      let otherSkill = await createSkill(api);
      let integration = await createIntegration(api);
      let foreignIntegration = await createIntegration(otherOrg.clients.instance);
      let foreignSkill = await createSkill(otherOrg.clients.instance);
      let item = expectOk(
        await api.post(`/skills/${otherSkill.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        })
      );

      await expectResponses([
        invalid('item without a type', () =>
          api.post(`/skills/${skill.id}/items`, { integration_id: integration.id })
        ),
        invalid('item with an unknown type', () =>
          api.post(`/skills/${skill.id}/items`, {
            type: 'tool',
            integration_id: integration.id
          })
        ),
        invalid('provider item without a provider id', () =>
          api.post(`/skills/${skill.id}/items`, { type: 'provider' })
        ),
        invalid('integration item without an integration id', () =>
          api.post(`/skills/${skill.id}/items`, { type: 'integration' })
        ),
        invalid('list items with an unknown type', () =>
          api.get(`/skills/${skill.id}/items`, { query: { type: 'tool' } })
        ),
        notFound('item with another organization integration', () =>
          api.post(`/skills/${skill.id}/items`, {
            type: 'integration',
            integration_id: foreignIntegration.id
          })
        ),
        notFound('item with an unknown provider', () =>
          api.post(`/skills/${skill.id}/items`, {
            type: 'provider',
            provider_id: 'pro_missing'
          })
        ),
        notFound('item on another organization skill', () =>
          api.post(`/skills/${foreignSkill.id}/items`, {
            type: 'integration',
            integration_id: integration.id
          })
        ),
        notFound('get an item through another skill', () =>
          api.get(`/skills/${skill.id}/items/${item.id}`)
        ),
        notFound('archive an item through another skill', () =>
          api.delete(`/skills/${skill.id}/items/${item.id}`)
        ),
        notFound('get an unknown item', () =>
          api.get(`/skills/${skill.id}/items/skli_missing`)
        )
      ]);

      let stillActive = expectOk(await api.get(`/skills/${otherSkill.id}/items/${item.id}`));
      expect(stillActive.status).toBe('active');
    });

    it('does not add items to an archived skill', async () => {
      let api = org.clients.instance;
      let skill = await createSkill(api);
      let integration = await createIntegration(api);
      expectOk(await api.delete(`/skills/${skill.id}`));

      let response = await api.post(`/skills/${skill.id}/items`, {
        type: 'integration',
        integration_id: integration.id
      });
      expectError(response, 404);
    });
  });

  describe('skill versions', () => {
    it('lists, gets and snapshots versions of a skill', async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let api = org.clients.instance;
      let skill = await createSkill(api);
      let path = uniquePath('versioned');

      expect(await listAll(api, `/skills/${skill.id}/versions`)).toEqual([]);

      await addDocument(fixture, skill.id, path, 'versioned content');
      await snapshotSkill(fixture, skill.id);

      let versions = await listAll(api, `/skills/${skill.id}/versions`);
      expect(versions).toHaveLength(1);
      expectPresented(versions[0], 'skill.version');
      expect(versions[0]).toMatchObject({
        skill_id: skill.id,
        store_id: skill.store_id,
        version_number: 1
      });

      let version = expectOk(await api.get(`/skills/${skill.id}/versions/${versions[0].id}`));
      expect(version).toMatchObject({ id: versions[0].id, version_number: 1 });

      let snapshot = expectOk(
        await api.get(`/skills/${skill.id}/versions/${versions[0].id}/snapshot`)
      );
      expectPresented(snapshot, 'skill.version.snapshot');
      expect(snapshot).toMatchObject({ skill_id: skill.id, version_number: 1 });
      expect(snapshot.items.map((item: any) => item.path)).toContain(path);
    });

    it('scopes versions to their skill and organization', async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let api = org.clients.instance;
      let skill = await createSkill(api);
      let sibling = await createSkill(api);
      await addDocument(fixture, skill.id, uniquePath(), 'content');
      await snapshotSkill(fixture, skill.id);

      let [version] = await listAll(api, `/skills/${skill.id}/versions`);
      let clients = skillClients(org, otherOrg, member);

      await expectRoutesAuth(org, clients, [
        getRoute(`/skills/${skill.id}/versions/${version.id}`, resourceAuth),
        getRoute(`/skills/${skill.id}/versions/${version.id}/snapshot`, resourceAuth)
      ]);

      await expectResponses([
        notFound('version through another skill', () =>
          api.get(`/skills/${sibling.id}/versions/${version.id}`)
        ),
        notFound('snapshot through another skill', () =>
          api.get(`/skills/${sibling.id}/versions/${version.id}/snapshot`)
        ),
        notFound('unknown version', () => api.get(`/skills/${skill.id}/versions/sklv_missing`))
      ]);
    });
  });

  describe('skill participants', () => {
    it('lists the creator as a participant and scopes participants to their skill', async () => {
      let api = dashboardApi(org);
      let skill = await createSkill(api);
      let sibling = await createSkill(api);

      let participants = await listAll(api, `/skills/${skill.id}/participants`);
      let creator = participants.find(participant => participant.roles.includes('creator'));
      expect(creator).toBeDefined();
      expectPresented(creator, 'skill.participant');
      expect(creator.skill_id).toBe(skill.id);

      let fetched = expectOk(await api.get(`/skills/${skill.id}/participants/${creator.id}`));
      expect(fetched).toMatchObject({ id: creator.id, skill_id: skill.id });

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute(`/skills/${skill.id}/participants/${creator.id}`, resourceAuth)
      ]);

      await expectResponses([
        notFound('participant through another skill', () =>
          api.get(`/skills/${sibling.id}/participants/${creator.id}`)
        ),
        notFound('unknown participant', () =>
          api.get(`/skills/${skill.id}/participants/sklp_missing`)
        )
      ]);
    });
  });

  describe('skill agents', () => {
    it('creates, gets, lists, updates and archives an agent', async () => {
      let api = org.clients.instance;
      let skill = await createSkill(api);

      let agent = expectOk(
        await api.post(`/skills/${skill.id}/agents`, {
          name: 'Code Reviewer',
          description: 'Reviews code',
          content: 'Review every change carefully.'
        })
      );
      expectPresented(agent, 'skill.agent');
      expect(agent).toMatchObject({
        skill_id: skill.id,
        name: 'Code Reviewer',
        description: 'Reviews code',
        status: 'active',
        store_id: skill.store_id,
        archived_at: null
      });
      expect(agent.path).toMatch(/^\/agents\//);

      let fetched = expectOk(await api.get(`/skills/${skill.id}/agents/${agent.id}`));
      expect(fetched).toMatchObject({ id: agent.id, name: 'Code Reviewer' });

      let updated = expectOk(
        await api.patch(`/skills/${skill.id}/agents/${agent.id}`, {
          name: 'Senior Reviewer',
          description: 'Reviews code thoroughly'
        })
      );
      expect(updated).toMatchObject({
        id: agent.id,
        name: 'Senior Reviewer',
        description: 'Reviews code thoroughly'
      });

      expect(ids(await listAll(api, `/skills/${skill.id}/agents`))).toEqual([agent.id]);

      let archived = expectOk(await api.delete(`/skills/${skill.id}/agents/${agent.id}`));
      expectPresented(archived, 'skill.agent');
      expect(archived.status).toBe('archived');
      expect(archived.archived_at).not.toBeNull();

      expect(await listAll(api, `/skills/${skill.id}/agents`)).toEqual([]);

      let withArchived = await listAll(api, `/skills/${skill.id}/agents`, {
        query: { include_archived: true }
      });
      expect(ids(withArchived)).toEqual([agent.id]);
    });

    it('rejects invalid agents and agents of other skills', async () => {
      let api = org.clients.instance;
      let skill = await createSkill(api);
      let sibling = await createSkill(api);
      let foreignSkill = await createSkill(otherOrg.clients.instance);
      let agent = expectOk(await api.post(`/skills/${skill.id}/agents`, { name: 'Helper' }));

      await expectResponses([
        invalid('agent without a name', () => api.post(`/skills/${skill.id}/agents`, {})),
        invalid('agent with a numeric description', () =>
          api.post(`/skills/${skill.id}/agents`, { name: 'x', description: 1 })
        ),
        badRequest('agent update without any field', () =>
          api.patch(`/skills/${skill.id}/agents/${agent.id}`, {})
        ),
        notFound('agent through another skill', () =>
          api.get(`/skills/${sibling.id}/agents/${agent.id}`)
        ),
        notFound('update an agent through another skill', () =>
          api.patch(`/skills/${sibling.id}/agents/${agent.id}`, { name: 'hijacked' })
        ),
        notFound('archive an agent through another skill', () =>
          api.delete(`/skills/${sibling.id}/agents/${agent.id}`)
        ),
        notFound('agent on another organization skill', () =>
          api.post(`/skills/${foreignSkill.id}/agents`, { name: 'x' })
        )
      ]);

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute(`/skills/${skill.id}/agents/${agent.id}`, resourceAuth),
        {
          label: 'POST /skills/:id/agents',
          call: (client, route) =>
            client.post(route(`/skills/${skill.id}/agents`), { name: uniqueId('agent') }),
          expected: resourceAuth
        }
      ]);

      let untouched = expectOk(await api.get(`/skills/${skill.id}/agents/${agent.id}`));
      expect(untouched).toMatchObject({ name: 'Helper', status: 'active' });
    });
  });
});
