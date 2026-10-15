import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsConfigVaultsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderDeploymentsConfigVaultsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsConfigVaultsListOutput>(
    [
      7,
      [
        1,
        [
          'provider_id',
          [
            'deployment',
            0,
            [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
          ],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceProviderDeploymentsConfigVaultsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerConfigVaultId?: string | string[] | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceProviderDeploymentsConfigVaultsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsConfigVaultsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_id',
              'provider_deployment_id',
              'provider_config_id',
              'provider_config_vault_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
