import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProvidersAuthMethodsGetOutput = {
  object: 'provider.auth_method';
  id: string;
  type: 'oauth' | 'token' | 'custom';
  name: string;
  description: string | null;
  inputSchema: Record<string, any> | null;
  scopes:
    | {
        object: 'provider.auth_method.scope';
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

export let mapDashboardInstanceProvidersAuthMethodsGetOutput =
  mtMap.object<DashboardInstanceProvidersAuthMethodsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    inputSchema: mtMap.objectField('input_schema', mtMap.passthrough()),
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

