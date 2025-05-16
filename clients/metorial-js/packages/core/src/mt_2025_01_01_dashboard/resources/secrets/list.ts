import { mtMap } from '@metorial/util-resource-mapper';

export type SecretsListOutput = {
  items: {
    object: 'secret';
    id: string;
    status: 'active' | 'deleted';
    type: { identifier: string; name: string };
    description: string;
    metadata: Record<string, any>;
    organizationId: string;
    instanceId: string;
    fingerprint: string;
    lastUsedAt: Date | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSecretsListOutput = mtMap.object<SecretsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        type: mtMap.objectField(
          'type',
          mtMap.object({
            identifier: mtMap.objectField('identifier', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough())
          })
        ),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        organizationId: mtMap.objectField(
          'organization_id',
          mtMap.passthrough()
        ),
        instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
        fingerprint: mtMap.objectField('fingerprint', mtMap.passthrough()),
        lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type SecretsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?: 'server_deployment_config' | 'server_deployment_config'[] | undefined;
  status?: 'active' | 'deleted' | ('active' | 'deleted')[] | undefined;
};

export let mapSecretsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      type: mtMap.objectField(
        'type',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

