import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumerIdentityCredentialsListOutput = {
  items: {
    object: 'identity.credential';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    identityId: string;
    providerId: string;
    deploymentId: string | null;
    configId: string | null;
    authConfigId: string | null;
    delegationConfigId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumerIdentityCredentialsListOutput =
  /* @__PURE__ */ createMapper<ConsumerIdentityCredentialsListOutput>(
    [
      7,
      [
        1,
        [
          'identity_id',
          'provider_id',
          'deployment_id',
          'config_id',
          'auth_config_id',
          'delegation_config_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ConsumerIdentityCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  providerId?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
};

export let mapConsumerIdentityCredentialsListQuery =
  /* @__PURE__ */ createMapper<ConsumerIdentityCredentialsListQuery>([
    3,
    [[0, [1, ['provider_id']]]]
  ]);
