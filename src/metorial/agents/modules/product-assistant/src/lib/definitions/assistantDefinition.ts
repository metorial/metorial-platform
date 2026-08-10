import { notFoundError, ServiceError } from '@lowerdeck/error';
import { assistants } from '../../definitions/assistants';

export type AssistantDefinition = Awaited<(typeof assistants)[keyof typeof assistants]>;

export let getAssistantDefinition = async (
  implementationSlug: string
): Promise<AssistantDefinition> => {
  let definitions = await Promise.all(Object.values(assistants));
  let definition = definitions.find(
    definition => definition.implementation._persisted.slug == implementationSlug
  );

  if (!definition) {
    throw new ServiceError(notFoundError('assistant_implementation', implementationSlug));
  }

  return definition;
};
