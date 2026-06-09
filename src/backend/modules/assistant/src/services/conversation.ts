import { type Instance, type Organization } from '@metorial/db';
import { assertAssistantScope } from '../lib/assertAssistantScope';
import { createSynthesisService } from '../lib/synthesisService';
import {
  enrichSynthesisActors,
  getAssistantActorInput,
  synthesis,
  type AssistantActorInput,
  type EnrichedAssistantActor
} from '../synthesis';

type SynthesisConversation = Awaited<ReturnType<typeof synthesis.conversation.get>>;

export type AssistantConversationWithAssistant = Omit<
  SynthesisConversation,
  'createdByActor'
> & {
  createdByActor: EnrichedAssistantActor;
};

let enrichConversations = async (d: {
  instance: Instance;
  conversations: SynthesisConversation[];
}): Promise<AssistantConversationWithAssistant[]> => {
  let createdByActors = await enrichSynthesisActors({
    instance: d.instance,
    actors: d.conversations.map(conversation => conversation.createdByActor)
  });

  return d.conversations.map((conversation, index) => ({
    ...conversation,
    createdByActor: createdByActors[index]!
  }));
};

let enrichConversation = async (d: {
  instance: Instance;
  conversation: SynthesisConversation;
}): Promise<AssistantConversationWithAssistant> => {
  let [conversation] = await enrichConversations({
    instance: d.instance,
    conversations: [d.conversation]
  });

  return conversation!;
};

export let assistantConversationService = createSynthesisService(
  'assistantConversationService',
  synthesis.conversation,
  ['get', 'list', 'create', 'update'],
  inner => ({
    get: async (
      d: {
        organization: Organization;
        instance: Instance;
        conversationId: string;
      } & AssistantActorInput
    ) => {
      assertAssistantScope(d);

      return await enrichConversation({
        instance: d.instance,
        conversation: await inner.get({
          instance: d.instance,
          ...getAssistantActorInput(d),
          conversationId: d.conversationId
        })
      });
    },

    list: async (
      d: {
        organization: Organization;
        instance: Instance;
        assistantIds?: string[];
      } & AssistantActorInput
    ) => {
      assertAssistantScope(d);

      let paginator = await inner.list({
        instance: d.instance,
        ...getAssistantActorInput(d),
        assistantIds: d.assistantIds
      });

      return paginator.map(conversations =>
        enrichConversations({
          instance: d.instance,
          conversations
        })
      );
    },

    create: async (
      d: {
        organization: Organization;
        instance: Instance;
        assistantId: string;
        title?: string | null;
      } & AssistantActorInput
    ) => {
      assertAssistantScope(d);

      return await enrichConversation({
        instance: d.instance,
        conversation: await inner.create({
          instance: d.instance,
          ...getAssistantActorInput(d),
          assistantId: d.assistantId,
          title: d.title ?? undefined
        })
      });
    },

    update: async (
      d: {
        organization: Organization;
        instance: Instance;
        conversationId: string;
        title?: string | null;
      } & AssistantActorInput
    ) => {
      assertAssistantScope(d);

      return await enrichConversation({
        instance: d.instance,
        conversation: await inner.update({
          instance: d.instance,
          ...getAssistantActorInput(d),
          conversationId: d.conversationId,
          title: d.title ?? undefined
        })
      });
    }
  })
);
