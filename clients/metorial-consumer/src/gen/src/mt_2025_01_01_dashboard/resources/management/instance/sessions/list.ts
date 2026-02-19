import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsListOutput = {
  items: {
    object: 'session';
    id: string;
    name: string | null;
    description: string | null;
    status: 'active' | 'deleted';
    connectionStatus: 'connected' | 'disconnected';
    usage: {
      totalProductiveMessageCount: number;
      totalProductiveClientMessageCount: number;
      totalProductiveServerMessageCount: number;
    };
    metadata: Record<string, any> | null;
    connectionUrl: string | null;
    providerDeployments: {
      object: 'session.provider_deployment#preview';
      id: string;
      name: string | null;
      providerId: string;
      providerDeploymentId: string | null;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSessionsListOutput =
  mtMap.object<ManagementInstanceSessionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          connectionStatus: mtMap.objectField('connection_status', mtMap.passthrough()),
          usage: mtMap.objectField(
            'usage',
            mtMap.object({
              totalProductiveMessageCount: mtMap.objectField(
                'total_productive_message_count',
                mtMap.passthrough()
              ),
              totalProductiveClientMessageCount: mtMap.objectField(
                'total_productive_client_message_count',
                mtMap.passthrough()
              ),
              totalProductiveServerMessageCount: mtMap.objectField(
                'total_productive_server_message_count',
                mtMap.passthrough()
              )
            })
          ),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          connectionUrl: mtMap.objectField('connection_url', mtMap.passthrough()),
          providerDeployments: mtMap.objectField(
            'provider_deployments',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
                providerDeploymentId: mtMap.objectField(
                  'provider_deployment_id',
                  mtMap.passthrough()
                )
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
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

export type ManagementInstanceSessionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
};

export let mapManagementInstanceSessionsListQuery = mtMap.union([
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
      )
    })
  )
]);
