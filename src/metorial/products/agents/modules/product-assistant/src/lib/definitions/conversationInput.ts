import { ServiceError, validationError } from '@lowerdeck/error';
import type {
  ProductAssistant,
  ProductAssistantImplementation,
  ProductAssistantInstance,
  ResourceActor,
  ResourceGroup,
  ResourceTenant
} from '@metorial/db';
import type { Implementation } from './implementation';

export let resolveAssistantConversationInput = async (d: {
  tenant: ResourceTenant;
  environment: ResourceGroup;
  actor: ResourceActor;
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
    tenant: d.tenant,
    environment: d.environment,
    actor: d.actor,
    assistant: d.assistant,
    assistantInstance: d.assistantInstance,
    assistantImplementation:
      assistantImplementation._persisted as unknown as ProductAssistantImplementation
  });
};
