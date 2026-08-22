import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput =
  { object: 'callback.config_schema'; schema: Record<string, any> | null };

export let mapManagementInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput =
  mtMap.object<ManagementInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      schema: mtMap.objectField('schema', mtMap.passthrough())
    }
  );

export type ManagementInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery =
  { triggerIds: string[] };

export let mapManagementInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery =
  mtMap.object<ManagementInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery>(
    {
      triggerIds: mtMap.objectField(
        'trigger_ids',
        mtMap.array(mtMap.passthrough())
      )
    }
  );

