import { createMapper } from '@metorial/util-resource-mapper/compact';

export type IdentitiesListOutput = {
  items: {
    object: 'identity';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    owner: {
      type: 'actor';
      actor: {
        object: 'identity.actor';
        id: string;
        type: 'person' | 'agent' | 'consumer';
        status: 'active' | 'archived' | 'deleted';
        name: string;
        description: string | null;
        metadata: Record<string, any> | null;
        agentId: string | null;
        consumerId: string | null;
        defaultIdentityId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    };
    credentials: {
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
    delegationConfigId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapIdentitiesListOutput =
  /* @__PURE__ */ createMapper<IdentitiesListOutput>(
    [
      7,
      [
        1,
        [
          [
            'owner',
            0,
            [
              1,
              [
                [
                  'actor',
                  0,
                  [
                    1,
                    [
                      'agent_id',
                      'consumer_id',
                      'default_identity_id',
                      'created_at',
                      'updated_at'
                    ]
                  ]
                ]
              ]
            ]
          ],
          [
            'credentials',
            0,
            [
              2,
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
            ]
          ],
          'delegation_config_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type IdentitiesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  agentId?: string | string[] | undefined;
  actorId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapIdentitiesListQuery =
  /* @__PURE__ */ createMapper<IdentitiesListQuery>([
    3,
    [
      [
        0,
        [
          1,
          ['agent_id', 'actor_id', ['created_at', 1, 5], ['updated_at', 1, 5]]
        ]
      ]
    ]
  ]);
