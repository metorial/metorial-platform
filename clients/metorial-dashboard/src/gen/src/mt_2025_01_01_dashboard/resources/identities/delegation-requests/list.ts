import { mtMap } from '@metorial/util-resource-mapper';

export type IdentitiesDelegationRequestsListOutput = {
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
      type: 'person' | 'agent';
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      agentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    identityId: string;
    delegation: {
      object: 'identity.delegation';
      id: string;
      status:
        | 'waiting_for_consent'
        | 'denied'
        | 'active'
        | 'revoked'
        | 'expired';
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
          type: 'person' | 'agent';
          status: 'active' | 'archived' | 'deleted';
          name: string;
          description: string | null;
          metadata: Record<string, any> | null;
          agentId: string | null;
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
          type: 'person' | 'agent';
          status: 'active' | 'archived' | 'deleted';
          name: string;
          description: string | null;
          metadata: Record<string, any> | null;
          agentId: string | null;
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

export let mapIdentitiesDelegationRequestsListOutput =
  mtMap.object<IdentitiesDelegationRequestsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          deniedReason: mtMap.objectField('denied_reason', mtMap.passthrough()),
          requester: mtMap.objectField(
            'requester',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              agentId: mtMap.objectField('agent_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          identityId: mtMap.objectField('identity_id', mtMap.passthrough()),
          delegation: mtMap.objectField(
            'delegation',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              deniedReason: mtMap.objectField(
                'denied_reason',
                mtMap.passthrough()
              ),
              delegationLevel: mtMap.objectField(
                'delegation_level',
                mtMap.passthrough()
              ),
              permissions: mtMap.objectField(
                'permissions',
                mtMap.array(mtMap.passthrough())
              ),
              attestation: mtMap.objectField(
                'attestation',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              note: mtMap.objectField('note', mtMap.passthrough()),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              identity: mtMap.objectField(
                'identity',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  metadata: mtMap.objectField('metadata', mtMap.passthrough())
                })
              ),
              delegationConfigId: mtMap.objectField(
                'delegation_config_id',
                mtMap.passthrough()
              ),
              parties: mtMap.objectField(
                'parties',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    roles: mtMap.objectField(
                      'roles',
                      mtMap.array(mtMap.passthrough())
                    ),
                    actor: mtMap.objectField(
                      'actor',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        type: mtMap.objectField('type', mtMap.passthrough()),
                        status: mtMap.objectField(
                          'status',
                          mtMap.passthrough()
                        ),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        description: mtMap.objectField(
                          'description',
                          mtMap.passthrough()
                        ),
                        metadata: mtMap.objectField(
                          'metadata',
                          mtMap.passthrough()
                        ),
                        agentId: mtMap.objectField(
                          'agent_id',
                          mtMap.passthrough()
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date())
                  })
                )
              ),
              request: mtMap.objectField(
                'request',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  deniedReason: mtMap.objectField(
                    'denied_reason',
                    mtMap.passthrough()
                  ),
                  requester: mtMap.objectField(
                    'requester',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      ),
                      metadata: mtMap.objectField(
                        'metadata',
                        mtMap.passthrough()
                      ),
                      agentId: mtMap.objectField(
                        'agent_id',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  identityId: mtMap.objectField(
                    'identity_id',
                    mtMap.passthrough()
                  ),
                  expiresAt: mtMap.objectField('expires_at', mtMap.date()),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              credentialOverrides: mtMap.objectField(
                'credential_overrides',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    status: mtMap.objectField('status', mtMap.passthrough()),
                    permissions: mtMap.objectField(
                      'permissions',
                      mtMap.array(mtMap.passthrough())
                    ),
                    credentialId: mtMap.objectField(
                      'credential_id',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    expiresAt: mtMap.objectField('expires_at', mtMap.date())
                  })
                )
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              expiresAt: mtMap.objectField('expires_at', mtMap.date()),
              revokedAt: mtMap.objectField('revoked_at', mtMap.date())
            })
          ),
          expiresAt: mtMap.objectField('expires_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type IdentitiesDelegationRequestsListQuery = {
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
};

export let mapIdentitiesDelegationRequestsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      actorId: mtMap.objectField(
        'actor_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      identityId: mtMap.objectField(
        'identity_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

