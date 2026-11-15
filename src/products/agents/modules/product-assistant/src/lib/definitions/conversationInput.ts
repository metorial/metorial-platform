import { ServiceError, validationError } from '@lowerdeck/error';
import type {
  Instance,
  ProductAssistant,
  ProductAssistantImplementation,
  ProductAssistantInstance,
  Project,
  ResourceActor
} from '@metorial/db';
import type { AssistantAccess, Implementation } from './implementation';

export let resolveAssistantConversationInput = async (d: {
  project: Project;
  instance: Instance;
  actor: ResourceActor;
  access?: AssistantAccess;
  assistant: ProductAssistant;
  assistantInstance: ProductAssistantInstance;
  assistantImplementation: Implementation;
  rawInput: unknown;
  rawInputProvided: boolean;
}) => {
  let assistantImplementation = d.assistantImplementation;

  if (!assistantImplementation.input || !assistantImplementation.handleInput) {
    if (d.rawInputProvided) {
      d.rawInput = {};
      d.rawInputProvided = false;
    }

    return undefined;
  }

  let valRes = assistantImplementation.input.validate(d.rawInput);
  if (!valRes.success) {
    throw new ServiceError(
      validationError({
        entity: 'assistant_conversation.input',
        errors: valRes.errors
      })
    );
  }

  return await assistantImplementation.handleInput({
    input: valRes.value,
    project: d.project,
    instance: d.instance,
    actor: d.actor,
    access: d.access,
    assistant: d.assistant,
    assistantInstance: d.assistantInstance,
    assistantImplementation:
      assistantImplementation._persisted as unknown as ProductAssistantImplementation
  });
};

export let resolveAssistantRequestInput = async (d: {
  project: Project;
  instance: Instance;
  actor: ResourceActor;
  access?: AssistantAccess;
  assistant: ProductAssistant;
  assistantInstance: ProductAssistantInstance;
  assistantImplementation: Implementation;
  conversationInput: unknown;
  rawInput: unknown;
}) => {
  let assistantImplementation = d.assistantImplementation;

  if (!assistantImplementation.requestInput || !assistantImplementation.handleRequestInput) {
    return undefined;
  }

  let valRes = assistantImplementation.requestInput.validate(d.rawInput ?? {});
  if (!valRes.success) {
    throw new ServiceError(
      validationError({
        entity: 'assistant_message.context',
        errors: valRes.errors
      })
    );
  }

  return await assistantImplementation.handleRequestInput({
    requestInput: valRes.value,
    conversationInput: d.conversationInput,
    project: d.project,
    instance: d.instance,
    actor: d.actor,
    access: d.access,
    assistant: d.assistant,
    assistantInstance: d.assistantInstance,
    assistantImplementation:
      assistantImplementation._persisted as unknown as ProductAssistantImplementation
  });
};
