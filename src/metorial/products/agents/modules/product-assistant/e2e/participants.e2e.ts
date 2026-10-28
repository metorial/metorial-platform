import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import type { ProductAssistantConversation, ResourceActor } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import {
  productAssistantConversationParticipantService,
  productAssistantConversationService,
  productAssistantMessageService,
  productAssistantRequestService
} from '../src';
import {
  conversationItems,
  createConversation,
  createOutsider,
  loadAssistantFixture,
  runTestTimeoutMs,
  sendAndSettle,
  sendMessage,
  type AssistantFixture
} from './_fixtures';

describe('module-product-assistant: participants', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let participantOids = async (conversation: ProductAssistantConversation) =>
    (
      await db.productAssistantConversationParticipant.findMany({
        where: { conversationOid: conversation.oid },
        orderBy: { oid: 'asc' }
      })
    ).map(participant => participant.resourceActorOid);

  let scopeOf = (fixture: AssistantFixture, actor?: ResourceActor) => ({
    project: fixture.project,
    instance: fixture.instance,
    actor
  });

  it('hides a conversation from an actor who is not a participant', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let outsider = await createOutsider(fixture);
    let title = uniqueId('private');
    let conversation = await createConversation(fixture, { title });
    let scope = scopeOf(fixture, outsider);

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
        input: { title: 'renamed by outsider' }
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

    await expectServiceError(
      sendMessage(fixture, conversation, uniqueId('intrusion'), { actor: outsider }),
      'not_found'
    );

    expect(await participantOids(conversation)).toEqual([fixture.resourceActor.oid]);
    expect(await conversationItems(conversation)).toHaveLength(1);

    let row = await db.productAssistantConversation.findUniqueOrThrow({
      where: { id: conversation.id }
    });
    expect(row.title).toBe(title);
  });

  it(
    'adds an actor as a participant when it posts with allowAllActors',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let outsider = await createOutsider(fixture);
      let conversation = await createConversation(fixture);

      let joined = await sendAndSettle(fixture, conversation, uniqueId('joined'), {
        actor: outsider,
        allowAllActors: true
      });
      expect(joined.request).toMatchObject({
        status: 'completed',
        resourceActorOid: outsider.oid
      });
      expect(await participantOids(conversation)).toEqual([
        fixture.resourceActor.oid,
        outsider.oid
      ]);

      expect(
        await productAssistantConversationParticipantService.hasConversationAccess({
          ...scopeOf(fixture, outsider),
          conversation
        })
      ).toBe(true);

      let fetched = await productAssistantConversationService.getAssistantConversationById({
        ...scopeOf(fixture, outsider),
        conversationId: conversation.id
      });
      expect(
        fetched.assistantConversationParticipants.map(
          participant => participant.resourceActorOid
        )
      ).toEqual(expect.arrayContaining([fixture.resourceActor.oid, outsider.oid]));

      let listed = await firstPage(
        await productAssistantConversationService.listAssistantConversations(
          scopeOf(fixture, outsider)
        )
      );
      expect(listed.map(item => item.id)).toEqual([conversation.id]);

      let messages = await firstPage(
        await productAssistantMessageService.listAssistantMessages({
          ...scopeOf(fixture, outsider),
          conversation
        })
      );
      expect(messages.map(item => item.message.type)).toEqual(['root', 'user', 'assistant']);

      let again = await sendAndSettle(fixture, conversation, uniqueId('again'), {
        actor: outsider
      });
      expect(again.request.status).toBe('completed');
      expect(await participantOids(conversation)).toEqual([
        fixture.resourceActor.oid,
        outsider.oid
      ]);
    },
    runTestTimeoutMs
  );

  it('gives actor-less callers access to every conversation of the instance', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let outsider = await createOutsider(fixture);
    let mine = await createConversation(fixture);
    let theirs = await createConversation(fixture, { actor: outsider });
    let scope = scopeOf(fixture);

    let listed = await firstPage(
      await productAssistantConversationService.listAssistantConversations(scope)
    );
    expect(listed.map(item => item.id)).toEqual(expect.arrayContaining([mine.id, theirs.id]));

    let fetched = await productAssistantConversationService.getAssistantConversationById({
      ...scope,
      conversationId: theirs.id
    });
    expect(fetched.createdByResourceActorOid).toBe(outsider.oid);

    let messages = await firstPage(
      await productAssistantMessageService.listAssistantMessages({
        ...scope,
        conversation: theirs
      })
    );
    expect(messages.map(item => item.message.id)).toEqual([theirs.rootMessage.id]);

    let ownList = await firstPage(
      await productAssistantConversationService.listAssistantConversations(
        scopeOf(fixture, fixture.resourceActor)
      )
    );
    expect(ownList.map(item => item.id)).toContain(mine.id);
    expect(ownList.map(item => item.id)).not.toContain(theirs.id);
  });

  it('does not let another tenant join or post into a conversation', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let otherFixture = await loadAssistantFixture(otherOrg.ids);
    let conversation = await createConversation(fixture);

    for (let allowAllActors of [false, true]) {
      await expectServiceError(
        sendMessage(otherFixture, conversation, uniqueId('cross-tenant'), { allowAllActors }),
        'not_found'
      );
    }

    expect(await participantOids(conversation)).toEqual([fixture.resourceActor.oid]);
    expect(await conversationItems(conversation)).toHaveLength(1);
    expect(
      await db.productAssistantRequest.count({
        where: {
          conversationOid: conversation.oid,
          resourceActorOid: otherFixture.resourceActor.oid
        }
      })
    ).toBe(0);
  });

  it(
    'rejects handoff responses for messages that are not waiting for the user',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let otherFixture = await loadAssistantFixture(otherOrg.ids);
      let outsider = await createOutsider(fixture);
      let conversation = await createConversation(fixture);
      let sent = await sendAndSettle(fixture, conversation, uniqueId('no-handoff'));
      expect(sent.request.status).toBe('completed');

      let respond = (
        messageId: string,
        input: { fixture?: AssistantFixture; actor?: ResourceActor; empty?: boolean } = {}
      ) => {
        let scopeFixture = input.fixture ?? fixture;

        return productAssistantRequestService.respondToAssistantHandoffs({
          project: scopeFixture.project,
          instance: scopeFixture.instance,
          actor: input.actor ?? scopeFixture.resourceActor,
          conversation,
          input: {
            messageId,
            responses: input.empty ? [] : [{ toolCallId: uniqueId('call'), output: 'ok' }]
          }
        });
      };

      let empty = await expectServiceError(
        respond(sent.reply!.id, { empty: true }),
        'bad_request'
      );
      expect(empty.message).toBe('At least one handoff response is required.');

      await expectServiceError(respond(uniqueId('message')), 'not_found');

      for (let messageId of [
        sent.reply!.id,
        sent.userMessage.id,
        conversation.rootMessage.id
      ]) {
        let notWaiting = await expectServiceError(respond(messageId), 'bad_request');
        expect(notWaiting.message).toBe(
          'Assistant message is not waiting for handoff responses.'
        );
      }

      await expectServiceError(respond(sent.reply!.id, { actor: outsider }), 'not_found');
      await expectServiceError(
        respond(sent.reply!.id, { fixture: otherFixture }),
        'not_found'
      );

      let reply = await db.productAssistantMessage.findUniqueOrThrow({
        where: { oid: sent.reply!.oid }
      });
      let request = await db.productAssistantRequest.findUniqueOrThrow({
        where: { oid: sent.request.oid },
        include: { runs: true }
      });
      expect(reply.status).toBe('completed');
      expect(request.status).toBe('completed');
      expect(request.runs.map(run => run.status)).toEqual(['completed']);
    },
    runTestTimeoutMs
  );
});
