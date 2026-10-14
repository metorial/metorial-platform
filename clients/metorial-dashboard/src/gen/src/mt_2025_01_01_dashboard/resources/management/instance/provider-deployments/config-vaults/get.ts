import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsConfigVaultsGetOutput = {
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

export let mapManagementInstanceProviderDeploymentsConfigVaultsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsConfigVaultsGetOutput>(
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
