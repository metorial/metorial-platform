import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderListingsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderListingsListOutput =
  mtMap.object<DashboardInstanceProviderListingsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          attributes: mtMap.objectField(
            'attributes',
            mtMap.object({
              isPublic: mtMap.objectField('is_public', mtMap.passthrough()),
              isCustomized: mtMap.objectField(
                'is_customized',
                mtMap.passthrough()
              ),
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
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
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
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
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
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  isDefault: mtMap.objectField(
                    'is_default',
                    mtMap.passthrough()
                  ),
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
                      version: mtMap.objectField(
                        'version',
                        mtMap.passthrough()
                      ),
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
                      metadata: mtMap.objectField(
                        'metadata',
                        mtMap.passthrough()
                      ),
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
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          categories: mtMap.objectField(
            'categories',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
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
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
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
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceProviderListingsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  providerCategoryId?: string | string[] | undefined;
  providerCollectionId?: string | string[] | undefined;
  providerGroupId?: string | string[] | undefined;
  publisherId?: string | string[] | undefined;
  isPublic?: boolean | undefined;
  onlyFromTenant?: boolean | undefined;
  isVerified?: boolean | undefined;
  isOfficial?: boolean | undefined;
  isMetorial?: boolean | undefined;
  orderByRank?: boolean | undefined;
};

export let mapDashboardInstanceProviderListingsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      providerCategoryId: mtMap.objectField(
        'provider_category_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerCollectionId: mtMap.objectField(
        'provider_collection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerGroupId: mtMap.objectField(
        'provider_group_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      publisherId: mtMap.objectField(
        'publisher_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      isPublic: mtMap.objectField('is_public', mtMap.passthrough()),
      onlyFromTenant: mtMap.objectField(
        'only_from_tenant',
        mtMap.passthrough()
      ),
      isVerified: mtMap.objectField('is_verified', mtMap.passthrough()),
      isOfficial: mtMap.objectField('is_official', mtMap.passthrough()),
      isMetorial: mtMap.objectField('is_metorial', mtMap.passthrough()),
      orderByRank: mtMap.objectField('order_by_rank', mtMap.passthrough())
    })
  )
]);

