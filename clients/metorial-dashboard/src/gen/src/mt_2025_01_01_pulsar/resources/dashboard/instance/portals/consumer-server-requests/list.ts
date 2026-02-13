import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsConsumerServerRequestsListOutput = {
  items: {
    object: 'consumer.server_request';
    id: string;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public' | 'custom';
      createdAt: Date;
      updatedAt: Date;
    };
    consumer: {
      object: 'consumer.profile';
      id: string;
      name: string;
      email: string;
      imageUrl: string;
      createdAt: Date;
    };
    reason: string;
    rejectionReason: string | null;
    status: 'approved' | 'rejected' | 'pending';
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstancePortalsConsumerServerRequestsListOutput =
  mtMap.object<DashboardInstancePortalsConsumerServerRequestsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          server: mtMap.objectField(
            'server',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              type: mtMap.objectField('type', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          consumer: mtMap.objectField(
            'consumer',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          reason: mtMap.objectField('reason', mtMap.passthrough()),
          rejectionReason: mtMap.objectField(
            'rejection_reason',
            mtMap.passthrough()
          ),
          status: mtMap.objectField('status', mtMap.passthrough()),
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

export type DashboardInstancePortalsConsumerServerRequestsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'pending'
    | 'approved'
    | 'rejected'
    | ('pending' | 'approved' | 'rejected')[]
    | undefined;
  serverId?: string | string[] | undefined;
  consumerProfileId?: string | string[] | undefined;
};

export let mapDashboardInstancePortalsConsumerServerRequestsListQuery =
  mtMap.union([
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
        serverId: mtMap.objectField(
          'server_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        consumerProfileId: mtMap.objectField(
          'consumer_profile_id',
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

