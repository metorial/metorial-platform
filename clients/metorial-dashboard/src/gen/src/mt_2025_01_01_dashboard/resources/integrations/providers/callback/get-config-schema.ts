import { mtMap } from '@metorial/util-resource-mapper';

export type IntegrationsProvidersCallbackGetConfigSchemaOutput = {
  object: 'callback.config_schema';
  schema: Record<string, any> | null;
};

export let mapIntegrationsProvidersCallbackGetConfigSchemaOutput =
  mtMap.object<IntegrationsProvidersCallbackGetConfigSchemaOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    schema: mtMap.objectField('schema', mtMap.passthrough())
  });

export type IntegrationsProvidersCallbackGetConfigSchemaQuery = {
  triggerIds: string[];
};

export let mapIntegrationsProvidersCallbackGetConfigSchemaQuery =
  mtMap.object<IntegrationsProvidersCallbackGetConfigSchemaQuery>({
    triggerIds: mtMap.objectField(
      'trigger_ids',
      mtMap.array(mtMap.passthrough())
    )
  });

