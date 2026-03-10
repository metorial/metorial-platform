import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsAuthConfigsGetOutput = {
  object: 'provider.auth_config';
  id: string;
  type: 'manual' | 'oauth_automated' | 'oauth_manual';
  source: 'manual' | 'setup_session' | 'system';
  status: 'active' | 'archived';
  isDefault: boolean;
  providerId: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  deploymentPreview: {
    object: 'provider.deployment#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  credentials: {
    object: 'provider.auth_credentials';
    id: string;
    type: 'oauth';
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  authMethod: {
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
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderDeploymentsAuthConfigsGetOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsAuthConfigsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    deploymentPreview: mtMap.objectField(
      'deployment_preview',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    credentials: mtMap.objectField(
      'credentials',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    authMethod: mtMap.objectField(
      'auth_method',
      mtMap.object({
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
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

