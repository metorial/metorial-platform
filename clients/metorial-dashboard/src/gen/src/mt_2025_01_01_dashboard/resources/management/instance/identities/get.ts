import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIdentitiesGetOutput = {
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
      type: 'person' | 'agent';
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      agentId: string | null;
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
};

export let mapManagementInstanceIdentitiesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceIdentitiesGetOutput>(
    [
      [
        'owner',
        0,
        [1, [['actor', 0, [1, ['agent_id', 'created_at', 'updated_at']]]]]
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
    ],
    1
  );
