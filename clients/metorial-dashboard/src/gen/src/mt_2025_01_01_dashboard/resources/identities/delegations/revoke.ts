import { mapObject } from '@metorial/util-resource-mapper/compact';

export type IdentitiesDelegationsRevokeOutput = {
  object: 'identity.delegation';
  id: string;
  status: 'waiting_for_consent' | 'denied' | 'active' | 'revoked' | 'expired';
  deniedReason:
    | 'request_denied'
    | 'sub_delegation_depth_exceeded'
    | 'sub_delegation_denied'
    | null;
  delegationLevel: number;
  permissions: ('provider:call' | 'provider:read')[];
  attestation: {
    object: 'identity.delegation_attestation';
    id: string;
    type:
      'api' | 'request_approval' | 'covered_by_previously_approved_delegation';
    createdAt: Date;
  } | null;
  note: string | null;
  metadata: Record<string, any> | null;
  identity: {
    object: 'identity#preview';
    id: string;
    name: string;
    description: string;
    metadata: Record<string, any> | null;
  };
  delegationConfigId: string | null;
  parties: {
    object: 'identity.delegation_party';
    id: string;
    roles: ('owner' | 'delegator' | 'delegatee')[];
    actor: {
      object: 'identity.actor';
      id: string;
      type: 'person' | 'agent' | 'consumer' | 'organization_member';
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
    createdAt: Date;
  }[];
  request: {
    object: 'identity.delegation_request';
    id: string;
    status: 'pending' | 'approved' | 'denied' | 'canceled';
    deniedReason:
      | 'request_denied'
      | 'sub_delegation_depth_exceeded'
      | 'sub_delegation_denied'
      | null;
    requester: {
      object: 'identity.actor';
      id: string;
      type: 'person' | 'agent' | 'consumer' | 'organization_member';
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
    identityId: string;
    expiresAt: Date;
    createdAt: Date;
  } | null;
  credentialOverrides: {
    object: 'identity.delegation_credential_override';
    id: string;
    status: 'active' | 'expired';
    permissions: ('provider:call' | 'provider:read')[];
    credentialId: string;
    createdAt: Date;
    expiresAt: Date | null;
  }[];
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export let mapIdentitiesDelegationsRevokeOutput =
  /* @__PURE__ */ mapObject<IdentitiesDelegationsRevokeOutput>(
    [
      'denied_reason',
      'delegation_level',
      ['attestation', 0, [1, ['created_at']]],
      'delegation_config_id',
      [
        'parties',
        0,
        [
          2,
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
              ],
              'created_at'
            ]
          ]
        ]
      ],
      [
        'request',
        0,
        [
          1,
          [
            'denied_reason',
            [
              'requester',
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
            ],
            'identity_id',
            'expires_at',
            'created_at'
          ]
        ]
      ],
      [
        'credential_overrides',
        1,
        [2, [1, ['credential_id', 'created_at', 'expires_at']]]
      ],
      'created_at',
      'expires_at',
      'revoked_at'
    ],
    1
  );
