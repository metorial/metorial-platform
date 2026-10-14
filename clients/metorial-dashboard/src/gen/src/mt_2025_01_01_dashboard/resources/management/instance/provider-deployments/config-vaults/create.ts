import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsConfigVaultsCreateOutput = {
  object: 'provider.config_vault';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  deployment: {
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
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderDeploymentsConfigVaultsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsConfigVaultsCreateOutput>(
    [
      'provider_id',
      [
        'deployment',
        0,
        [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceProviderDeploymentsConfigVaultsCreateBody = {
  providerId: string;
  providerDeploymentId?: string | undefined;
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  value: Record<string, any>;
};

export let mapManagementInstanceProviderDeploymentsConfigVaultsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsConfigVaultsCreateBody>(
    ['provider_id', 'provider_deployment_id']
  );
