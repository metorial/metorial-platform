import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersRemoteServersListOutput = {
  items: {
    object: 'custom_server.remote_server';
    id: string;
    name: string | null;
    description: string | null;
    remoteUrl: string;
    providerOauth: {
      status: 'pending' | 'active' | 'inactive';
      type: 'none' | 'manual' | 'auto_discovery';
      config: Record<string, any> | null;
      scopes: string[] | null;
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapCustomServersRemoteServersListOutput =
  mtMap.object<CustomServersRemoteServersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
          providerOauth: mtMap.objectField(
            'provider_oauth',
            mtMap.object({
              status: mtMap.objectField('status', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              config: mtMap.objectField('config', mtMap.passthrough()),
              scopes: mtMap.objectField(
                'scopes',
                mtMap.array(mtMap.passthrough())
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
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

export type CustomServersRemoteServersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapCustomServersRemoteServersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

