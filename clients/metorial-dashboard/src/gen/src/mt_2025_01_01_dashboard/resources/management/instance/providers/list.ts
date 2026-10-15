import { createMapper } from '@metorial/util-resource-mapper/compact';

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
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProvidersListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProvidersListOutput>(
    [
      7,
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
                ['oauth', 0, [1, ['callback_url', 'auto_registration']]],
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
    1
  );

export type ManagementInstanceProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  search?: string | undefined;
  authMethod?: string | string[] | undefined;
  authSetup?:
    | 'configured'
    | 'not_configured'
    | ('configured' | 'not_configured')[]
    | undefined;
  capabilities?:
    | {
        supportsConfig?: boolean | undefined;
        supportsAuth?: boolean | undefined;
        supportsOauth?: boolean | undefined;
        supportsCallbacks?: boolean | undefined;
        supportsWebhookRegistration?: boolean | undefined;
        supportsOauthAutoRegistration?: boolean | undefined;
        supportsAuthExport?: boolean | undefined;
        supportsAuthImport?: boolean | undefined;
      }
    | undefined;
};

export let mapManagementInstanceProvidersListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProvidersListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'auth_method',
            'auth_setup',
            [
              'capabilities',
              0,
              [
                1,
                [
                  ['supportsOAuth', 'supportsOauth'],
                  [
                    'supportsOAuthAutoRegistration',
                    'supportsOauthAutoRegistration'
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  ]);
