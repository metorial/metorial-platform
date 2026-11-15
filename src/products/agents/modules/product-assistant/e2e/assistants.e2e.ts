import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { productAssistantConversationService, productAssistantService } from '../src';
import { defaultModelSlug, getTestAssistant, loadAssistantFixture } from './_fixtures';

describe('module-product-assistant: assistants', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createTenantAssistant = async () => {
    let fixture = await loadAssistantFixture(otherOrg.ids);
    let testAssistant = await getTestAssistant(fixture);

    let assistant = await db.productAssistant.create({
      data: {
        id: await ID.generateId('productAssistant'),
        ownerType: 'tenant',
        projectOid: fixture.project.oid,
        implementationOid: testAssistant.implementationOid,
        name: 'E2E Tenant Assistant',
        slug: uniqueId('e2e-tenant-assistant')
      }
    });

    return { fixture, assistant };
  };

  it('lists the system assistants with their implementation and models', async () => {
    let fixture = await loadAssistantFixture(org.ids);

    let assistants = await firstPage(
      await productAssistantService.list({ project: fixture.project })
    );
    expect(assistants.map(assistant => assistant.slug)).toEqual(
      expect.arrayContaining(['explorer', 'skills', 'test'])
    );

    let assistant = assistants.find(assistant => assistant.slug == 'test')!;
    expect(assistant).toMatchObject({
      ownerType: 'metorial',
      projectOid: null,
      name: 'Test Assistant',
      systemIdentifier: 'test',
      implementation: { slug: 'test', name: 'Test Assistant' }
    });
    expect(assistant.defaultModel).toMatchObject({
      slug: defaultModelSlug,
      name: 'Claude Sonnet 4.6',
      provider: { slug: 'anthropic', name: 'Anthropic' }
    });

    let models = assistant.availableModels;
    expect(models[0]!.oid).toBe(assistant.defaultModel!.oid);
    expect(new Set(models.map(model => model.oid)).size).toBe(models.length);
    expect(models.map(model => model.slug)).toEqual(
      expect.arrayContaining([defaultModelSlug, 'claude-haiku-4-5', 'gpt-5-2'])
    );
    expect(models.map(model => model.provider.slug)).toEqual(
      expect.arrayContaining(['anthropic', 'openai'])
    );

    let persisted = await db.productAssistantModel.findMany({
      where: { oid: { in: models.map(model => model.oid) } }
    });
    expect(persisted).toHaveLength(models.length);
  });

  it('resolves an assistant by id, slug and system identifier', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let bySlug = await getTestAssistant(fixture);

    let byId = await productAssistantService.get({
      project: fixture.project,
      assistantId: bySlug.id
    });
    expect(byId.id).toBe(bySlug.id);

    let explorer = await productAssistantService.get({
      project: fixture.project,
      assistantId: 'explorer'
    });
    expect(explorer).toMatchObject({ slug: 'explorer', systemIdentifier: 'explorer' });

    let many = await productAssistantService.getMany({
      project: fixture.project,
      assistantIds: [explorer.id, uniqueId('missing'), bySlug.id, explorer.id]
    });
    expect(many.map(assistant => assistant.id)).toEqual([explorer.id, bySlug.id]);
    expect(many[1]!.defaultModel?.slug).toBe(defaultModelSlug);

    expect(
      await productAssistantService.getMany({ project: fixture.project, assistantIds: [] })
    ).toEqual([]);

    await expectServiceError(
      productAssistantService.get({
        project: fixture.project,
        assistantId: uniqueId('missing')
      }),
      'not_found'
    );
  });

  it('creates one assistant instance per project', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let otherFixture = await loadAssistantFixture(otherOrg.ids);
    let assistant = await getTestAssistant(fixture);

    let instance = await productAssistantService.getOrCreateAssistantInstance({
      assistant,
      project: fixture.project
    });
    let again = await productAssistantService.getOrCreateAssistantInstance({
      assistant,
      project: fixture.project
    });
    expect(again.id).toBe(instance.id);
    expect(instance).toMatchObject({
      assistantOid: assistant.oid,
      projectOid: fixture.project.oid,
      assistant: { slug: 'test' }
    });

    let otherInstance = await productAssistantService.getOrCreateAssistantInstance({
      assistant,
      project: otherFixture.project
    });
    expect(otherInstance.id).not.toBe(instance.id);
    expect(otherInstance.projectOid).toBe(otherFixture.project.oid);

    expect(
      await db.productAssistantInstance.count({
        where: { assistantOid: assistant.oid, projectOid: fixture.project.oid }
      })
    ).toBe(1);
  });

  it('keeps a tenant-owned assistant private to its project', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let { fixture: ownerFixture, assistant } = await createTenantAssistant();

    let owned = await productAssistantService.get({
      project: ownerFixture.project,
      assistantId: assistant.slug
    });
    expect(owned).toMatchObject({ id: assistant.id, ownerType: 'tenant' });
    expect(owned.defaultModel?.slug).toBe(defaultModelSlug);

    let ownerList = await firstPage(
      await productAssistantService.list({ project: ownerFixture.project })
    );
    expect(ownerList.map(item => item.id)).toContain(assistant.id);

    await expectServiceError(
      productAssistantService.get({ project: fixture.project, assistantId: assistant.id }),
      'not_found'
    );

    let list = await firstPage(
      await productAssistantService.list({ project: fixture.project })
    );
    expect(list.map(item => item.id)).not.toContain(assistant.id);

    let many = await productAssistantService.getMany({
      project: fixture.project,
      assistantIds: [assistant.id]
    });
    expect(many).toEqual([]);

    await expectServiceError(
      productAssistantConversationService.createAssistantConversation({
        project: fixture.project,
        instance: fixture.instance,
        actor: fixture.resourceActor,
        input: { assistantId: assistant.id }
      }),
      'not_found'
    );
  });
});
