import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsAuthCredentialsListOutput = {
  items: {
    object: 'provider.auth_credentials';
    id: string;
    type: 'oauth';
    status: 'active' | 'archived' | 'deleted';
    isDefault: boolean;
    isManaged: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    scopes: string[] | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderDeploymentsAuthCredentialsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsAuthCredentialsListOutput>(
    [
      7,
      [
        1,
        ['is_default', 'is_managed', 'provider_id', 'created_at', 'updated_at']
      ]
    ],
    1
  );

export type ManagementInstanceProviderDeploymentsAuthCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerAuthMethodId?: string | string[] | undefined;
  origin?: 'custom' | 'managed' | ('custom' | 'managed')[] | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceProviderDeploymentsAuthCredentialsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsAuthCredentialsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_id',
              'provider_auth_method_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
