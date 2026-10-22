import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import {
  productAssistantConversationService,
  productAssistantMessageService,
  productAssistantService
} from '../src';

let loadAssistantFixture = async (ids: Parameters<typeof loadOrganizationFixture>[0]) => {
  let fixture = await loadOrganizationFixture(ids);
  let actor = await resourceActorService.getOrEnsureOrganizationActor({
    project: fixture.project,
    organizationActor: fixture.actor
  });

  return { ...fixture, resourceActor: actor };
};

describe('module-product-assistant', () => {
  let org = useOrganization();

  it('lists and resolves the system assistants with their models', async () => {
    let fixture = await loadAssistantFixture(org.ids);

    let assistants = await firstPage(
      await productAssistantService.list({ project: fixture.project })
    );
    expect(assistants.map(assistant => assistant.slug)).toEqual(
      expect.arrayContaining(['explorer', 'skills', 'test'])
    );

    let assistant = await productAssistantService.get({
      project: fixture.project,
      assistantId: 'test'
    });
    expect(assistant).toMatchObject({ slug: 'test', ownerType: 'metorial' });
    expect(assistant.defaultModel?.slug).toBe('claude-sonnet-4-6');
    expect(assistant.availableModels.map(model => model.slug)).toContain('claude-sonnet-4-6');

    let instance = await productAssistantService.getOrCreateAssistantInstance({
      assistant,
      project: fixture.project
    });
    let again = await productAssistantService.getOrCreateAssistantInstance({
      assistant,
      project: fixture.project
    });
    expect(again.id).toBe(instance.id);

    await expect(
      productAssistantService.get({
        project: fixture.project,
        assistantId: uniqueId('missing')
      })
    ).rejects.toThrow();
  });

  it('creates, reads and renames a conversation scoped to its participants', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let title = uniqueId('conversation');

    let conversation = await productAssistantConversationService.createAssistantConversation({
      project: fixture.project,
      instance: fixture.instance,
      actor: fixture.resourceActor,
      input: { assistantId: 'test', title }
    });
    expect(conversation).toMatchObject({ title, projectOid: fixture.project.oid });
    expect(conversation.availableAssistant.slug).toBe('test');

    let fetched = await productAssistantConversationService.getAssistantConversationById({
      project: fixture.project,
      instance: fixture.instance,
      actor: fixture.resourceActor,
      conversationId: conversation.id
    });
    expect(fetched.assistantConversationParticipants.map(p => p.resourceActorOid)).toEqual([
      fixture.resourceActor.oid
    ]);

    let conversations = await firstPage(
      await productAssistantConversationService.listAssistantConversations({
        project: fixture.project,
        instance: fixture.instance,
        actor: fixture.resourceActor,
        assistantIds: ['test']
      })
    );
    expect(conversations.map(item => item.id)).toContain(conversation.id);

    let messages = await firstPage(
      await productAssistantMessageService.listAssistantMessages({
        project: fixture.project,
        instance: fixture.instance,
        actor: fixture.resourceActor,
        conversation
      })
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]!.message).toMatchObject({
      type: 'root',
      id: conversation.rootMessage.id
    });

    let rootMessage = await productAssistantMessageService.getAssistantMessageById({
      project: fixture.project,
      instance: fixture.instance,
      actor: fixture.resourceActor,
      conversation,
      messageId: conversation.rootMessage.id
    });
    expect(rootMessage.message.request?.status).toBe('completed');

    let renamed = await productAssistantConversationService.updateAssistantConversation({
      project: fixture.project,
      instance: fixture.instance,
      actor: fixture.resourceActor,
      conversation,
      input: { title: `${title}-renamed` }
    });
    expect(renamed.title).toBe(`${title}-renamed`);

    let outsider = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('e2e-outsider'), name: 'E2E Outsider' }
    });

    await expect(
      productAssistantConversationService.getAssistantConversationById({
        project: fixture.project,
        instance: fixture.instance,
        actor: outsider,
        conversationId: conversation.id
      })
    ).rejects.toThrow();

    let outsiderConversations = await firstPage(
      await productAssistantConversationService.listAssistantConversations({
        project: fixture.project,
        instance: fixture.instance,
        actor: outsider
      })
    );
    expect(outsiderConversations.map(item => item.id)).not.toContain(conversation.id);
  });
});
