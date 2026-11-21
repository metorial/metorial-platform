import { expectServiceError, uniqueId } from '@metorial/e2e';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import { createToken, useCatalog, useTenant } from '../support/fixtures';

let longPrompt = 'lorem ipsum '.repeat(2500);

let chat = (content: string) => ({
  dialect: 'openai_chat' as const,
  body: { model: 'any', messages: [{ role: 'user', content }] }
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

describe('ai-gateway virtual model api', () => {
  useCatalog();
  let tenant = useTenant();

  let slug = () => uniqueId('router').toLowerCase();

  let createVirtualModel = (
    input: Partial<Parameters<typeof gateway.virtualModel.create>[0]> = {}
  ) =>
    gateway.virtualModel.create({
      ...tenant.scope,
      slug: slug(),
      name: 'Router',
      definition: definitionWith(),
      ...input
    });

  it('creates a virtual model with a first version', async () => {
    let name = slug();

    let created = await createVirtualModel({
      slug: name,
      name: 'Support router',
      description: 'Routes support traffic'
    });

    expect(created).toMatchObject({
      object: 'ai_gateway#virtual_model',
      slug: name,
      name: 'Support router',
      description: 'Routes support traffic',
      instanceId: tenant.instance.id,
      archivedAt: null
    });
    expect(created.currentVersion).toMatchObject({ number: 1 });
    expect(created.currentVersion!.targetModelSlugs).toEqual(
      expect.arrayContaining([catalogModels.sonnet, catalogModels.haiku])
    );
  });

  it('gets and lists virtual models', async () => {
    let own = await createVirtualModel();
    await createVirtualModel();

    let fetched = await gateway.virtualModel.get({
      ...tenant.scope,
      virtualModelId: own.id
    });
    expect(fetched.id).toBe(own.id);

    let first = await gateway.virtualModel.list({ ...tenant.scope, limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.pagination.has_more_after).toBe(true);
  });

  it('versions definition changes but not renames', async () => {
    let created = await createVirtualModel();

    let renamed = await gateway.virtualModel.update({
      ...tenant.scope,
      virtualModelId: created.id,
      name: 'Renamed',
      description: null
    });
    expect(renamed).toMatchObject({ name: 'Renamed', description: null });
    expect(renamed.currentVersion!.number).toBe(1);

    let changed = await gateway.virtualModel.update({
      ...tenant.scope,
      virtualModelId: created.id,
      definition: definitionWith({ defaultModel: catalogModels.gpt })
    });
    expect(changed.currentVersion!.number).toBe(2);
    expect(changed.currentVersion!.targetModelSlugs).toContain(catalogModels.gpt);

    let versions = await gateway.virtualModel.listVersions({
      ...tenant.scope,
      virtualModelId: created.id
    });
    expect(versions.items.map(version => version.number).sort()).toEqual([1, 2]);

    let first = versions.items.find(version => version.number == 1)!;
    let fetched = await gateway.virtualModel.getVersion({
      ...tenant.scope,
      virtualModelId: created.id,
      versionId: first.id
    });
    expect(fetched.definition.default.models).toMatchObject([{ model: catalogModels.haiku }]);
  });

  it('rolls back to an earlier version as a new version', async () => {
    let created = await createVirtualModel();
    await gateway.virtualModel.update({
      ...tenant.scope,
      virtualModelId: created.id,
      definition: definitionWith({ defaultModel: catalogModels.gpt })
    });

    let rolledBack = await gateway.virtualModel.rollback({
      ...tenant.scope,
      virtualModelId: created.id,
      versionId: created.currentVersion!.id
    });

    expect(rolledBack.currentVersion!.number).toBe(3);
    expect(rolledBack.currentVersion!.definition).toEqual(created.currentVersion!.definition);
  });

  it('archives a virtual model and frees its slug', async () => {
    let created = await createVirtualModel();

    let archived = await gateway.virtualModel.archive({
      ...tenant.scope,
      virtualModelId: created.id
    });
    expect(archived.archivedAt).toBeTruthy();

    await expectServiceError(
      gateway.virtualModel.get({ ...tenant.scope, virtualModelId: created.id }),
      'not_found'
    );

    let reused = await createVirtualModel({ slug: created.slug });
    expect(reused.id).not.toBe(created.id);
  });

  it('rejects a slug that is taken in the same instance only', async () => {
    let created = await createVirtualModel();

    await expectServiceError(
      createVirtualModel({ slug: created.slug }),
      'virtual_model_slug_taken'
    );
  });

  it('rejects definitions the gateway cannot use', async () => {
    let target = { model: catalogModels.haiku };

    for (let definition of [
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
      }
    ]) {
      await expectServiceError(createVirtualModel({ definition }), 'invalid_virtual_model');
    }
  });

  it('does not expose a virtual model through another instance', async () => {
    let created = await createVirtualModel();
    let other = await gateway.instance.upsert({
      organizationId: tenant.organization.id,
      projectId: tenant.project.id,
      ref: uniqueId('instance')
    });

    await expectServiceError(
      gateway.virtualModel.get({
        organizationId: tenant.organization.id,
        instanceId: other.id,
        virtualModelId: created.id
      }),
      'not_found'
    );
  });

  describe('templates', () => {
    it('lists the built-in templates', async () => {
      let templates = await gateway.virtualModel.listTemplates(tenant.scope);

      expect(templates.items.map(template => template.slug)).toEqual(
        expect.arrayContaining(['complexity-tiers', 'long-context', 'task-specialists'])
      );
    });

    it('creates a virtual model from a template', async () => {
      let created = await gateway.virtualModel.createFromTemplate({
        ...tenant.scope,
        templateSlug: 'long-context',
        slug: slug(),
        name: 'From template',
        models: { standard: catalogModels.haiku, long_context: catalogModels.sonnet }
      });

      expect(created.currentVersion!.number).toBe(1);
      expect(created.currentVersion!.targetModelSlugs).toEqual(
        expect.arrayContaining([catalogModels.haiku, catalogModels.sonnet])
      );
    });

    it('rejects unknown templates', async () => {
      await expect(
        gateway.virtualModel.createFromTemplate({
          ...tenant.scope,
          templateSlug: 'no-such-template',
          slug: slug(),
          name: 'Nope',
          models: {}
        })
      ).rejects.toThrow();
    });
  });

  describe('testing a definition', () => {
    it('picks the model a request would be routed to', async () => {
      let created = await createVirtualModel();

      let short = await gateway.virtualModel.test({
        ...tenant.scope,
        virtualModelId: created.id,
        ...chat('hello')
      });
      expect(short.object).toBe('ai_gateway#virtual_model_test');
      expect(short.candidates[0]).toMatchObject({ model: { slug: catalogModels.haiku } });

      let long = await gateway.virtualModel.test({
        ...tenant.scope,
        virtualModelId: created.id,
        ...chat(longPrompt)
      });
      expect(long.candidates[0]).toMatchObject({ model: { slug: catalogModels.sonnet } });
      expect(long.request.estimatedInputTokens).toBeGreaterThan(1000);
    });

    it('tests a draft definition without saving it', async () => {
      let result = await gateway.virtualModel.test({
        ...tenant.scope,
        definition: definitionWith({ defaultModel: catalogModels.gpt }),
        ...chat('hello')
      });

      expect(result.candidates[0]).toMatchObject({ model: { slug: catalogModels.gpt } });
    });

    it('tests as a specific token', async () => {
      let token = await createToken(tenant, { allowedModels: [catalogModels.haiku] });

      let allowed = await gateway.virtualModel.test({
        ...tenant.scope,
        definition: definitionWith(),
        gatewayTokenId: token.id,
        ...chat('hello')
      });
      expect(allowed.candidates[0]).toMatchObject({ model: { slug: catalogModels.haiku } });
    });

    it('rejects a token that does not exist', async () => {
      await expectServiceError(
        gateway.virtualModel.test({
          ...tenant.scope,
          definition: definitionWith(),
          gatewayTokenId: 'agtk_doesnotexist',
          ...chat('hello')
        }),
        'not_found'
      );
    });
  });
});
