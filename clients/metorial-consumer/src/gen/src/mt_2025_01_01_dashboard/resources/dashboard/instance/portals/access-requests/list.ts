import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsAccessRequestsListOutput = {
  items: {
    object: 'consumer.access_request';
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    message: string | null;
    resolutionMessage: string | null;
    consumerProfile: {
      object: 'consumer.profile#preview';
      id: string;
      name: string;
      email: string;
    };
    target:
      | {
          type: 'provider_template';
          providerTemplate: {
            object: 'provider.template#preview';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
            description: string | null;
            metadata: Record<string, any>;
            providerDeploymentId: string;
            createdAt: Date;
            updatedAt: Date;
          };
        }
      | {
          type: 'magic_mcp_server';
          magicMcpServer: {
            object: 'magic_mcp.server#preview';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string | null;
            description: string | null;
          };
        };
    createdAt: Date;
    updatedAt: Date;
    reviewedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstancePortalsAccessRequestsListOutput =
  mtMap.object<DashboardInstancePortalsAccessRequestsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          resolutionMessage: mtMap.objectField(
            'resolution_message',
            mtMap.passthrough()
          ),
          consumerProfile: mtMap.objectField(
            'consumer_profile',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough())
            })
          ),
          target: mtMap.objectField(
            'target',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  providerTemplate: mtMap.objectField(
                    'provider_template',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
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
                      providerDeploymentId: mtMap.objectField(
                        'provider_deployment_id',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  magicMcpServer: mtMap.objectField(
                    'magic_mcp_server',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      )
                    })
                  )
                })
              )
            ])
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          reviewedAt: mtMap.objectField('reviewed_at', mtMap.date())
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

export type DashboardInstancePortalsAccessRequestsListQuery = {
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
  consumerProfileId?: string | string[] | undefined;
  search?: string | undefined;
};

export let mapDashboardInstancePortalsAccessRequestsListQuery = mtMap.union([
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
      consumerProfileId: mtMap.objectField(
        'consumer_profile_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      search: mtMap.objectField('search', mtMap.passthrough())
    })
  )
]);

