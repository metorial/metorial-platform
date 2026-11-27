import {
  eventuallyAudited,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogModels } from './_catalog';
import { crossTenantClients, ensureCatalog, gatewayPath, ids } from './_shared';

let longPrompt = 'lorem ipsum '.repeat(2500);

let chat = (content: string) => ({
  dialect: 'openai_chat',
  request: { model: 'any', messages: [{ role: 'user', content }] }
});

let definitionWith = (d: { longModel?: string; defaultModel?: string } = {}) => ({
  rules: [
    {
      id: 'long-context',
      description: 'Long prompts',
      when: 'request.input_tokens > 1000',
      models: [{ model: d.longModel ?? catalogModels.sonnet }]
    }
  ],
  default: { models: [{ model: d.defaultModel ?? catalogModels.haiku }] }
});

describe('api-core ai-gateway: virtual models', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let auditOrg = useOrganization();

  let api = () => org.clients.instance;
  let slug = () => uniqueId('router').toLowerCase();

  let createVirtualModel = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await api().post('/ai-gateway/virtual-models', {
        slug: slug(),
        name: 'Router',
        definition: definitionWith(),
        ...body
      })
    );

  beforeAll(async () => {
    await ensureCatalog();
  });

  it('authenticates the virtual model routes for every credential', async () => {
    let virtualModel = await createVirtualModel();
    let clients = crossTenantClients(org, otherOrg);
    let expected = {
      none: 401,
      session: 200,
      management: 200,
      instance: 200,
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 404
    };

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(gatewayPath(org, name, `/virtual-models/${virtualModel.id}`)),
      expected
    );
    await expectAuthMatrix(
      clients,
      (client, name) => client.get(gatewayPath(org, name, '/virtual-models')),
      { ...expected, otherInstance: 200 }
    );
    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(gatewayPath(org, name, `/virtual-models/${virtualModel.id}/versions`)),
      expected
    );
  });

  describe('lifecycle', () => {
    it('creates a virtual model with a first version', async () => {
      let name = slug();
      let created = await createVirtualModel({
        slug: name,
        name: 'Support router',
        description: 'Routes support traffic'
      });

      expectPresented(created, 'ai_gateway.virtual_model');
      expect(created).toMatchObject({
        slug: name,
        name: 'Support router',
        description: 'Routes support traffic',
        deleted_at: null
      });
      expect(created.current_version).toMatchObject({
        object: 'ai_gateway.virtual_model.version',
        number: 1
      });
      expect(created.current_version.target_models).toEqual(
        expect.arrayContaining([catalogModels.sonnet, catalogModels.haiku])
      );
      expect(created.current_version.definition).toMatchObject({
        rules: [{ id: 'long-context', when: 'request.input_tokens > 1000' }],
        default: { models: [{ model: catalogModels.haiku }] }
      });
    });

    it('gets a virtual model by id and by slug', async () => {
      let created = await createVirtualModel();

      let byId = expectOk(await api().get(`/ai-gateway/virtual-models/${created.id}`));
      let bySlug = expectOk(await api().get(`/ai-gateway/virtual-models/${created.slug}`));

      expect(byId.id).toBe(created.id);
      expect(bySlug.id).toBe(created.id);
    });

    it('lists and pages through virtual models', async () => {
      let created = [
        await createVirtualModel(),
        await createVirtualModel(),
        await createVirtualModel()
      ];

      let all = await listAll(api(), '/ai-gateway/virtual-models');
      let paged = await listAll(api(), '/ai-gateway/virtual-models', { limit: 1 });

      expect(ids(paged)).toEqual(ids(all));
      expect(new Set(ids(paged)).size).toBe(paged.length);
      expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));
    });

    it('creates a version for every definition change and none for a rename', async () => {
      let created = await createVirtualModel();

      let renamed = expectOk(
        await api().patch(`/ai-gateway/virtual-models/${created.id}`, {
          name: 'Renamed',
          description: null
        })
      );
      expect(renamed).toMatchObject({ name: 'Renamed', description: null });
      expect(renamed.current_version.number).toBe(1);

      let changed = expectOk(
        await api().patch(`/ai-gateway/virtual-models/${created.id}`, {
          definition: definitionWith({ defaultModel: catalogModels.gpt })
        })
      );
      expect(changed.current_version.number).toBe(2);
      expect(changed.current_version.target_models).toContain(catalogModels.gpt);

      let versions = await listAll(api(), `/ai-gateway/virtual-models/${created.id}/versions`);
      expect(versions.map(version => version.number).sort()).toEqual([1, 2]);

      let first = versions.find(version => version.number == 1)!;
      let fetched = expectOk(
        await api().get(`/ai-gateway/virtual-models/${created.id}/versions/${first.id}`)
      );
      expect(fetched).toMatchObject({ id: first.id, number: 1 });
      expect(fetched.definition.default.models).toMatchObject([
        { model: catalogModels.haiku }
      ]);
    });

    it('rolls back to an earlier version as a new version', async () => {
      let created = await createVirtualModel();
      let first = created.current_version;

      expectOk(
        await api().patch(`/ai-gateway/virtual-models/${created.id}`, {
          definition: definitionWith({ defaultModel: catalogModels.gpt })
        })
      );

      let rolledBack = expectOk(
        await api().post(`/ai-gateway/virtual-models/${created.id}/rollback`, {
          version_id: first.id
        })
      );
      expect(rolledBack.current_version.number).toBe(3);
      expect(rolledBack.current_version.definition).toEqual(first.definition);

      expectError(
        await api().post(`/ai-gateway/virtual-models/${created.id}/rollback`, {
          version_id: 'agvv_doesnotexist'
        }),
        404
      );
    });

    it('archives a virtual model and frees its slug', async () => {
      let created = await createVirtualModel();

      let archived = expectOk(await api().delete(`/ai-gateway/virtual-models/${created.id}`));
      expect(archived.deleted_at).toEqual(expect.any(String));

      expectError(await api().get(`/ai-gateway/virtual-models/${created.id}`), 404);
      expect(ids(await listAll(api(), '/ai-gateway/virtual-models'))).not.toContain(
        created.id
      );

      let reused = await createVirtualModel({ slug: created.slug });
      expect(reused.id).not.toBe(created.id);
    });
  });

  describe('templates', () => {
    it('lists the built-in templates', async () => {
      let templates = await listAll(api(), '/ai-gateway/virtual-model-templates');

      expect(templates.map(template => template.slug)).toEqual(
        expect.arrayContaining(['complexity-tiers', 'long-context', 'task-specialists'])
      );
      for (let template of templates) {
        expectPresented(template, 'ai_gateway.virtual_model.template');
        expect(template.parameters.length).toBeGreaterThan(0);
      }
    });

    it('creates a virtual model from a template', async () => {
      let created = expectOk(
        await api().post('/ai-gateway/virtual-models/from-template', {
          template: 'long-context',
          slug: slug(),
          name: 'From template',
          parameters: { standard: catalogModels.haiku, long_context: catalogModels.sonnet }
        })
      );

      expectPresented(created, 'ai_gateway.virtual_model');
      expect(created.current_version.number).toBe(1);
      expect(created.current_version.target_models).toEqual(
        expect.arrayContaining([catalogModels.haiku, catalogModels.sonnet])
      );
    });

    it('rejects unknown templates and incomplete parameters', async () => {
      expectError(
        await api().post('/ai-gateway/virtual-models/from-template', {
          template: 'no-such-template',
          slug: slug(),
          name: 'Nope',
          parameters: {}
        }),
        404
      );

      let response = await api().post('/ai-gateway/virtual-models/from-template', {
        template: 'long-context',
        slug: slug(),
        name: 'Incomplete',
        parameters: { standard: catalogModels.haiku }
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('testing', () => {
    let test = async (path: string, body: Record<string, unknown>) =>
      expectOk(await api().post(path, body));

    it('picks the model a request would be routed to', async () => {
      let created = await createVirtualModel();

      let short = await test(`/ai-gateway/virtual-models/${created.id}/test`, chat('hello'));
      expectPresented(short, 'ai_gateway.virtual_model.test');
      expect(short.candidates[0]).toMatchObject({
        model: catalogModels.haiku,
        connection_owner: 'platform'
      });

      let long = await test(`/ai-gateway/virtual-models/${created.id}/test`, chat(longPrompt));
      expect(long.candidates[0]).toMatchObject({ model: catalogModels.sonnet });
      expect(long.request.input_tokens).toBeGreaterThan(1000);
    });

    it('tests a draft definition without saving it', async () => {
      let result = await test('/ai-gateway/virtual-models/test', {
        ...chat('hello'),
        definition: definitionWith({ defaultModel: catalogModels.gpt })
      });

      expect(result.candidates[0]).toMatchObject({ model: catalogModels.gpt });
    });

    it('resolves the token the request is tested as before routing it', async () => {
      let token = expectOk(
        await api().post('/ai-gateway/tokens', { name: uniqueId('token') })
      );

      let result = await test('/ai-gateway/virtual-models/test', {
        ...chat('hello'),
        token_id: token.id,
        definition: definitionWith()
      });

      expect(result.candidates[0]).toMatchObject({ model: catalogModels.haiku });
    });

    it('answers 404 for a token that does not exist', async () => {
      expectError(
        await api().post('/ai-gateway/virtual-models/test', {
          ...chat('hello'),
          token_id: 'agtk_doesnotexist',
          definition: definitionWith()
        }),
        404
      );
    });
  });

  describe('validation', () => {
    it('rejects invalid slugs and names', async () => {
      for (let invalid of [
        { slug: '' },
        { slug: 'Has Spaces' },
        { slug: '-leading' },
        { slug: 'UPPER' },
        { slug: 'x'.repeat(101) },
        { name: '' },
        { name: 'x'.repeat(201) }
      ]) {
        expectError(
          await api().post('/ai-gateway/virtual-models', {
            slug: slug(),
            name: 'Router',
            definition: definitionWith(),
            ...invalid
          }),
          400,
          'invalid_data'
        );
      }
    });

    it('rejects malformed definitions', async () => {
      let valid = definitionWith();
      let target = { model: catalogModels.haiku };
      let malformed: Record<string, unknown>[] = [
        {},
        { default: valid.default },
        { rules: valid.rules },
        { ...valid, default: { models: [] } },
        { ...valid, default: { models: [{ model: '' }] } },
        { ...valid, default: { models: [{ model: catalogModels.haiku, weight: 0 }] } },
        { ...valid, rules: [{ id: 'Bad Id', when: 'true', models: [target] }] },
        { ...valid, rules: [{ id: 'empty-when', when: '', models: [target] }] },
        { ...valid, rules: [{ id: 'no-models', when: 'true', models: [] }] },
        {
          ...valid,
          rules: [
            { id: 'bad-effort', when: 'true', models: [target], overrides: { temperature: 3 } }
          ]
        },
        { ...valid, decision: { model: 'gpt-nope' } },
        { ...valid, stickiness: { metadata_key: '' } }
      ];

      for (let definition of malformed) {
        expectError(
          await api().post('/ai-gateway/virtual-models', {
            slug: slug(),
            name: 'Malformed',
            definition
          }),
          400,
          'invalid_data'
        );
      }
    });

    it('rejects definitions the gateway cannot use', async () => {
      let target = { model: catalogModels.haiku };
      let rejected: Record<string, unknown>[] = [
        { rules: [], default: { models: [{ model: 'nobody/nothing' }] } },
        {
          rules: [{ id: 'broken', when: 'request.input_tokens >', models: [target] }],
          default: { models: [target] }
        },
        {
          rules: [
            { id: 'same', when: 'true', models: [target] },
            { id: 'same', when: 'false', models: [target] }
          ],
          default: { models: [target] }
        },
        {
          rules: [{ id: 'reads-signals', when: 'signals.urgent.value', models: [target] }],
          default: { models: [target] }
        }
      ];

      for (let definition of rejected) {
        let response = await api().post('/ai-gateway/virtual-models', {
          slug: slug(),
          name: 'Rejected',
          definition
        });
        expect(response.status, response.text).toBeGreaterThanOrEqual(400);
        expect(response.status, response.text).toBeLessThan(500);
      }

      let all = await listAll(api(), '/ai-gateway/virtual-models');
      expect(all.filter(item => item.name == 'Rejected')).toEqual([]);
    });

    it('rejects a slug that is already taken in the instance', async () => {
      let created = await createVirtualModel();

      let response = await api().post('/ai-gateway/virtual-models', {
        slug: created.slug,
        name: 'Duplicate',
        definition: definitionWith()
      });
      expect(response.status, response.text).toBeGreaterThanOrEqual(400);
      expect(response.status, response.text).toBeLessThan(500);

      let theirs = expectOk(
        await otherOrg.clients.instance.post('/ai-gateway/virtual-models', {
          slug: created.slug,
          name: 'Other organization',
          definition: definitionWith()
        })
      );
      expect(theirs.slug).toBe(created.slug);
    });

    it('rejects an invalid test request', async () => {
      let created = await createVirtualModel();

      for (let body of [
        {},
        { dialect: 'carrier_pigeon', request: {} },
        { dialect: 'openai_chat' },
        { ...chat('hello'), metadata: { '': 'empty key' } }
      ]) {
        expectError(
          await api().post(`/ai-gateway/virtual-models/${created.id}/test`, body),
          400,
          'invalid_data'
        );
      }
    });
  });

  describe('tenant isolation', () => {
    it("hides another organization's virtual models", async () => {
      let theirs = expectOk(
        await otherOrg.clients.instance.post('/ai-gateway/virtual-models', {
          slug: slug(),
          name: 'Theirs',
          definition: definitionWith()
        })
      );

      for (let path of [
        `/ai-gateway/virtual-models/${theirs.id}`,
        `/ai-gateway/virtual-models/${theirs.slug}`,
        `/ai-gateway/virtual-models/${theirs.id}/versions`,
        `/ai-gateway/virtual-models/${theirs.id}/insights`
      ]) {
        expectError(await api().get(path), 404);
      }
      expectError(
        await api().patch(`/ai-gateway/virtual-models/${theirs.id}`, { name: 'Taken' }),
        404
      );
      expectError(await api().delete(`/ai-gateway/virtual-models/${theirs.id}`), 404);
      expectError(
        await api().post(`/ai-gateway/virtual-models/${theirs.id}/test`, chat('hello')),
        404
      );
      expect(ids(await listAll(api(), '/ai-gateway/virtual-models'))).not.toContain(theirs.id);
    });
  });

  describe('audit trail', () => {
    it('records creation, updates and archival', async () => {
      let api = auditOrg.clients.instance;
      let created = expectOk(
        await api.post('/ai-gateway/virtual-models', {
          slug: slug(),
          name: 'Audited',
          definition: definitionWith()
        })
      );
      expectOk(
        await api.patch(`/ai-gateway/virtual-models/${created.id}`, { name: 'Audited 2' })
      );
      expectOk(await api.delete(`/ai-gateway/virtual-models/${created.id}`));

      let entries = await eventuallyAudited(async () => {
        let auditLogs = await listAll(auditOrg.clients.management, '/organization/audit-logs');
        let entries = auditLogs.filter(
          item => item.resource == 'ai_gateway_virtual_model' && item.payload?.id == created.id
        );
        expect(entries.map(item => item.action).sort()).toEqual([
          'create',
          'delete',
          'update'
        ]);
        return entries;
      });

      expect(entries.length).toBe(3);
    }, 180_000);
  });
});
