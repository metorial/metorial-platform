import {
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  badRequest,
  createSkill,
  expectResponses,
  expectRoutesAuth,
  getRoute,
  ids,
  invalid,
  listAuth,
  memberApi,
  notFound,
  resourceAuth,
  skillClients
} from './_shared';

describe('api-core skill groups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let createGroup = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/skill-groups', {
        name: uniqueId('e2e-group'),
        ...body
      })
    );

  describe('groups', () => {
    it('creates, gets, lists, updates and archives a group', async () => {
      let api = org.clients.instance;
      let first = await createSkill(api);
      let second = await createSkill(api);
      let name = uniqueId('e2e-group');

      let group = await createGroup({
        name,
        description: 'Grouped over REST',
        metadata: { team: 'e2e' },
        skill_ids: [first.id],
        allow_consumer_skill_assignment: true
      });
      expectPresented(group, 'skill.group');
      expect(group).toMatchObject({
        status: 'active',
        name,
        description: 'Grouped over REST',
        metadata: { team: 'e2e' },
        allow_consumer_skill_assignment: true
      });
      expect(ids(group.skills)).toEqual([first.id]);

      let fetched = expectOk(await api.get(`/skill-groups/${group.id}`));
      expect(fetched).toMatchObject({ id: group.id, name });

      let updated = expectOk(
        await api.patch(`/skill-groups/${group.id}`, {
          name: `${name}-renamed`,
          description: null,
          skill_ids: [second.id],
          allow_consumer_skill_assignment: false
        })
      );
      expect(updated).toMatchObject({
        id: group.id,
        name: `${name}-renamed`,
        description: null,
        allow_consumer_skill_assignment: false
      });
      expect(ids(updated.skills)).toEqual([second.id]);

      let bySkill = await listAll(api, '/skill-groups', { query: { skill_id: second.id } });
      expect(ids(bySkill)).toEqual([group.id]);
      expect(await listAll(api, '/skill-groups', { query: { skill_id: first.id } })).toEqual(
        []
      );

      let archived = expectOk(await api.delete(`/skill-groups/${group.id}`));
      expectPresented(archived, 'skill.group');
      expect(archived.status).toBe('archived');

      let active = await listAll(api, '/skill-groups', {
        query: { id: group.id, status: 'active' }
      });
      expect(active).toEqual([]);

      let archivedList = await listAll(api, '/skill-groups', {
        query: { id: group.id, status: 'archived' }
      });
      expect(ids(archivedList)).toEqual([group.id]);
    });

    it('ignores skills of other organizations and archived skills when grouping', async () => {
      let api = org.clients.instance;
      let skill = await createSkill(api);
      let archived = await createSkill(api);
      let foreign = await createSkill(otherOrg.clients.instance);
      expectOk(await api.delete(`/skills/${archived.id}`));

      let group = await createGroup({ skill_ids: [skill.id, archived.id, foreign.id] });
      expect(ids(group.skills)).toEqual([skill.id]);

      let updated = expectOk(
        await api.patch(`/skill-groups/${group.id}`, { skill_ids: [foreign.id] })
      );
      expect(updated.skills).toEqual([]);

      let foreignGroups = await listAll(otherOrg.clients.instance, '/skill-groups', {
        query: { skill_id: foreign.id }
      });
      expect(foreignGroups).toEqual([]);
    });

    it('serves groups to every instance credential and hides them from other organizations', async () => {
      let group = await createGroup();
      let clients = skillClients(org, otherOrg, member);

      await expectRoutesAuth(org, clients, [
        getRoute('/skill-groups', listAuth),
        getRoute(`/skill-groups/${group.id}`, resourceAuth),
        getRoute(`/skill-groups/${group.id}/items`, resourceAuth),
        {
          label: 'PATCH /skill-groups/:id',
          call: (client, route) =>
            client.patch(route(`/skill-groups/${group.id}`), { description: uniqueId('d') }),
          expected: resourceAuth
        },
        {
          label: 'POST /skill-groups',
          call: (client, route) =>
            client.post(route('/skill-groups'), { name: uniqueId('e2e-group') }),
          expected: listAuth
        }
      ]);

      let otherList = await listAll(otherOrg.clients.instance, '/skill-groups');
      expect(ids(otherList)).not.toContain(group.id);

      let otherApi = otherOrg.clients.instance;
      await expectResponses([
        notFound('get another organization group', () =>
          otherApi.get(`/skill-groups/${group.id}`)
        ),
        notFound('update another organization group', () =>
          otherApi.patch(`/skill-groups/${group.id}`, { name: 'hijacked' })
        ),
        notFound('archive another organization group', () =>
          otherApi.delete(`/skill-groups/${group.id}`)
        ),
        notFound('add an item to another organization group', () =>
          otherApi.post(`/skill-groups/${group.id}/items`, { skill_id: 'skl_missing' })
        )
      ]);

      let untouched = expectOk(await org.clients.instance.get(`/skill-groups/${group.id}`));
      expect(untouched.status).toBe('active');
    });

    it('lets a non-admin member manage groups', async () => {
      let api = memberApi(org, member);
      let skill = await createSkill(api);

      let group = expectOk(
        await api.post('/skill-groups', {
          name: uniqueId('member-group'),
          skill_ids: [skill.id]
        })
      );
      expect(ids(group.skills)).toEqual([skill.id]);

      let archived = expectOk(await api.delete(`/skill-groups/${group.id}`));
      expect(archived.status).toBe('archived');
    });

    it('rejects invalid group bodies and queries', async () => {
      let api = org.clients.instance;
      let group = await createGroup();

      await expectResponses([
        invalid('create without a name', () => api.post('/skill-groups', {})),
        invalid('create with a non-array skill_ids', () =>
          api.post('/skill-groups', { name: 'x', skill_ids: 'skl_1' })
        ),
        invalid('create with string allow_consumer_skill_assignment', () =>
          api.post('/skill-groups', { name: 'x', allow_consumer_skill_assignment: 'yes' })
        ),
        invalid('update with string metadata', () =>
          api.patch(`/skill-groups/${group.id}`, { metadata: 'x' })
        ),
        invalid('list with an unknown status', () =>
          api.get('/skill-groups', { query: { status: 'gone' } })
        ),
        badRequest('create with a blank name', () =>
          api.post('/skill-groups', { name: '   ' })
        ),
        badRequest('update with a blank name', () =>
          api.patch(`/skill-groups/${group.id}`, { name: '   ' })
        ),
        notFound('unknown group', () => api.get('/skill-groups/skgrp_missing'))
      ]);
    });

    it('paginates groups without gaps or duplicates', async () => {
      let created: string[] = [];
      for (let index = 0; index < 5; index++) created.push((await createGroup()).id);

      let listed = ids(await listAll(org.clients.instance, '/skill-groups', { limit: 2 }));
      expect(new Set(listed).size).toBe(listed.length);
      expect(listed).toEqual(expect.arrayContaining(created));
    });
  });

  describe('group items', () => {
    it('adds, gets, lists and archives a group item', async () => {
      let api = org.clients.instance;
      let group = await createGroup();
      let skill = await createSkill(api);

      let item = expectOk(
        await api.post(`/skill-groups/${group.id}/items`, { skill_id: skill.id })
      );
      expectPresented(item, 'skill.group.item');
      expect(item).toMatchObject({
        status: 'active',
        skill_group_id: group.id,
        skill: { id: skill.id }
      });

      let fetched = expectOk(await api.get(`/skill-groups/${group.id}/items/${item.id}`));
      expect(fetched).toMatchObject({ id: item.id, skill: { id: skill.id } });

      let bySkill = await listAll(api, `/skill-groups/${group.id}/items`, {
        query: { skill_id: skill.id }
      });
      expect(ids(bySkill)).toEqual([item.id]);

      let withGroup = await listAll(api, '/skills', { query: { skill_group_id: group.id } });
      expect(ids(withGroup)).toEqual([skill.id]);

      expectError(
        await api.post(`/skill-groups/${group.id}/items`, { skill_id: skill.id }),
        400,
        'skill_group_item_exists'
      );

      let archived = expectOk(await api.delete(`/skill-groups/${group.id}/items/${item.id}`));
      expectPresented(archived, 'skill.group.item');
      expect(archived.status).toBe('archived');

      let active = await listAll(api, `/skill-groups/${group.id}/items`, {
        query: { status: 'active' }
      });
      expect(active).toEqual([]);
      expect(await listAll(api, '/skills', { query: { skill_group_id: group.id } })).toEqual(
        []
      );

      let readded = expectOk(
        await api.post(`/skill-groups/${group.id}/items`, { skill_id: skill.id })
      );
      expect(readded.status).toBe('active');
    });

    it('rejects invalid items and references outside the group or instance', async () => {
      let api = org.clients.instance;
      let group = await createGroup();
      let otherGroup = await createGroup();
      let skill = await createSkill(api);
      let foreignSkill = await createSkill(otherOrg.clients.instance);
      let item = expectOk(
        await api.post(`/skill-groups/${group.id}/items`, { skill_id: skill.id })
      );

      await expectResponses([
        invalid('item without a skill id', () =>
          api.post(`/skill-groups/${group.id}/items`, {})
        ),
        invalid('item with a numeric skill id', () =>
          api.post(`/skill-groups/${group.id}/items`, { skill_id: 1 })
        ),
        notFound('item with another organization skill', () =>
          api.post(`/skill-groups/${group.id}/items`, { skill_id: foreignSkill.id })
        ),
        notFound('item with an unknown skill', () =>
          api.post(`/skill-groups/${group.id}/items`, { skill_id: 'skl_missing' })
        ),
        notFound('get an item through another group', () =>
          api.get(`/skill-groups/${otherGroup.id}/items/${item.id}`)
        ),
        notFound('archive an item through another group', () =>
          api.delete(`/skill-groups/${otherGroup.id}/items/${item.id}`)
        ),
        notFound('unknown item', () => api.get(`/skill-groups/${group.id}/items/skgi_missing`))
      ]);

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute(`/skill-groups/${group.id}/items/${item.id}`, resourceAuth)
      ]);

      let stillActive = expectOk(await api.get(`/skill-groups/${group.id}/items/${item.id}`));
      expect(stillActive.status).toBe('active');
    });
  });
});
