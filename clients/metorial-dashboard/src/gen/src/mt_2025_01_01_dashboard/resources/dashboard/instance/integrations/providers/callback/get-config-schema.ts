import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput =
  { object: 'callback.config_schema'; schema: Record<string, any> | null };

export let mapDashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput =
  mtMap.object<DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      schema: mtMap.objectField('schema', mtMap.passthrough())
    }
  );

export type DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery =
  { triggerIds: string[] };

export let mapDashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery =
  mtMap.object<DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery>(
    {
      triggerIds: mtMap.objectField(
        'trigger_ids',
        mtMap.array(mtMap.passthrough())
      )
    }
  );

