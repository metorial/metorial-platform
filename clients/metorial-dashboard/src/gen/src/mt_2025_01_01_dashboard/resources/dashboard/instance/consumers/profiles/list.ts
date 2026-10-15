import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumersProfilesListOutput = {
  items: (({
    object: 'consumer.profile';
    id: string;
    name: string;
    email: string;
    imageUrl: string;
    consumerId: string;
    userId: string | null;
    status: 'active' | 'invited';
    createdAt: Date;
    updatedAt: Date;
  } & {
    groups:
      | {
          object: 'consumer.profile.group_assignment';
          group: {
            object: 'consumer.group';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
            description: string | null;
            isDefault: boolean;
            createdAt: Date;
            updatedAt: Date;
          };
          assignedVia: 'default' | 'manual' | 'sso' | 'user';
        }[]
      | null;
  }) & {
    surface: {
      object: 'consumer.surface';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      allowConsumerSkillAuthoring: boolean;
      allowConsumerSkillPublishing: boolean;
      skillConfiguration: {
        id: string;
        isDefault: boolean;
        allowScripts: boolean;
        allowedFileExtensions: string[];
        allowNonStandardDirectories: boolean;
      };
      auth: {
        object: 'consumer.surface.auth';
        sessionExpiryTimeInSeconds: number;
        emailWhitelist: string[];
      };
      createdAt: Date;
      updatedAt: Date;
    };
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceConsumersProfilesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersProfilesListOutput>(
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
                'image_url',
                'consumer_id',
                'user_id',
                'created_at',
                'updated_at',
                [
                  'groups',
                  0,
                  [
                    2,
                    [
                      1,
                      [
                        [
                          'group',
                          0,
                          [1, ['is_default', 'created_at', 'updated_at']]
                        ],
                        'assigned_via'
                      ]
                    ]
                  ]
                ],
                [
                  'surface',
                  0,
                  [
                    1,
                    [
                      'allow_consumer_skill_authoring',
                      'allow_consumer_skill_publishing',
                      [
                        'skill_configuration',
                        1,
                        [
                          1,
                          [
                            'is_default',
                            'allow_scripts',
                            'allowed_file_extensions',
                            'allow_non_standard_directories'
                          ]
                        ]
                      ],
                      [
                        'auth',
                        0,
                        [
                          1,
                          ['session_expiry_time_in_seconds', 'email_whitelist']
                        ]
                      ],
                      'created_at',
                      'updated_at'
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

export type DashboardInstanceConsumersProfilesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceConsumersProfilesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersProfilesListQuery>(0);
