import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersGetOutput = {
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
                oauthAutoRegistration: { status: 'supported' | 'unsupported' };
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

export let mapDashboardInstanceProvidersGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProvidersGetOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              ['publisher', 0, [1, ['image_url', 'created_at', 'updated_at']]],
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
                    ['triggers', 0, [3, [[0, [1, ['webhook_registration']]]]]],
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
    ],
    1
  );
