import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderDeploymentsAuthConfigsExportsCreateOutput = {
  object: 'provider.auth_export';
  id: string;
  note: string;
  metadata: Record<string, any> | null;
  providerAuthConfigId: string;
  value: Record<string, any>;
  createdAt: Date;
};

export let mapProviderDeploymentsAuthConfigsExportsCreateOutput =
  mtMap.object<ProviderDeploymentsAuthConfigsExportsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerAuthConfigId: mtMap.objectField(
      'provider_auth_config_id',
      mtMap.passthrough()
    ),
    value: mtMap.objectField('value', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type ProviderDeploymentsAuthConfigsExportsCreateBody = {
  note: string;
  metadata?: Record<string, any> | undefined;
};

export let mapProviderDeploymentsAuthConfigsExportsCreateBody =
  mtMap.object<ProviderDeploymentsAuthConfigsExportsCreateBody>({
    note: mtMap.objectField('note', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

