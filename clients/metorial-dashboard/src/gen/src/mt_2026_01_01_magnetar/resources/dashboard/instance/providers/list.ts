import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProvidersListOutput = {
  items: {
    object: 'provider';
    id: string;
    access: string;
    status: string;
    ownerTenant: {
      object: string;
      id: string;
      identifier: string;
      name: string;
      createdAt: Date;
    } | null;
    publisher: {
      object: 'provider.publisher';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
    entry: {
      object: string;
      id: string;
      identifier: string;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      createdAt: Date;
      updatedAt: Date;
    };
    defaultVariant: {
      object: string;
      id: string;
      tag: string;
      identifier: string;
      providerId: string;
      isDefault: boolean;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
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
      createdAt: Date;
      updatedAt: Date;
    } | null;
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
    type: {
      object: 'provider.type';
      id: string;
      name: string;
      config:
        | { status: 'enabled'; read: { status: 'enabled' | 'disabled' } }
        | { status: 'disabled' };
      triggers:
        | { status: 'enabled'; receiverUrl: string }
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
                  } | null;
                }
              | { status: 'disabled' };
            export: { status: 'enabled' | 'disabled' };
            import: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled' };
      createdAt: Date;
    };
    oauth: {
      status: string;
      callbackUrl: string | null;
      autoRegistration: { status: string } | null;
    } | null;
    identifier: string;
    tag: string;
    name: string;
    description: string | null;
    slug: string;
    metadata: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProvidersListOutput =
  mtMap.object<DashboardInstanceProvidersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          access: mtMap.objectField('access', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          ownerTenant: mtMap.objectField(
            'owner_tenant',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
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
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          entry: mtMap.objectField(
            'entry',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          defaultVariant: mtMap.objectField(
            'default_variant',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              tag: mtMap.objectField('tag', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
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
          type: mtMap.objectField(
            'type',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              config: mtMap.objectField(
                'config',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      status: mtMap.objectField('status', mtMap.passthrough()),
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
              triggers: mtMap.objectField(
                'triggers',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      receiverUrl: mtMap.objectField(
                        'receiver_url',
                        mtMap.passthrough()
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
                      status: mtMap.objectField('status', mtMap.passthrough()),
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
          tag: mtMap.objectField('tag', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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

export type DashboardInstanceProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceProvidersListQuery = mtMap.union([
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

