import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersRemoteServersListOutput = {
  items: {
    object: 'custom_server.remote_server';
    id: string;
    remoteUrl: string;
    remoteProtocol: 'sse' | 'streamable_http';
    providerOauth:
      | { type: 'custom' }
      | { type: 'json'; config: Record<string, any>; scopes: string[] }
      | null;
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
          remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
          remoteProtocol: mtMap.objectField(
            'remote_protocol',
            mtMap.passthrough()
          ),
          providerOauth: mtMap.objectField(
            'provider_oauth',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  config: mtMap.objectField('config', mtMap.passthrough()),
                  scopes: mtMap.objectField(
                    'scopes',
                    mtMap.array(mtMap.passthrough())
                  )
                })
              )
            ])
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

