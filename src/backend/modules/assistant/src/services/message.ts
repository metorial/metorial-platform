import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  type Instance,
  type Organization
} from '@metorial/db';
import {
  enrichSynthesisActors,
  type AssistantActorInput,
  ensureSynthesisActor,
  ensureSynthesisScope,
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

class AssistantMessageServiceImpl {
  private ensureScope(d: {
    organization: Organization;
    instance: Instance;
    conversation: {
      id: string;
    };
  } & AssistantActorInput) {
    if (d.instance.organizationOid !== d.organization.oid) {
      throw new Error('Assistant message scope is invalid');
    }

    if (d.actor && d.actor.organizationOid !== d.organization.oid) {
      throw new Error('Assistant message scope is invalid');
    }
  }

  async getAssistantMessageById(
    d: {
    organization: Organization;
    instance: Instance;
    conversation: {
      id: string;
    };
    messageId: string;
  } & AssistantActorInput
  ) {
    this.ensureScope(d);
    let scope = await ensureSynthesisScope({
      instance: d.instance
    });
    let actor = await ensureSynthesisActor({
      scope,
      ...getAssistantActorInput(d)
    });
    let item = await synthesis.message.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId: actor.id,
      conversationId: d.conversation.id,
      messageId: d.messageId
    });

    return await enrichMessage({
      scope,
      instance: d.instance,
      message: item
    });
  }

  async listAssistantMessages(
    d: {
    organization: Organization;
    instance: Instance;
    conversation: {
      id: string;
    };
  } & AssistantActorInput
  ) {
    this.ensureScope(d);
    let scope = await ensureSynthesisScope({
      instance: d.instance
    });
    let actor = await ensureSynthesisActor({
      scope,
      ...getAssistantActorInput(d)
    });

    return Paginator.create(() => async input => {
      let result = await synthesis.message.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        actorId: actor.id,
        conversationId: d.conversation.id,
        ...input
      });
      let actorIds = Array.from(
        new Set(
          result.items
            .map(item => item.request?.actorId)
            .filter((actorId): actorId is string => !!actorId)
        )
      );
      let actorsById = await getSynthesisActorsByIds({
        scope,
        actorIds
      });

      return {
        items: await Promise.all(
          result.items.map(message =>
            enrichMessage({
              scope,
              instance: d.instance,
              message,
              actorsById
            })
          )
        ),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }
}

export let assistantMessageService = Service.create(
  'assistantMessageService',
  () => new AssistantMessageServiceImpl()
).build();
