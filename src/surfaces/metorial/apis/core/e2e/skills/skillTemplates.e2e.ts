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
  createIntegration,
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

describe('api-core skill templates', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let createTemplate = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/skill-templates', {
        name: uniqueId('e2e-template'),
        ...body
      })
    );

  describe('templates', () => {
    it('creates, gets, lists, updates and archives a tenant template', async () => {
      let api = org.clients.instance;
      let name = uniqueId('e2e-template');

      let template = await createTemplate({
        name,
        description: 'A template created over REST',
        metadata: { kind: 'e2e' }
      });
      expectPresented(template, 'skill.template');
      expect(template).toMatchObject({
        status: 'active',
        owner: 'tenant',
        name,
        description: 'A template created over REST',
        metadata: { kind: 'e2e' },
        items: []
      });
      expect(template.store_id).toEqual(expect.any(String));

      let fetched = expectOk(await api.get(`/skill-templates/${template.id}`));
      expect(fetched).toMatchObject({ id: template.id, name, owner: 'tenant' });

      let updated = expectOk(
        await api.patch(`/skill-templates/${template.id}`, {
          name: `${name}-renamed`,
          description: null
        })
      );
      expect(updated).toMatchObject({
        id: template.id,
        name: `${name}-renamed`,
        description: null
      });

      let tenantOwned = await listAll(api, '/skill-templates', { query: { owner: 'tenant' } });
      expect(ids(tenantOwned)).toContain(template.id);

      let systemOwned = await listAll(api, '/skill-templates', { query: { owner: 'system' } });
      expect(ids(systemOwned)).not.toContain(template.id);
      expect(systemOwned.every(item => item.owner === 'system')).toBe(true);

      let archived = expectOk(await api.delete(`/skill-templates/${template.id}`));
      expectPresented(archived, 'skill.template');
      expect(archived.status).toBe('archived');

      let active = await listAll(api, '/skill-templates', {
        query: { id: template.id, status: 'active' }
      });
      expect(active).toEqual([]);

      await expectResponses([
        {
          label: 'update an archived template',
          call: () => api.patch(`/skill-templates/${template.id}`, { name: 'x' }),
          status: 410
        },
        {
          label: 'archive an archived template',
          call: () => api.delete(`/skill-templates/${template.id}`),
          status: 410
        }
      ]);
    });

    it('copies the integrations of a skill into a template and from the template into new skills', async () => {
      let api = org.clients.instance;
      let integration = await createIntegration(api);
      let source = await createSkill(api);
      expectOk(
        await api.post(`/skills/${source.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        })
      );

      let template = await createTemplate({ from_skill_Id: source.id });
      expect(template.items).toHaveLength(1);
      expect(template.items[0]).toMatchObject({
        object: 'skill.template.item',
        type: 'integration',
        integration: { id: integration.id }
      });

      let byIntegration = await listAll(api, '/skill-templates', {
        query: { integration_id: integration.id }
      });
      expect(ids(byIntegration)).toEqual([template.id]);

      let fromTemplate = await createSkill(api, { template_id: template.id });
      expect(fromTemplate.integrations.map((item: any) => item.id)).toEqual([integration.id]);
    });

    it('keeps system templates read-only', async () => {
      let api = org.clients.instance;
      await createSkill(api);

      let [system] = await listAll(api, '/skill-templates', { query: { owner: 'system' } });
      expect(system).toBeDefined();
      expectPresented(system, 'skill.template');

      expectOk(await api.get(`/skill-templates/${system.id}`));

      await expectResponses([
        badRequest('update a system template', () =>
          api.patch(`/skill-templates/${system.id}`, { name: uniqueId('hijacked') })
        ),
        badRequest('archive a system template', () =>
          api.delete(`/skill-templates/${system.id}`)
        )
      ]);

      let unchanged = expectOk(await api.get(`/skill-templates/${system.id}`));
      expect(unchanged).toMatchObject({ name: system.name, status: 'active' });
    });

    it('serves templates to every instance credential and hides them from other organizations', async () => {
      let template = await createTemplate();
      let foreignSkill = await createSkill(otherOrg.clients.instance);
      let clients = skillClients(org, otherOrg, member);

      await expectRoutesAuth(org, clients, [
        getRoute('/skill-templates', listAuth),
        getRoute(`/skill-templates/${template.id}`, resourceAuth),
        getRoute(`/skill-templates/${template.id}/items`, resourceAuth),
        {
          label: 'PATCH /skill-templates/:id',
          call: (client, route) =>
            client.patch(route(`/skill-templates/${template.id}`), {
              description: uniqueId('d')
            }),
          expected: resourceAuth
        }
      ]);

      let otherTenant = await listAll(otherOrg.clients.instance, '/skill-templates', {
        query: { owner: 'tenant' }
      });
      expect(ids(otherTenant)).not.toContain(template.id);

      let api = org.clients.instance;
      await expectResponses([
        notFound('template from another organization skill', () =>
          api.post('/skill-templates', { name: uniqueId('x'), from_skill_Id: foreignSkill.id })
        ),
        notFound('template from an unknown skill', () =>
          api.post('/skill-templates', { name: uniqueId('x'), from_skill_Id: 'skl_missing' })
        ),
        notFound('archive another organization template', () =>
          otherOrg.clients.instance.delete(`/skill-templates/${template.id}`)
        )
      ]);

      let memberTemplate = expectOk(
        await memberApi(org, member).post('/skill-templates', { name: uniqueId('member') })
      );
      expect(memberTemplate.owner).toBe('tenant');
    });

    it('rejects invalid template bodies and queries', async () => {
      let api = org.clients.instance;
      let template = await createTemplate();

      await expectResponses([
        invalid('create without a name', () => api.post('/skill-templates', {})),
        invalid('create with string metadata', () =>
          api.post('/skill-templates', { name: 'x', metadata: 'x' })
        ),
        invalid('create with a numeric source skill', () =>
          api.post('/skill-templates', { name: 'x', from_skill_Id: 1 })
        ),
        invalid('update with a numeric name', () =>
          api.patch(`/skill-templates/${template.id}`, { name: 1 })
        ),
        invalid('list with an unknown owner', () =>
          api.get('/skill-templates', { query: { owner: 'someone' } })
        ),
        badRequest('create with a blank name', () =>
          api.post('/skill-templates', { name: '   ' })
        ),
        notFound('unknown template', () => api.get('/skill-templates/sktpl_missing'))
      ]);
    });

    it('serves the legacy singular template paths', async () => {
      let template = await createTemplate();

      let fetched = expectOk(await org.clients.instance.get(`/skill-template/${template.id}`));
      expect(fetched.id).toBe(template.id);
    });
  });

  describe('template items', () => {
    it('adds, gets, lists and deletes an integration item', async () => {
      let api = org.clients.instance;
      let template = await createTemplate();
      let integration = await createIntegration(api);

      let item = expectOk(
        await api.post(`/skill-templates/${template.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        })
      );
      expectPresented(item, 'skill.template.item');
      expect(item).toMatchObject({
        type: 'integration',
        integration: { id: integration.id },
        provider: null
      });

      let fetched = expectOk(
        await api.get(`/skill-templates/${template.id}/items/${item.id}`)
      );
      expect(fetched.id).toBe(item.id);

      expect(ids(await listAll(api, `/skill-templates/${template.id}/items`))).toEqual([
        item.id
      ]);

      let withItems = expectOk(await api.get(`/skill-templates/${template.id}`));
      expect(ids(withItems.items)).toEqual([item.id]);

      expectError(
        await api.post(`/skill-templates/${template.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        }),
        400,
        'skill_template_item_exists'
      );

      let deleted = expectOk(
        await api.delete(`/skill-templates/${template.id}/items/${item.id}`)
      );
      expectPresented(deleted, 'skill.template.item');
      expect(deleted.id).toBe(item.id);

      expect(await listAll(api, `/skill-templates/${template.id}/items`)).toEqual([]);
      expectError(await api.get(`/skill-templates/${template.id}/items/${item.id}`), 404);
    });

    it('rejects invalid items and references outside the template or instance', async () => {
      let api = org.clients.instance;
      let template = await createTemplate();
      let otherTemplate = await createTemplate();
      let integration = await createIntegration(api);
      let foreignIntegration = await createIntegration(otherOrg.clients.instance);
      let item = expectOk(
        await api.post(`/skill-templates/${template.id}/items`, {
          type: 'integration',
          integration_id: integration.id
        })
      );

      await expectResponses([
        invalid('item without a type', () =>
          api.post(`/skill-templates/${template.id}/items`, { integration_id: integration.id })
        ),
        invalid('integration item without an integration id', () =>
          api.post(`/skill-templates/${template.id}/items`, { type: 'integration' })
        ),
        invalid('provider item without a provider id', () =>
          api.post(`/skill-templates/${template.id}/items`, { type: 'provider' })
        ),
        notFound('item with another organization integration', () =>
          api.post(`/skill-templates/${template.id}/items`, {
            type: 'integration',
            integration_id: foreignIntegration.id
          })
        ),
        notFound('item with an unknown provider', () =>
          api.post(`/skill-templates/${template.id}/items`, {
            type: 'provider',
            provider_id: 'pro_missing'
          })
        ),
        notFound('get an item through another template', () =>
          api.get(`/skill-templates/${otherTemplate.id}/items/${item.id}`)
        ),
        notFound('delete an item through another template', () =>
          api.delete(`/skill-templates/${otherTemplate.id}/items/${item.id}`)
        )
      ]);

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute(`/skill-templates/${template.id}/items/${item.id}`, resourceAuth)
      ]);

      expectOk(await api.get(`/skill-templates/${template.id}/items/${item.id}`));
    });
  });
});
