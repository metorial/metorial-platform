import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProvidersToolsGetOutput = {
  object: 'provider.tool';
  id: string;
  key: string;
  name: string;
  description: string | null;
  capabilities: Record<string, any>;
  constraints: string[];
  instructions: string[];
  inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  tags: {
    destructive?: boolean | undefined;
    readOnly?: boolean | undefined;
  } | null;
  specificationId: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProvidersToolsGetOutput =
  mtMap.object<DashboardInstanceProvidersToolsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    key: mtMap.objectField('key', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    capabilities: mtMap.objectField('capabilities', mtMap.passthrough()),
    constraints: mtMap.objectField(
      'constraints',
      mtMap.array(mtMap.passthrough())
    ),
    instructions: mtMap.objectField(
      'instructions',
      mtMap.array(mtMap.passthrough())
    ),
    inputSchema: mtMap.objectField(
      'input_schema',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        schema: mtMap.objectField('schema', mtMap.passthrough())
      })
    ),
    outputSchema: mtMap.objectField(
      'output_schema',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        schema: mtMap.objectField('schema', mtMap.passthrough())
      })
    ),
    tags: mtMap.objectField(
      'tags',
      mtMap.object({
        destructive: mtMap.objectField('destructive', mtMap.passthrough()),
        readOnly: mtMap.objectField('read_only', mtMap.passthrough())
      })
    ),
    specificationId: mtMap.objectField('specification_id', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

