import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<IdentitiesCredentialsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          identityId: mtMap.objectField('identity_id', mtMap.passthrough()),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          deploymentId: mtMap.objectField('deployment_id', mtMap.passthrough()),
          configId: mtMap.objectField('config_id', mtMap.passthrough()),
          authConfigId: mtMap.objectField(
            'auth_config_id',
            mtMap.passthrough()
          ),
          delegationConfigId: mtMap.objectField(
            'delegation_config_id',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
  identityId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapIdentitiesCredentialsListQuery = mtMap.union([
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
      agentId: mtMap.objectField(
        'agent_id',
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
      ),
      providerId: mtMap.objectField(
        'provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerDeploymentId: mtMap.objectField(
        'provider_deployment_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerConfigId: mtMap.objectField(
        'provider_config_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerAuthConfigId: mtMap.objectField(
        'provider_auth_config_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      updatedAt: mtMap.objectField(
        'updated_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

