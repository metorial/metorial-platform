import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderDeploymentsAuthConfigsImportsCreateOutput = {
  object: 'provider.auth_import';
  id: string;
  note: string;
  metadata: Record<string, any> | null;
  providerId: string | null;
  providerDeploymentId: string | null;
  providerAuthConfigId: string | null;
  providerAuthMethodId: string | null;
  createdAt: Date;
};

export let mapProviderDeploymentsAuthConfigsImportsCreateOutput =
  mtMap.object<ProviderDeploymentsAuthConfigsImportsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    providerAuthConfigId: mtMap.objectField(
      'provider_auth_config_id',
      mtMap.passthrough()
    ),
    providerAuthMethodId: mtMap.objectField(
      'provider_auth_method_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type ProviderDeploymentsAuthConfigsImportsCreateBody = {
  note: string;
  metadata?: Record<string, any> | undefined;
  providerAuthMethodId?: string | undefined;
  value: Record<string, any>;
};

export let mapProviderDeploymentsAuthConfigsImportsCreateBody =
  mtMap.object<ProviderDeploymentsAuthConfigsImportsCreateBody>({
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerAuthMethodId: mtMap.objectField(
      'providerAuthMethodId',
      mtMap.passthrough()
    ),
    value: mtMap.objectField('value', mtMap.passthrough())
  });

