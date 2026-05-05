import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderTemplatesCreateOutput = {
  object: 'provider.template';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  integrationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderTemplatesCreateOutput =
  mtMap.object<ProviderTemplatesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    integrationId: mtMap.objectField('integration_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ProviderTemplatesCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providers: {
    providerId: string;
    providerDeploymentId?: string | null | undefined;
    providerAuthMethodId?: string | null | undefined;
    providerAuthCredentialsId?: string | null | undefined;
    providerConfigId?: string | null | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    metadata?: Record<string, any> | null | undefined;
    toolFilters?: any | undefined;
  }[];
};

export let mapProviderTemplatesCreateBody =
  mtMap.object<ProviderTemplatesCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providers: mtMap.objectField(
      'providers',
      mtMap.array(
        mtMap.object({
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          providerDeploymentId: mtMap.objectField(
            'provider_deployment_id',
            mtMap.passthrough()
          ),
          providerAuthMethodId: mtMap.objectField(
            'provider_auth_method_id',
            mtMap.passthrough()
          ),
          providerAuthCredentialsId: mtMap.objectField(
            'provider_auth_credentials_id',
            mtMap.passthrough()
          ),
          providerConfigId: mtMap.objectField(
            'provider_config_id',
            mtMap.passthrough()
          ),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          toolFilters: mtMap.objectField('tool_filters', mtMap.passthrough())
        })
      )
    )
  });

