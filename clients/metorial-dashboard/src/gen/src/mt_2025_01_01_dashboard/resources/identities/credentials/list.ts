import { createMapper } from '@metorial/util-resource-mapper/compact';

export type IdentitiesCredentialsListOutput = {
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

export let mapIdentitiesCredentialsListOutput =
  /* @__PURE__ */ createMapper<IdentitiesCredentialsListOutput>(
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

export type IdentitiesCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  agentId?: string | string[] | undefined;
  actorId?: string | string[] | undefined;
  consumerProfileId?: string | string[] | undefined;
  identityId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapIdentitiesCredentialsListQuery =
  /* @__PURE__ */ createMapper<IdentitiesCredentialsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'agent_id',
            'actor_id',
            'consumer_profile_id',
            'identity_id',
            'provider_id',
            'provider_deployment_id',
            'provider_config_id',
            'provider_auth_config_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
