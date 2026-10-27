import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderAuthConfigEventsListOutput = {
  items: {
    object: 'provider.auth_config_event';
    id: string;
    type: string;
    status: 'success' | 'error';
    sourceType: string;
    sourceId: string;
    providerAuthConfigId: string | null;
    providerAuthCredentialsId: string | null;
    providerOauthSetupId: string | null;
    providerId: string;
    providerAuthErrorId: string | null;
    providerInvocationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderAuthConfigEventsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderAuthConfigEventsListOutput>(
    [
      7,
      [
        1,
        [
          'source_type',
          'source_id',
          'provider_auth_config_id',
          'provider_auth_credentials_id',
          'provider_oauth_setup_id',
          'provider_id',
          'provider_auth_error_id',
          'provider_invocation_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceProviderAuthConfigEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  providerOauthSetupId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerInvocationId?: string | string[] | undefined;
  type?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  search?: string | undefined;
};

export let mapManagementInstanceProviderAuthConfigEventsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderAuthConfigEventsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_auth_config_id',
              'provider_auth_credentials_id',
              'provider_oauth_setup_id',
              'provider_id',
              'provider_invocation_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
