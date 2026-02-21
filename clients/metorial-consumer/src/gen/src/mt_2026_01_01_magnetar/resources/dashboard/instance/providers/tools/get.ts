import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProvidersToolsGetOutput = {
  object: 'provider.tool';
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  inputSchema: Record<string, any> | null;
  outputSchema: Record<string, any> | null;
  providerId: string;
  providerSpecificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProvidersToolsGetOutput =
  mtMap.object<DashboardInstanceProvidersToolsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    title: mtMap.objectField('title', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    inputSchema: mtMap.objectField('input_schema', mtMap.passthrough()),
    outputSchema: mtMap.objectField('output_schema', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerSpecificationId: mtMap.objectField(
      'provider_specification_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

