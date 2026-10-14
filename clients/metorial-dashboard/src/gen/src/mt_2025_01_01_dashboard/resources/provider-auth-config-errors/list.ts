import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderAuthConfigErrorsListOutput = {
  items: {
    object: 'provider.auth_config_error';
    id: string;
    status: 'processing' | 'processed';
    type: string;
    code: string;
    message: string;
    authConfigEventId: string | null;
    providerAuthConfigId: string | null;
    providerAuthCredentialsId: string | null;
    providerOauthSetupId: string | null;
    providerId: string;
    providerInvocationId: string | null;
    groupId: string | null;
    similarErrorCount: number;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProviderAuthConfigErrorsListOutput =
  /* @__PURE__ */ createMapper<ProviderAuthConfigErrorsListOutput>(
    [
      7,
      [
        1,
        [
          'auth_config_event_id',
          'provider_auth_config_id',
          'provider_auth_credentials_id',
          'provider_oauth_setup_id',
          'provider_id',
          'provider_invocation_id',
          'group_id',
          'similar_error_count',
          'created_at'
        ]
      ]
    ],
    1
  );

export type ProviderAuthConfigErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  authConfigEventId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  providerOauthSetupId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerAuthConfigErrorGroupId?: string | string[] | undefined;
  providerInvocationId?: string | string[] | undefined;
  type?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapProviderAuthConfigErrorsListQuery =
  /* @__PURE__ */ createMapper<ProviderAuthConfigErrorsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'auth_config_event_id',
            'provider_auth_config_id',
            'provider_auth_credentials_id',
            'provider_oauth_setup_id',
            'provider_id',
            'provider_auth_config_error_group_id',
            'provider_invocation_id',
            ['created_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
