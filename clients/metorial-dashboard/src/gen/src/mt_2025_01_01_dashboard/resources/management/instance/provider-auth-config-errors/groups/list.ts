import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderAuthConfigErrorsGroupsListOutput = {
  items: {
    object: 'provider.auth_config_error_group';
    id: string;
    type: string;
    code: string;
    message: string;
    providerId: string;
    occurrenceCount: number;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderAuthConfigErrorsGroupsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderAuthConfigErrorsGroupsListOutput>(
    [7, [1, ['provider_id', 'occurrence_count', 'created_at']]],
    1
  );

export type ManagementInstanceProviderAuthConfigErrorsGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  type?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  search?: string | undefined;
};

export let mapManagementInstanceProviderAuthConfigErrorsGroupsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderAuthConfigErrorsGroupsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_id',
              'provider_auth_config_id',
              'provider_auth_credentials_id',
              ['created_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
