import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderListingsGetOutput = {
  object: 'provider.listing';
  id: string;
  attributes: {
    isPublic: boolean;
    isCustomized: boolean;
    isMetorial: boolean;
    isVerified: boolean;
    isOfficial: boolean;
  };
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string;
  readme: string | null;
  skills: string[];
  provider: {
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
  };
  categories: {
    object: 'provider.listing_category';
    id: string;
    name: string;
    description: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  collections: {
    object: 'provider.listing_collection';
    id: string;
    name: string;
    description: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  groups: {
    object: 'provider.listing_group';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
} & {
  docs: {
    provider: { type?: string | undefined; name: string; url: string }[];
    config: { type?: string | undefined; name: string; url: string }[];
    authMethods: {
      key: string;
      name: string;
      type: string;
      docs: { type?: string | undefined; name: string; url: string }[];
    }[];
    actions: {
      key: string;
      name: string;
      type: 'tool' | 'trigger';
      docs: { type?: string | undefined; name: string; url: string }[];
    }[];
  } | null;
  provider: {
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
  };
};

export let mapDashboardInstanceProviderListingsGetOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      attributes: mtMap.objectField(
        'attributes',
        mtMap.object({
          isPublic: mtMap.objectField('is_public', mtMap.passthrough()),
          isCustomized: mtMap.objectField('is_customized', mtMap.passthrough()),
          isMetorial: mtMap.objectField('is_metorial', mtMap.passthrough()),
          isVerified: mtMap.objectField('is_verified', mtMap.passthrough()),
          isOfficial: mtMap.objectField('is_official', mtMap.passthrough())
        })
      ),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      slug: mtMap.objectField('slug', mtMap.passthrough()),
      imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
      readme: mtMap.objectField('readme', mtMap.passthrough()),
      skills: mtMap.objectField('skills', mtMap.array(mtMap.passthrough())),
      provider: mtMap.objectField(
        'provider',
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
      ),
      categories: mtMap.objectField(
        'categories',
        mtMap.array(
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        )
      ),
      collections: mtMap.objectField(
        'collections',
        mtMap.array(
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        )
      ),
      groups: mtMap.objectField(
        'groups',
        mtMap.array(
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        )
      ),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      docs: mtMap.objectField(
        'docs',
        mtMap.object({
          provider: mtMap.objectField(
            'provider',
            mtMap.array(
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                url: mtMap.objectField('url', mtMap.passthrough())
              })
            )
          ),
          config: mtMap.objectField(
            'config',
            mtMap.array(
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                url: mtMap.objectField('url', mtMap.passthrough())
              })
            )
          ),
          authMethods: mtMap.objectField(
            'auth_methods',
            mtMap.array(
              mtMap.object({
                key: mtMap.objectField('key', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                docs: mtMap.objectField(
                  'docs',
                  mtMap.array(
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      url: mtMap.objectField('url', mtMap.passthrough())
                    })
                  )
                )
              })
            )
          ),
          actions: mtMap.objectField(
            'actions',
            mtMap.array(
              mtMap.object({
                key: mtMap.objectField('key', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                docs: mtMap.objectField(
                  'docs',
                  mtMap.array(
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      url: mtMap.objectField('url', mtMap.passthrough())
                    })
                  )
                )
              })
            )
          )
        })
      )
    })
  )
]);

