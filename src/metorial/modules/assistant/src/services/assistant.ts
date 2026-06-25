import { createSynthesisService } from '../lib/synthesisService';
import { synthesis } from '../synthesis';

export type AssistantModelWithProvider = NonNullable<
  Awaited<ReturnType<typeof synthesis.assistant.get>>['defaultModel']
>;

export type AvailableAssistant = Awaited<ReturnType<typeof synthesis.assistant.get>>;
export type AssistantWithRelations = AvailableAssistant;

export let assistantService = createSynthesisService(
  'assistantService',
  synthesis.assistant,
  ['get', 'getMany', 'list'],
  () => ({}),
  {
    includeEnvironment: false,
    includeActor: false
  }
);
