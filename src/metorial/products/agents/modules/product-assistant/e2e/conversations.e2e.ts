import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  productAssistantConversationService,
  productAssistantMessageService,
  productAssistantService
} from '../src';
import {
  conversationItems,
  createConversation,
  getTestAssistant,
  loadAssistantFixture,
  runTestTimeoutMs,
  runTimeoutMs,
  sendAndSettle
} from './_fixtures';

describe('module-product-assistant: conversations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a conversation with its root message, creator participant and root request', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let assistant = await getTestAssistant(fixture);
    let title = uniqueId('conversation');

    let conversation = await createConversation(fixture, { title });
    expect(conversation.availableAssistant).toMatchObject({
      id: assistant.id,
      defaultModel: { slug: assistant.defaultModel!.slug }
    });

    let assistantInstance = await productAssistantService.getOrCreateAssistantInstance({
      assistant,
      project: fixture.project
    });

    let row = await db.productAssistantConversation.findUniqueOrThrow({
      where: { id: conversation.id }
    });
    expect(row).toMatchObject({
      title,
      input: null,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      assistantOid: assistant.oid,
      assistantInstanceOid: assistantInstance.oid,
      createdByResourceActorOid: fixture.resourceActor.oid
    });

    let items = await conversationItems(conversation);
    expect(items).toHaveLength(1);
    expect(items[0]!.message).toMatchObject({
      oid: row.rootMessageOid,
      type: 'root',
      status: 'completed',
      parentMessageOid: null,
      state: { items: [] },
      serialized: { b: 'ai-sdk-1', messages: [] }
    });

    let participants = await db.productAssistantConversationParticipant.findMany({
      where: { conversationOid: row.oid }
    });
    expect(participants.map(participant => participant.resourceActorOid)).toEqual([
      fixture.resourceActor.oid
    ]);

    let rootRequest = await db.productAssistantRequest.findFirstOrThrow({
      where: { conversationOid: row.oid }
    });
    expect(rootRequest).toMatchObject({
      status: 'completed',
      historySize: 0,
      messageOid: row.rootMessageOid,
      modelOid: assistant.defaultModel!.oid,
      resourceActorOid: fixture.resourceActor.oid
    });
    expect(items[0]!.message.requestOid).toBe(rootRequest.oid);

    await expectServiceError(
      productAssistantConversationService.createAssistantConversation({
        project: fixture.project,
        instance: fixture.instance,
        actor: fixture.resourceActor,
        input: { assistantId: uniqueId('missing') }
      }),
      'not_found'
    );
  });

  it('lists conversations filtered by assistant id, slug or system identifier', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let assistant = await getTestAssistant(fixture);
    let first = await createConversation(fixture, { title: uniqueId('first') });
    let second = await createConversation(fixture);

    let list = async (assistantIds?: string[]) =>
      (
        await firstPage(
          await productAssistantConversationService.listAssistantConversations({
            project: fixture.project,
            instance: fixture.instance,
            actor: fixture.resourceActor,
            assistantIds
          })
        )
      ).map(conversation => conversation.id);

    for (let assistantIds of [undefined, ['test'], [assistant.id], ['explorer', 'test']]) {
      expect(await list(assistantIds)).toEqual(expect.arrayContaining([first.id, second.id]));
    }

    let explorerOnly = await list(['explorer']);
    expect(explorerOnly).not.toContain(first.id);
    expect(explorerOnly).not.toContain(second.id);
  });

  it('renames and clears a conversation title', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let title = uniqueId('title');
    let conversation = await createConversation(fixture, { title });

    let update = async (input: { title?: string | null }) =>
      await productAssistantConversationService.updateAssistantConversation({
        project: fixture.project,
        instance: fixture.instance,
        actor: fixture.resourceActor,
        conversation,
        input
      });

    let renamed = await update({ title: `${title}-renamed` });
    expect(renamed).toMatchObject({ id: conversation.id, title: `${title}-renamed` });
    expect(renamed.availableAssistant.slug).toBe('test');

    let untouched = await update({});
    expect(untouched.title).toBe(`${title}-renamed`);

    let cleared = await update({ title: null });
    expect(cleared.title).toBeNull();

    let row = await db.productAssistantConversation.findUniqueOrThrow({
      where: { id: conversation.id }
    });
    expect(row.title).toBeNull();
  });

  it(
    'titles an untitled conversation from its first user message through the queue',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let conversation = await createConversation(fixture);
      expect(conversation.title).toBeNull();

      let firstText = uniqueId('lisbon-trip');
      let first = await sendAndSettle(fixture, conversation, firstText);
      expect(first.request.status).toBe('completed');

      await eventually(
        async () => {
          let row = await db.productAssistantConversation.findUniqueOrThrow({
            where: { id: conversation.id }
          });
          expect(row.title).toBe(`E2E title: ${firstText}`);
        },
        { timeoutMs: runTimeoutMs }
      );

      let second = await sendAndSettle(fixture, conversation, uniqueId('follow-up'));
      expect(second.request.status).toBe('completed');

      let row = await db.productAssistantConversation.findUniqueOrThrow({
        where: { id: conversation.id }
      });
      expect(row.title).toBe(`E2E title: ${firstText}`);
    },
    runTestTimeoutMs
  );

  it(
    'keeps a title the user set',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let title = uniqueId('my-title');
      let conversation = await createConversation(fixture, { title });

      let sent = await sendAndSettle(fixture, conversation, uniqueId('message'));
      expect(sent.request.status).toBe('completed');

      let row = await db.productAssistantConversation.findUniqueOrThrow({
        where: { id: conversation.id }
      });
      expect(row.title).toBe(title);
    },
    runTestTimeoutMs
  );

  it('rejects an actor or instance from another project', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let otherFixture = await loadAssistantFixture(otherOrg.ids);
    let conversation = await createConversation(fixture);

    await expectServiceError(
      productAssistantConversationService.createAssistantConversation({
        project: fixture.project,
        instance: fixture.instance,
        actor: otherFixture.resourceActor,
        input: { assistantId: 'test' }
      }),
      'not_found'
    );

    await expectServiceError(
      productAssistantConversationService.createAssistantConversation({
        project: fixture.project,
        instance: otherFixture.instance,
        actor: fixture.resourceActor,
        input: { assistantId: 'test' }
      }),
      'not_found'
    );

    await expectServiceError(
      productAssistantConversationService.getAssistantConversationById({
        project: fixture.project,
        instance: fixture.instance,
        actor: otherFixture.resourceActor,
        conversationId: conversation.id
      }),
      'not_found'
    );
  });

  it('does not expose a conversation to another tenant, even without an actor', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let otherFixture = await loadAssistantFixture(otherOrg.ids);
    let title = uniqueId('private');
    let conversation = await createConversation(fixture, { title });

    for (let actor of [otherFixture.resourceActor, undefined]) {
      let scope = { project: otherFixture.project, instance: otherFixture.instance, actor };

      await expectServiceError(
        productAssistantConversationService.getAssistantConversationById({
          ...scope,
          conversationId: conversation.id
        }),
        'not_found'
      );

      let listed = await firstPage(
        await productAssistantConversationService.listAssistantConversations(scope)
      );
      expect(listed.map(item => item.id)).not.toContain(conversation.id);

      await expectServiceError(
        productAssistantConversationService.updateAssistantConversation({
          ...scope,
          conversation,
          input: { title: 'hijacked' }
        }),
        'not_found'
      );

      await expectServiceError(
        productAssistantMessageService.listAssistantMessages({ ...scope, conversation }),
        'not_found'
      );

      await expectServiceError(
        productAssistantMessageService.getAssistantMessageById({
          ...scope,
          conversation,
          messageId: conversation.rootMessage.id
        }),
        'not_found'
      );
    }

    let row = await db.productAssistantConversation.findUniqueOrThrow({
      where: { id: conversation.id }
    });
    expect(row.title).toBe(title);
  });
});
