import { type Instance, type Organization } from '@metorial/db';
import { assertAssistantScope } from '../lib/assertAssistantScope';
import { createSynthesisService, getSynthesisServicePayload } from '../lib/synthesisService';
import {
  enrichSynthesisActors,
  type AssistantActorInput,
  getAssistantActorInput,
  getSynthesisActorsByIds,
  synthesis,
  type EnrichedAssistantActor,
  type SynthesisScope
} from '../synthesis';

type SynthesisMessage = Awaited<ReturnType<typeof synthesis.message.get>>;

type EnrichedSynthesisRequest = NonNullable<SynthesisMessage['request']> & {
  actor: EnrichedAssistantActor | null;
};

export type AssistantConversationItemWithMessage = Omit<SynthesisMessage, 'request'> & {
  request: EnrichedSynthesisRequest | null;
};

export let enrichMessage = async (d: {
  scope: SynthesisScope;
  instance: Instance;
  message: SynthesisMessage;
  actorsById?: Map<string, Awaited<ReturnType<typeof synthesis.actor.get>>>;
}): Promise<AssistantConversationItemWithMessage> => {
  if (!d.message.request?.actorId) {
    return {
      ...d.message,
      request: d.message.request
        ? {
            ...d.message.request,
            actor: null
          }
        : null
    };
  }

  let actorsById =
    d.actorsById ??
    (await getSynthesisActorsByIds({
      scope: d.scope,
      actorIds: [d.message.request.actorId]
    }));
  let synthesisActor = actorsById.get(d.message.request.actorId) ?? null;
  let [actor] = synthesisActor
    ? await enrichSynthesisActors({
        instance: d.instance,
        actors: [synthesisActor]
      })
    : [null];

  return {
    ...d.message,
    request: {
      ...d.message.request,
      actor
    }
  };
};

export let assistantMessageService = createSynthesisService(
  'assistantMessageService',
  synthesis.message,
  ['get', 'list'],
  inner => ({
    get: async (
      d: {
        organization: Organization;
        instance: Instance;
        conversationId: string;
        messageId: string;
      } & AssistantActorInput
    ) => {
      assertAssistantScope(d);

      let { context, payload } = await getSynthesisServicePayload({
        instance: d.instance,
        ...getAssistantActorInput(d),
        conversationId: d.conversationId,
        messageId: d.messageId
      });

      return await enrichMessage({
        scope: context.scope,
        instance: d.instance,
        message: await synthesis.message.get(
          payload as Parameters<typeof synthesis.message.get>[0]
        )
      });
    },

    list: async (
      d: {
        organization: Organization;
        instance: Instance;
        conversationId: string;
      } & AssistantActorInput
    ) => {
      assertAssistantScope(d);

      let paginator = await inner.list({
        instance: d.instance,
        ...getAssistantActorInput(d),
        conversationId: d.conversationId
      });

      return paginator.mapWithContext(async (items, context) => {
        let actorIds = Array.from(
          new Set(
            items
              .map(item => item.request?.actorId)
              .filter((actorId): actorId is string => !!actorId)
          )
        );
        let actorsById = await getSynthesisActorsByIds({
          scope: context.scope,
          actorIds
        });

        return await Promise.all(
          items.map(message =>
            enrichMessage({
              scope: context.scope,
              instance: d.instance,
              message,
              actorsById
            })
          )
        );
      });
    }
  })
);
