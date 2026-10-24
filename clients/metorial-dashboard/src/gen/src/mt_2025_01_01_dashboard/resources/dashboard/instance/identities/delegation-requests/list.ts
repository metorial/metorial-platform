import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIdentitiesDelegationRequestsListOutput = {
  items: {
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
    identityId: string;
    delegation: {
      object: 'identity.delegation';
      id: string;
      status:
        'waiting_for_consent' | 'denied' | 'active' | 'revoked' | 'expired';
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
          | 'api'
          | 'request_approval'
          | 'covered_by_previously_approved_delegation';
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
    expiresAt: Date;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceIdentitiesDelegationRequestsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceIdentitiesDelegationRequestsListOutput>(
    [
      7,
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
          [
            'delegation',
            0,
            [
              1,
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
              ]
            ]
          ],
          'expires_at',
          'created_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceIdentitiesDelegationRequestsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'pending'
    | 'approved'
    | 'denied'
    | 'canceled'
    | ('pending' | 'approved' | 'denied' | 'canceled')[]
    | undefined;
  id?: string | string[] | undefined;
  actorId?: string | string[] | undefined;
  identityId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceIdentitiesDelegationRequestsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceIdentitiesDelegationRequestsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'actor_id',
              'identity_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
