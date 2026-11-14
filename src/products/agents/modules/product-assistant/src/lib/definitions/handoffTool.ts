import { tool } from 'ai';

export type ClientHandoffToolMetadata = {
  title: string;
  description?: string;
};

export let handoffToolMetadataKey = Symbol.for('metorial.synthesis.handoffTool');

export type ClientHandoffTool = {
  [handoffToolMetadataKey]?: ClientHandoffToolMetadata;
};

export let handoffTool = (d: {
  title: string;
  description?: string;
  inputSchema: any;
  outputSchema?: any;
}) => {
  let definition = tool({
    description: d.description,
    inputSchema: d.inputSchema
  }) as ClientHandoffTool;

  definition[handoffToolMetadataKey] = {
    title: d.title,
    description: d.description
  };

  return definition;
};

export let getHandoffToolMetadata = (
  toolDefinition: unknown
): ClientHandoffToolMetadata | undefined => {
  if (!toolDefinition || typeof toolDefinition != 'object') return undefined;
  return (toolDefinition as ClientHandoffTool)[handoffToolMetadataKey];
};
