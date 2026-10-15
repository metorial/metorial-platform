import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersAuthMethodsGetOutput = {
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
  adapters: string[] | null;
  providerId: string;
  providerSpecificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProvidersAuthMethodsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProvidersAuthMethodsGetOutput>(
    [
      'input_schema',
      'output_schema',
      'provider_id',
      'provider_specification_id',
      'created_at',
      'updated_at'
    ],
    1
  );
