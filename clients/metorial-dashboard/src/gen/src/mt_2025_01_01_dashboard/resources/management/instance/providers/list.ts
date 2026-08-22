import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProvidersListOutput = {
  items: ({
    object: 'provider';
    id: string;
    access: 'public' | 'tenant';
    status: 'active' | 'archived' | 'deleted';
    publisher: {
      object: 'provider.publisher';
      id: string;
      name: string;
      description: string | null;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
    currentVersion: {
      object: 'provider.version';
      id: string;
      version: string;
      providerId: string;
      isCurrent: boolean;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      specificationId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    oauth: {
      status: 'enabled' | 'disabled';
      callbackUrl: string | null;
      autoRegistration: { status: 'supported' | 'unsupported' };
    } | null;
    identifier: string;
    name: string;
    description: string | null;
    slug: string;
    metadata: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
  } & {
    type: {
      object: 'provider.type';
      id: string;
      name: string;
      backend:
        | 'slates'
        | 'native'
        | 'mcp.container'
        | 'mcp.function'
        | 'mcp.remote';
      triggers:
        | { status: 'enabled'; receiverUrl: string }
        | { status: 'disabled' };
      config:
        | { status: 'enabled'; read: { status: 'enabled' | 'disabled' } }
        | { status: 'disabled' };
      auth:
        | {
            status: 'enabled';
            oauth:
              | {
                  status: 'enabled';
                  oauthCallbackUrl: string | null;
                  oauthAutoRegistration: {
                    status: 'supported' | 'unsupported';
                  };
                }
              | { status: 'disabled' };
            export: { status: 'enabled' | 'disabled' };
            import: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled' };
      createdAt: Date;
    };
    tag: string;
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProvidersListOutput =
  mtMap.object<ManagementInstanceProvidersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              access: mtMap.objectField('access', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              publisher: mtMap.objectField(
                'publisher',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              currentVersion: mtMap.objectField(
                'current_version',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  version: mtMap.objectField('version', mtMap.passthrough()),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  isCurrent: mtMap.objectField(
                    'is_current',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                  specificationId: mtMap.objectField(
                    'specification_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              oauth: mtMap.objectField(
                'oauth',
                mtMap.object({
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  callbackUrl: mtMap.objectField(
                    'callback_url',
                    mtMap.passthrough()
                  ),
                  autoRegistration: mtMap.objectField(
                    'auto_registration',
                    mtMap.object({
                      status: mtMap.objectField('status', mtMap.passthrough())
                    })
                  )
                })
              ),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              type: mtMap.objectField(
                'type',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  backend: mtMap.objectField('backend', mtMap.passthrough()),
                  triggers: mtMap.objectField(
                    'triggers',
                    mtMap.union([
                      mtMap.unionOption(
                        'object',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          ),
                          receiverUrl: mtMap.objectField(
                            'receiver_url',
                            mtMap.passthrough()
                          )
                        })
                      )
                    ])
                  ),
                  config: mtMap.objectField(
                    'config',
                    mtMap.union([
                      mtMap.unionOption(
                        'object',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          ),
                          read: mtMap.objectField(
                            'read',
                            mtMap.object({
                              status: mtMap.objectField(
                                'status',
                                mtMap.passthrough()
                              )
                            })
                          )
                        })
                      )
                    ])
                  ),
                  auth: mtMap.objectField(
                    'auth',
                    mtMap.union([
                      mtMap.unionOption(
                        'object',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          ),
                          oauth: mtMap.objectField(
                            'oauth',
                            mtMap.union([
                              mtMap.unionOption(
                                'object',
                                mtMap.object({
                                  status: mtMap.objectField(
                                    'status',
                                    mtMap.passthrough()
                                  ),
                                  oauthCallbackUrl: mtMap.objectField(
                                    'oauth_callback_url',
                                    mtMap.passthrough()
                                  ),
                                  oauthAutoRegistration: mtMap.objectField(
                                    'oauth_auto_registration',
                                    mtMap.object({
                                      status: mtMap.objectField(
                                        'status',
                                        mtMap.passthrough()
                                      )
                                    })
                                  )
                                })
                              )
                            ])
                          ),
                          export: mtMap.objectField(
                            'export',
                            mtMap.object({
                              status: mtMap.objectField(
                                'status',
                                mtMap.passthrough()
                              )
                            })
                          ),
                          import: mtMap.objectField(
                            'import',
                            mtMap.object({
                              status: mtMap.objectField(
                                'status',
                                mtMap.passthrough()
                              )
                            })
                          )
                        })
                      )
                    ])
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              tag: mtMap.objectField('tag', mtMap.passthrough())
            })
          )
        ])
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

export type ManagementInstanceProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  capabilities?:
    | {
        supportsConfig?: boolean | undefined;
        supportsAuth?: boolean | undefined;
        supportsOauth?: boolean | undefined;
        supportsCallbacks?: boolean | undefined;
        supportsOauthAutoRegistration?: boolean | undefined;
        supportsAuthExport?: boolean | undefined;
        supportsAuthImport?: boolean | undefined;
      }
    | undefined;
};

export let mapManagementInstanceProvidersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
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
      capabilities: mtMap.objectField(
        'capabilities',
        mtMap.object({
          supportsConfig: mtMap.objectField(
            'supportsConfig',
            mtMap.passthrough()
          ),
          supportsAuth: mtMap.objectField('supportsAuth', mtMap.passthrough()),
          supportsOauth: mtMap.objectField(
            'supportsOAuth',
            mtMap.passthrough()
          ),
          supportsCallbacks: mtMap.objectField(
            'supportsCallbacks',
            mtMap.passthrough()
          ),
          supportsOauthAutoRegistration: mtMap.objectField(
            'supportsOAuthAutoRegistration',
            mtMap.passthrough()
          ),
          supportsAuthExport: mtMap.objectField(
            'supportsAuthExport',
            mtMap.passthrough()
          ),
          supportsAuthImport: mtMap.objectField(
            'supportsAuthImport',
            mtMap.passthrough()
          )
        })
      )
    })
  )
]);

