import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { type Instance, type Organization } from '@metorial/db';
import {
  enrichSynthesisActors,
  ensureSynthesisActor,
  ensureSynthesisScope,
  getAssistantActorInput,
  synthesis,
  type AssistantActorInput,
  type EnrichedAssistantActor
} from '../synthesis';

type SynthesisConversation = Awaited<ReturnType<typeof synthesis.conversation.get>>;

export type AssistantConversationWithAssistant = Omit<SynthesisConversation, 'createdByActor'> & {
  createdByActor: EnrichedAssistantActor;
};

class AssistantConversationServiceImpl {
  private ensureScope(d: {
    organization: Organization;
    instance: Instance;
  } & AssistantActorInput) {
    if (d.instance.organizationOid !== d.organization.oid) {
      throw new Error('Assistant conversation scope is invalid');
    }

    if (d.actor && d.actor.organizationOid !== d.organization.oid) {
      throw new Error('Assistant conversation scope is invalid');
    }
  }

  async getAssistantConversationById(
    d: {
    organization: Organization;
    instance: Instance;
    conversationId: string;
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

    let conversation = await synthesis.conversation.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId: actor.id,
      conversationId: d.conversationId
    });
    let [createdByActor] = await enrichSynthesisActors({
      instance: d.instance,
      actors: [conversation.createdByActor]
    });

    return {
      ...conversation,
      createdByActor: createdByActor!
    };
  }

  async listAssistantConversations(
    d: {
    organization: Organization;
    instance: Instance;
    assistantIds?: string[];
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
      let result = await synthesis.conversation.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        actorId: actor.id,
        assistantIds: d.assistantIds,
        ...input
      });
      let createdByActors = await enrichSynthesisActors({
        instance: d.instance,
        actors: result.items.map(item => item.createdByActor)
      });

      return {
        items: result.items.map((item, index) => ({
          ...item,
          createdByActor: createdByActors[index]!
        })),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async createAssistantConversation(
    d: {
    organization: Organization;
    instance: Instance;
    input: {
      assistantId: string;
      title?: string | null;
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

    let conversation = await synthesis.conversation.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId: actor.id,
      assistantId: d.input.assistantId,
      title: d.input.title ?? undefined
    });
    let [createdByActor] = await enrichSynthesisActors({
      instance: d.instance,
      actors: [conversation.createdByActor]
    });

    return {
      ...conversation,
      createdByActor: createdByActor!
    };
  }

  async updateAssistantConversation(
    d: {
    organization: Organization;
    instance: Instance;
    conversation: {
      id: string;
    };
    input: {
      title?: string | null;
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

    let conversation = await synthesis.conversation.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId: actor.id,
      conversationId: d.conversation.id,
      title: d.input.title ?? undefined
    });
    let [createdByActor] = await enrichSynthesisActors({
      instance: d.instance,
      actors: [conversation.createdByActor]
    });

    return {
      ...conversation,
      createdByActor: createdByActor!
    };
  }
}

export let assistantConversationService = Service.create(
  'assistantConversationService',
  () => new AssistantConversationServiceImpl()
).build();
