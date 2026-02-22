import { mtMap } from '@metorial/util-resource-mapper';

export type ProvidersAuthMethodsGetOutput = {
  object: 'provider.capabilities.auth_method';
  id: string;
  type: 'oauth' | 'token' | 'custom';
  key: string;
  name: string;
  description: string | null;
  capabilities: Record<string, any>;
  inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  scopes:
    | {
        object: 'provider.capabilities.auth_method.scope';
        id: string;
        scope: string;
        name: string;
        description: string | null;
      }[]
    | null;
  providerId: string;
  providerSpecificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProvidersAuthMethodsGetOutput =
  mtMap.object<ProvidersAuthMethodsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    key: mtMap.objectField('key', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    capabilities: mtMap.objectField('capabilities', mtMap.passthrough()),
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
    scopes: mtMap.objectField(
      'scopes',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          scope: mtMap.objectField('scope', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough())
        })
      )
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerSpecificationId: mtMap.objectField(
      'provider_specification_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

