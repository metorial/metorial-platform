import { createMapper } from '@metorial/util-resource-mapper/compact';

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
        | {
            status: 'enabled';
            webhookRegistration: { status: 'supported' | 'unsupported' };
          }
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

export let mapDashboardInstanceProviderListingsGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderListingsGetOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              [
                'attributes',
                0,
                [
                  1,
                  [
                    'is_public',
                    'is_customized',
                    'is_metorial',
                    'is_verified',
                    'is_official'
                  ]
                ]
              ],
              'image_url',
              [
                'provider',
                0,
                [
                  3,
                  [
                    [
                      0,
                      [
                        1,
                        [
                          [
                            'publisher',
                            0,
                            [1, ['image_url', 'created_at', 'updated_at']]
                          ],
                          [
                            'current_version',
                            1,
                            [
                              1,
                              [
                                'provider_id',
                                'is_current',
                                'specification_id',
                                'created_at',
                                'updated_at'
                              ]
                            ]
                          ],
                          [
                            'oauth',
                            0,
                            [1, ['callback_url', 'auto_registration']]
                          ],
                          'created_at',
                          'updated_at',
                          [
                            'type',
                            0,
                            [
                              1,
                              [
                                [
                                  'triggers',
                                  0,
                                  [3, [[0, [1, ['webhook_registration']]]]]
                                ],
                                [
                                  'auth',
                                  0,
                                  [
                                    3,
                                    [
                                      [
                                        0,
                                        [
                                          1,
                                          [
                                            [
                                              'oauth',
                                              0,
                                              [
                                                3,
                                                [
                                                  [
                                                    0,
                                                    [
                                                      1,
                                                      [
                                                        'oauth_callback_url',
                                                        'oauth_auto_registration'
                                                      ]
                                                    ]
                                                  ]
                                                ]
                                              ]
                                            ]
                                          ]
                                        ]
                                      ]
                                    ]
                                  ]
                                ],
                                'created_at'
                              ]
                            ]
                          ]
                        ]
                      ]
                    ]
                  ]
                ]
              ],
              ['categories', 0, [2, 8]],
              ['collections', 0, [2, 8]],
              ['groups', 0, [2, 8]],
              'created_at',
              'updated_at',
              ['docs', 0, [1, ['auth_methods']]]
            ]
          ]
        ]
      ]
    ],
    1
  );
